/**
 * vmix_diagnose_logs - Review Mode triage for explicit log/error text.
 * Read-only: it never scans directories, calls vMix, or changes host settings.
 */
import { readFileSync, statSync } from 'fs';
import { extname } from 'path';
import { z } from 'zod';
import { createTool, errorResult, toolJsonContent, type ToolContext } from '../base.js';
import { redactSecrets } from '../../state/preset/preset-redaction.js';

const DEFAULT_MAX_BYTES = 64 * 1024;
const HARD_MAX_BYTES = 256 * 1024;
const EXCERPT_MAX_CHARS = 4000;
const EXCERPT_MAX_LINES = 40;
const ALLOWED_LOG_EXTENSIONS = new Set([
  '.err',
  '.json',
  '.log',
  '.ndjson',
  '.stderr',
  '.stdout',
  '.txt',
  '.xml',
]);

const sourceSchema = z
  .enum(['auto', 'mcp', 'vmix', 'blackmagic', 'ndi', 'audio', 'windows', 'script', 'vmix-api', 'unknown'])
  .optional();

const schema = z.object({
  content: z
    .string()
    .optional()
    .describe('Pasted log or error text. Provide this instead of path.'),
  path: z
    .string()
    .optional()
    .describe('Explicit path to a single plain-text log file on the MCP host. Directories are rejected.'),
  source: sourceSchema.describe('Optional source hint for the log text.'),
  focus: z.string().optional().describe('Optional question or symptom to focus the diagnosis.'),
  maxBytes: z
    .number()
    .int()
    .min(1)
    .max(HARD_MAX_BYTES)
    .optional()
    .describe('Maximum bytes to read/analyze. Defaults to 65536 and is capped at 262144.'),
});

type SourceHint = NonNullable<z.infer<typeof sourceSchema>>;
type Confidence = 'high' | 'medium' | 'low';
type DiagnosticSurface =
  | 'mcp-client'
  | 'vmix-connectivity'
  | 'capture-device'
  | 'audio-device'
  | 'ndi-network'
  | 'script'
  | 'vmix-api'
  | 'unknown';

interface RedactionSummary {
  secretHints: number;
  vmixCallUrls: number;
  streamUrls: number;
  privateIps: number;
  localPaths: number;
  uncPaths: number;
  total: number;
}

interface LogFinding {
  id: string;
  surface: DiagnosticSurface;
  confidence: Confidence;
  summary: string;
  evidence: string[];
  likelyCauses: Array<{ confidence: Confidence; cause: string }>;
  safeNextChecks: string[];
  confirmOrRuleOut: string[];
  unknowns: string[];
  relatedCorpusIds: string[];
}

const VMIX_CALL_URL = /\bhttps?:\/\/[^\s"'<>]*vmixcall[^\s"'<>]*/gi;
const STREAM_URL = /\b(?:rtmp|rtmps|srt):\/\/[^\s"'<>]+/gi;
const PRIVATE_IP =
  /\b(?:10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2})\b/g;
const WINDOWS_LOCAL_PATH = /\b[A-Za-z]:\\(?:[^\\\r\n\s]+\\)*[^\\\r\n\s]*/g;
const UNC_PATH = /\\\\[A-Za-z0-9_.-]+\\[^\s\r\n]+/g;
const SECRET_ASSIGNMENT =
  /\b(?:password|passphrase|streamkey|api[_-]?key|secret|token)\s*:?=\s*(?:"[^"]*"|[^"&\s<>]+)/gi;
const SECRET_QUERY =
  /[?&](?:key|password|passphrase|streamkey|api[_-]?key|secret|token)=[^"&\s<>]+/gi;
const SECRET_ELEMENT =
  /<\w*(?:API_?Key|ApiKey|StreamKey|Password|Passphrase|Secret|Token)\w*>[^<]*<\/\w+>/gi;
const URL_CREDENTIALS = /\b[a-z][a-z0-9+.-]*:\/\/[^/\s"<>@:]+:[^\s"<>/?]+@/gi;

function countMatches(text: string, pattern: RegExp): number {
  return Array.from(text.matchAll(pattern)).length;
}

function countSecretHints(text: string): number {
  return (
    countMatches(text, SECRET_ASSIGNMENT) +
    countMatches(text, SECRET_QUERY) +
    countMatches(text, SECRET_ELEMENT) +
    countMatches(text, URL_CREDENTIALS)
  );
}

function redactLogText(text: string): { text: string; summary: RedactionSummary } {
  const summary: RedactionSummary = {
    secretHints: countSecretHints(text),
    vmixCallUrls: countMatches(text, VMIX_CALL_URL),
    streamUrls: countMatches(text, STREAM_URL),
    privateIps: countMatches(text, PRIVATE_IP),
    localPaths: countMatches(text, WINDOWS_LOCAL_PATH),
    uncPaths: countMatches(text, UNC_PATH),
    total: 0,
  };

  let redacted = text
    .replace(VMIX_CALL_URL, '[vmix-call-url]')
    .replace(STREAM_URL, '[stream-url]')
    .replace(PRIVATE_IP, '[private-ip]')
    .replace(WINDOWS_LOCAL_PATH, '[local-path]')
    .replace(UNC_PATH, '[unc-path]');

  const beforeSecretRedaction = redacted;
  redacted = redactSecrets(redacted);
  if (summary.secretHints === 0 && redacted !== beforeSecretRedaction) {
    summary.secretHints = 1;
  }

  summary.total =
    summary.secretHints +
    summary.vmixCallUrls +
    summary.streamUrls +
    summary.privateIps +
    summary.localPaths +
    summary.uncPaths;

  return { text: redacted, summary };
}

function truncateUtf8(text: string, maxBytes: number): { text: string; truncated: boolean; originalBytes: number } {
  const originalBytes = Buffer.byteLength(text, 'utf8');
  if (originalBytes <= maxBytes) {
    return { text, truncated: false, originalBytes };
  }

  return {
    text: Buffer.from(text, 'utf8').subarray(0, maxBytes).toString('utf8'),
    truncated: true,
    originalBytes,
  };
}

function buildExcerpt(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  let excerpt = lines.slice(0, EXCERPT_MAX_LINES).join('\n');
  let truncated = lines.length > EXCERPT_MAX_LINES;

  if (excerpt.length > EXCERPT_MAX_CHARS) {
    excerpt = excerpt.slice(0, EXCERPT_MAX_CHARS);
    truncated = true;
  }

  return truncated ? `${excerpt}\n[excerpt truncated]` : excerpt;
}

function unique(items: string[], limit = 8): string[] {
  return Array.from(new Set(items)).slice(0, limit);
}

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

function confidenceWeight(confidence: Confidence): number {
  if (confidence === 'high') return 3;
  if (confidence === 'medium') return 2;
  return 1;
}

function collectFindings(text: string, sourceHint: SourceHint): LogFinding[] {
  const findings: LogFinding[] = [];
  const sourceIs = (source: SourceHint) => sourceHint === source;

  if (has(text, /spawn\s+npx\s+enoent/i) || (has(text, /\bnpx\b/i) && has(text, /\benoent\b/i))) {
    findings.push({
      id: 'mcp-spawn-npx-enoent',
      surface: 'mcp-client',
      confidence: 'high',
      summary: 'The MCP client likely cannot find Node/npx in its launch environment.',
      evidence: ['The log mentions npx with ENOENT, which usually means the executable was not found.'],
      likelyCauses: [
        { confidence: 'high', cause: 'The MCP client was launched with a PATH that does not include Node/npm.' },
        { confidence: 'medium', cause: 'The client config uses a command shape the Windows launcher cannot resolve.' },
      ],
      safeNextChecks: [
        'Compare the MCP client launch configuration with the Node path available in a normal terminal.',
        'Use the Windows cmd-based launch shape or an absolute Node executable path in the MCP client config.',
        'Fully restart the MCP client after changing the launch configuration.',
      ],
      confirmOrRuleOut: [
        'Confirm whether the same config works when launched from a terminal environment.',
        'Check the client MCP log immediately after a restart for the same ENOENT text.',
      ],
      unknowns: ['Which MCP client launched the server and what environment it inherited.'],
      relatedCorpusIds: ['TR-007'],
    });
  }

  if (
    has(text, /\b(web controller|8088|vmix_host|vmix_http_port|econnrefused|enotfound|eai_again|fetch failed|connect etimedout)\b/i) ||
    (sourceIs('vmix') && has(text, /\b(connection|connect|timeout|refused|unreachable)\b/i))
  ) {
    findings.push({
      id: 'vmix-web-controller-connectivity',
      surface: 'vmix-connectivity',
      confidence: has(text, /\b(econnrefused|enotfound|eai_again|connect etimedout)\b/i) ? 'high' : 'medium',
      summary: 'The server may not be able to reach the vMix Web Controller/API endpoint.',
      evidence: ['The log references vMix connectivity, Web Controller settings, or network connection failure text.'],
      likelyCauses: [
        { confidence: 'high', cause: 'vMix is closed, Web Controller is disabled, or the configured host/port is wrong.' },
        { confidence: 'medium', cause: 'A firewall, VLAN, or hostname resolution issue blocks the MCP host from reaching vMix.' },
      ],
      safeNextChecks: [
        'Use vmix_connection_test before deeper diagnosis.',
        'Confirm vMix is running and Web Controller is enabled on the expected port.',
        'If vMix is remote, verify the host and port are reachable only on the trusted production network.',
      ],
      confirmOrRuleOut: [
        'A successful vmix_connection_test rules out the basic HTTP reachability problem.',
        'A failure limited to TCP tally while HTTP succeeds narrows the problem to optional TCP/API tally.',
      ],
      unknowns: ['Whether vMix is local or remote and whether the Web Controller is enabled.'],
      relatedCorpusIds: ['TR-006'],
    });
  }

  const mentionsBlackmagic = has(text, /\b(blackmagic|decklink|ultrastudio|desktop video)\b/i) || sourceIs('blackmagic');
  if (mentionsBlackmagic && has(text, /\b(busy|in use|already open|access denied|cannot open|owned by another)\b/i)) {
    findings.push({
      id: 'blackmagic-device-ownership',
      surface: 'capture-device',
      confidence: 'high',
      summary: 'The capture device may already be open in another application or driver session.',
      evidence: ['The log references a Blackmagic/DeckLink device plus ownership or access-denied language.'],
      likelyCauses: [
        { confidence: 'high', cause: 'Another app has the capture device open.' },
        { confidence: 'medium', cause: 'A stale driver session or previous vMix input still owns the device.' },
      ],
      safeNextChecks: [
        'Close other video applications before testing the capture input again.',
        'Check Blackmagic Desktop Video Setup for device visibility before changing vMix input settings.',
        'Treat driver resets or reboots as rehearsal/maintenance actions, not in-show fixes.',
      ],
      confirmOrRuleOut: [
        'The issue clears after closing competing apps or after a clean rehearsal restart.',
        'Desktop Video can see the device while vMix still cannot open it.',
      ],
      unknowns: ['Which applications were open when the capture input failed.'],
      relatedCorpusIds: ['TR-002'],
    });
  }

  if (
    mentionsBlackmagic &&
    has(text, /\b(no signal|no frames|format|mode|1080i|1080p|2160p|59\.94|29\.97|level a|level b|connector|sdi|hdmi)\b/i)
  ) {
    findings.push({
      id: 'blackmagic-format-or-transport',
      surface: 'capture-device',
      confidence: has(text, /\b(no signal|no frames|format|mode)\b/i) ? 'high' : 'medium',
      summary: 'The capture path may have a source format, connector, or SDI transport mismatch.',
      evidence: ['The log references Blackmagic capture with signal format, connector, or frame-delivery clues.'],
      likelyCauses: [
        { confidence: 'high', cause: 'The source output format does not exactly match the vMix input format.' },
        { confidence: 'medium', cause: 'The SDI connector path or Level A/B transport does not match the device/input.' },
      ],
      safeNextChecks: [
        'Confirm the source output format at the camera, switcher, converter, or router.',
        'Match the vMix input format exactly to the source before assuming hardware failure.',
        'Check connector and SDI Level A/B settings in the device/control path.',
      ],
      confirmOrRuleOut: [
        'A known-good source at the same format works on the same input path.',
        'Changing only the source format or vMix input format makes frames appear.',
      ],
      unknowns: ['The actual source output format and the exact vMix capture input format.'],
      relatedCorpusIds: ['TR-001', 'TR-003'],
    });
  }

  if (
    sourceIs('audio') ||
    has(text, /\b(sample rate|48\s*k(?:hz)?|44\.1\s*k(?:hz)?|clock|exclusive mode|asio|wdm|dropout|click|drift|desync)\b/i)
  ) {
    findings.push({
      id: 'audio-sample-rate-or-clock',
      surface: 'audio-device',
      confidence: has(text, /\b(sample rate|clock|48\s*k|44\.1\s*k)\b/i) ? 'high' : 'medium',
      summary: 'The symptom may come from an audio sample-rate, driver, or clock mismatch.',
      evidence: ['The log references audio timing, clocking, driver mode, or dropout symptoms.'],
      likelyCauses: [
        { confidence: 'high', cause: 'One device or Windows audio endpoint is not running at the production sample rate.' },
        { confidence: 'medium', cause: 'ASIO/WDM driver selection or external clocking is inconsistent across devices.' },
      ],
      safeNextChecks: [
        'Confirm all production audio devices are set to the same sample rate, typically 48 kHz for video workflows.',
        'Check whether Windows exclusive mode or another app is holding the device.',
        'Use vmix_diagnose_audio when live vMix state can confirm buses, mutes, and selected audio sources.',
      ],
      confirmOrRuleOut: [
        'Dropouts stop when all devices and vMix use the same sample rate.',
        'The problem follows one device/driver rather than one vMix input.',
      ],
      unknowns: ['Which physical or virtual audio device is master clock for the show.'],
      relatedCorpusIds: ['TR-004'],
    });
  }

  if (
    sourceIs('ndi') ||
    has(text, /\b(ndi|access manager|discovery server|multicast|vlan|subnet|network profile|firewall|sender|receiver)\b/i)
  ) {
    findings.push({
      id: 'ndi-discovery-or-network',
      surface: 'ndi-network',
      confidence: has(text, /\b(ndi|access manager|discovery server)\b/i) ? 'high' : 'medium',
      summary: 'The issue may be NDI discovery, group configuration, firewall, or network segmentation.',
      evidence: ['The log references NDI or common network-discovery constraints.'],
      likelyCauses: [
        { confidence: 'high', cause: 'Sender and receiver are not in the same NDI group/discovery view.' },
        { confidence: 'medium', cause: 'Firewall, Windows network profile, VLAN, or subnet segmentation blocks discovery.' },
      ],
      safeNextChecks: [
        'Confirm the NDI sender is visible from the receiving machine in the same group/discovery configuration.',
        'Check Windows firewall and network profile before changing production routing.',
        'Avoid assuming the NDI source is offline until discovery and network segmentation are checked.',
      ],
      confirmOrRuleOut: [
        'The source appears after aligning NDI Access Manager group or discovery-server settings.',
        'A direct same-subnet test works while the production VLAN path does not.',
      ],
      unknowns: ['Whether sender and receiver are on the same subnet/VLAN and NDI group.'],
      relatedCorpusIds: ['TR-005'],
    });
  }

  if (
    sourceIs('script') ||
    has(text, /\b(bc30\d+|compile|compiler|vb\.net|script error|syntax error|unexpected token)\b/i) ||
    has(text, /==|!=/)
  ) {
    findings.push({
      id: 'vbnet-script-syntax',
      surface: 'script',
      confidence: has(text, /\b(bc30\d+|compile|compiler|vb\.net)\b/i) ? 'high' : 'medium',
      summary: 'The script error likely needs VB.NET syntax review rather than JavaScript-style syntax.',
      evidence: ['The log references compilation/syntax failure or operators that are commonly wrong in vMix VB.NET scripts.'],
      likelyCauses: [
        { confidence: 'high', cause: 'The script contains syntax that vMix VB.NET does not accept.' },
        { confidence: 'medium', cause: 'A loop, string concatenation, or named-parameter call is shaped for another language.' },
      ],
      safeNextChecks: [
        'Run vmix_validate_script on the exact script text before pasting it into vMix.',
        'Check for Dim declarations, = comparisons, & string concatenation, and Sleep() in long-running loops.',
        'Validate input references against the current preset or saved preset before execution.',
      ],
      confirmOrRuleOut: [
        'vmix_validate_script reports the same syntax class before any operator workflow runs it.',
        'The error points to a specific line or named vMix function call.',
      ],
      unknowns: ['The exact script text and the line number reported by vMix.'],
      relatedCorpusIds: ['TR-008'],
    });
  }

  if (
    sourceIs('vmix-api') ||
    (has(text, /\b(http\s*)?500\b/i) && has(text, /\b(input|selectedname|settext|title|function|shortcut)\b/i))
  ) {
    findings.push({
      id: 'vmix-api-ambiguous-input',
      surface: 'vmix-api',
      confidence: has(text, /\b500\b/i) ? 'medium' : 'low',
      summary: 'The vMix API failure may involve an ambiguous or invalid input/function reference.',
      evidence: ['The log references a vMix API/function failure and input or title-related parameters.'],
      likelyCauses: [
        { confidence: 'medium', cause: 'The call targets an input by a name/title that is duplicated or not exact.' },
        { confidence: 'medium', cause: 'The function arguments do not match the vMix shortcut-function syntax.' },
      ],
      safeNextChecks: [
        'Prefer stable input keys or validated exact input names over ambiguous titles.',
        'Use vmix_find_input before generating any vMix API plan.',
        'Use vmix_generate_api_sequence for a reviewable plan instead of making a raw API call.',
      ],
      confirmOrRuleOut: [
        'The same operation works when targeting an exact input key.',
        'vmix_find_input shows multiple plausible matches for the requested name.',
      ],
      unknowns: ['The exact input identity and function arguments used by the failing call.'],
      relatedCorpusIds: ['TR-009'],
    });
  }

  return findings.sort(
    (a, b) => confidenceWeight(b.confidence) - confidenceWeight(a.confidence) || b.evidence.length - a.evidence.length
  );
}

function buildDiagnosis(text: string, sourceHint: SourceHint) {
  const findings = collectFindings(text, sourceHint).slice(0, 4);

  if (findings.length === 0) {
    return {
      summary: 'No high-confidence known troubleshooting pattern matched this excerpt.',
      primarySurface: sourceHint === 'auto' ? 'unknown' : sourceHint,
      confidence: 'low' as Confidence,
      evidence: ['The excerpt did not include enough recognizable MCP, vMix, capture, audio, NDI, script, or API signals.'],
      likelyCauses: [{ confidence: 'low' as Confidence, cause: 'The log needs more surrounding context or a clearer error line.' }],
      safeNextChecks: [
        'Provide the exact error line plus the 10-20 lines before and after it.',
        'Include what changed immediately before the issue started.',
        'Keep secrets, vMix Call links, private IPs, and local paths redacted.',
      ],
      confirmOrRuleOut: ['A timestamped excerpt around the first error usually separates root cause from follow-on noise.'],
      unknowns: ['The affected surface, timestamp, recent change, and whether the symptom reproduces.'],
      warnings: [
        'Do not treat a generic or partial log excerpt as proof of hardware failure.',
        'Do not apply show-disruptive fixes without operator confirmation or rehearsal time.',
      ],
      relatedCorpusIds: [] as string[],
      findings: [] as LogFinding[],
    };
  }

  const top = findings[0]!;
  return {
    summary: top.summary,
    primarySurface: top.surface,
    confidence: top.confidence,
    evidence: unique(findings.flatMap((finding) => finding.evidence), 6),
    likelyCauses: findings.flatMap((finding) => finding.likelyCauses).slice(0, 6),
    safeNextChecks: unique(findings.flatMap((finding) => finding.safeNextChecks), 8),
    confirmOrRuleOut: unique(findings.flatMap((finding) => finding.confirmOrRuleOut), 8),
    unknowns: unique(findings.flatMap((finding) => finding.unknowns), 6),
    warnings: [
      'This is a read-only diagnosis from log text, not proof of root cause.',
      'Do not expose raw logs containing credentials, call links, private IPs, or local paths.',
    ],
    relatedCorpusIds: unique(findings.flatMap((finding) => finding.relatedCorpusIds), 8),
    findings,
  };
}

function readExplicitLogPath(path: string, maxBytes: number) {
  const trimmed = path.trim();
  if (trimmed === '') {
    return { ok: false as const, error: 'Provide a non-empty log file path.' };
  }

  const extension = extname(trimmed).toLowerCase();
  if (!ALLOWED_LOG_EXTENSIONS.has(extension)) {
    return {
      ok: false as const,
      error:
        'Log path must point to a plain text log file (.log, .txt, .json, .ndjson, .xml, .err, .stderr, or .stdout).',
    };
  }

  try {
    const stats = statSync(trimmed);
    if (!stats.isFile()) {
      return { ok: false as const, error: 'Log path must point to a single file; directories are not accepted.' };
    }
    if (stats.size > maxBytes) {
      return {
        ok: false as const,
        error: `Log file exceeds maxBytes (${maxBytes} bytes). Provide a smaller excerpt or raise maxBytes up to ${HARD_MAX_BYTES}.`,
      };
    }

    return {
      ok: true as const,
      text: readFileSync(trimmed, 'utf8'),
      originalBytes: stats.size,
      modifiedAt: stats.mtime.toISOString(),
    };
  } catch {
    return { ok: false as const, error: 'Log file was not found or is not accessible.' };
  }
}

export const diagnoseLogsTool = createTool({
  name: 'vmix_diagnose_logs',
  description:
    'Read-only Review Mode diagnosis for pasted vMix/MCP/device log text or one explicit log file. ' +
    'Redacts sensitive values, classifies likely causes with confidence, and returns safe next checks.',
  schema,
  handler: (params, _ctx: ToolContext) => {
    const hasContent = typeof params.content === 'string' && params.content.trim().length > 0;
    const hasPath = typeof params.path === 'string' && params.path.trim().length > 0;
    if (hasContent === hasPath) {
      return Promise.resolve(errorResult('Provide exactly one of content or path.'));
    }

    const maxBytes = params.maxBytes ?? DEFAULT_MAX_BYTES;
    const sourceHint = params.source ?? 'auto';
    const focus = params.focus ? redactLogText(params.focus).text : undefined;

    let rawText: string;
    let sourceMetadata:
      | {
          kind: 'content';
          originalBytes: number;
          analyzedBytes: number;
          truncated: boolean;
        }
      | {
          kind: 'path';
          originalBytes: number;
          analyzedBytes: number;
          truncated: false;
          modifiedAt: string;
          pathPolicy: string;
        };

    if (hasContent) {
      const truncated = truncateUtf8(params.content ?? '', maxBytes);
      rawText = truncated.text;
      sourceMetadata = {
        kind: 'content',
        originalBytes: truncated.originalBytes,
        analyzedBytes: Buffer.byteLength(rawText, 'utf8'),
        truncated: truncated.truncated,
      };
    } else {
      const loaded = readExplicitLogPath(params.path ?? '', maxBytes);
      if (!loaded.ok) {
        return Promise.resolve(errorResult(loaded.error));
      }
      rawText = loaded.text;
      sourceMetadata = {
        kind: 'path',
        originalBytes: loaded.originalBytes,
        analyzedBytes: Buffer.byteLength(rawText, 'utf8'),
        truncated: false,
        modifiedAt: loaded.modifiedAt,
        pathPolicy: 'explicit-file-only; no directory scanning; raw path is not echoed',
      };
    }

    const redacted = redactLogText(rawText);
    const diagnosis = buildDiagnosis(redacted.text, sourceHint);

    return Promise.resolve(
      toolJsonContent({
        tool: 'vmix_diagnose_logs',
        mode: 'review',
        readOnly: true,
        source: {
          ...sourceMetadata,
          sourceHint,
          focus,
          maxBytes,
        },
        diagnosis,
        sanitizedExcerpt: buildExcerpt(redacted.text),
        redactionSummary: redacted.summary,
        safetyNote:
          'This tool only analyzes explicit text or one explicit file. It does not scan folders, execute fixes, or mutate vMix.',
        relatedResources: {
          troubleshootingSkill: 'vmix://skills/vmix-troubleshooting',
          examples: 'vmix://docs/examples',
          productionPatterns: 'vmix://docs/production-patterns',
        },
      })
    );
  },
});

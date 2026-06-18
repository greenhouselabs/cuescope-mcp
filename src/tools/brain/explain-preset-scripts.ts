/**
 * vmix_explain_preset_scripts - Review stored .vmix scripts against live state.
 * Reuses the existing read-only script validator on each saved script's source.
 * Normalizes smart/curly quotes to straight before validation (vMix presets often
 * store curly quotes, which the validator's regexes do not match).
 */
import { z } from 'zod';
import { createTool, toolJsonContent, errorResult, type ToolContext } from '../base.js';
import { loadPresetFile } from '../../state/preset/preset-loader.js';
import { parsePresetFile } from '../../state/preset/preset-parser.js';
import { redactPresetFile } from '../../state/preset/preset-redaction.js';
import { validateScriptAgainstState } from './validate-script.js';
import { formatErrorMessage } from '../../errors/index.js';

const schema = z.object({
  path: z.string().optional().describe('Absolute path to a .vmix file on the server host.'),
  content: z.string().optional().describe('Raw .vmix XML, as an alternative to a path.'),
  scriptName: z.string().optional().describe('Optional: review only the script with this exact name.'),
});

function normalizeQuotes(source: string): string {
  return source.replace(/[""]/g, '"').replace(/['']/g, "'");
}

type ScriptSetSeverity = 'warning' | 'info';
type ScriptSetCategory = 'pairedSlotDrift' | 'slotPrecompute' | 'rowMapDrift' | 'sharedTalkbackBus';

interface ScriptSetFinding {
  severity: ScriptSetSeverity;
  category: ScriptSetCategory;
  message: string;
  scripts: string[];
  detail: string;
  recommendation: string;
  confidence: number;
}

interface ReviewableScript {
  name: string;
  source: string;
}

function usesLiveSlotResolution(source: string): boolean {
  return (
    /API\.XML\s*\(/i.test(source) &&
    /SelectNodes\s*\(\s*"overlay"\s*\)/i.test(source) &&
    /\.Item\s*\(\s*\d+\s*\)/i.test(source)
  );
}

function extractSlotItemIndexes(source: string): number[] {
  return [...new Set(
    [...source.matchAll(/\.Item\s*\(\s*(\d+)\s*\)/gi)]
      .map((match) => parseInt(match[1] ?? '', 10))
      .filter((value) => Number.isFinite(value))
  )].sort((left, right) => left - right);
}

function parseScriptPairName(name: string): { base: string; direction: 'on' | 'off' | 'in' | 'out' } | null {
  const match = name.match(/^(.*?)\s+(On|Off|In|Out)\s*$/i);
  if (!match?.[1] || !match[2]) return null;

  return {
    base: match[1].trim().toLowerCase(),
    direction: match[2].toLowerCase() as 'on' | 'off' | 'in' | 'out',
  };
}

function parseTargetedSlotNumber(name: string): number | null {
  const match = name.match(/\b(?:Mix|Slot|Layout)\s*(\d+)\b/i);
  if (!match?.[1]) return null;

  const value = parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}

function siblingFamilyName(name: string): string {
  return name
    .replace(/\b(Mix|Slot|Layout)\s*\d+\b/gi, '$1 #')
    .replace(/\s+(On|Off|In|Out)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDataSourceRowMap(source: string): Map<string, string> {
  const entries = new Map<string, string>();
  const caseRegex = /^\s*Case\s+"([^"]+)"([\s\S]*?)(?=^\s*Case\b|^\s*End\s+Select\b)/gim;

  for (const match of source.matchAll(caseRegex)) {
    const label = match[1]?.trim();
    const body = match[2] ?? '';
    const rowMatch = body.match(/API\.Function\s*\(\s*"DataSourceSelectRow"[\s\S]*?\bValue\s*:=\s*"([^"]+)"/i);

    if (label && rowMatch?.[1]) {
      entries.set(label, rowMatch[1]);
    }
  }

  return entries;
}

function extractAudioBusActions(source: string): Array<{ direction: 'on' | 'off'; input: string | null; buses: string[] }> {
  const actions: Array<{ direction: 'on' | 'off'; input: string | null; buses: string[] }> = [];
  const callRegex = /API\.Function\s*\(\s*"AudioBus(On|Off)"([^)]*)\)/gi;

  for (const match of source.matchAll(callRegex)) {
    const direction = match[1]?.toLowerCase() === 'off' ? 'off' : 'on';
    const paramText = match[2] ?? '';
    const input = paramText.match(/\bInput\s*:=\s*"([^"]+)"/i)?.[1] ?? null;
    const value = paramText.match(/\bValue\s*:=\s*"([^"]+)"/i)?.[1] ?? '';
    const buses = value.split(',').map((bus) => bus.trim()).filter((bus) => bus.length > 0);

    if (buses.length > 0) {
      actions.push({ direction, input, buses });
    }
  }

  return actions;
}

function usesCallReturnSwitch(source: string): boolean {
  return /API\.Function\s*\(\s*"VideoCallAudioSource"/i.test(source);
}

function overlappingBusNames(
  left: Array<{ buses: string[] }>,
  right: Array<{ buses: string[] }>
): string[] {
  const rightBuses = new Set(right.flatMap((action) => action.buses.map((bus) => bus.toUpperCase())));
  return [...new Set(
    left
      .flatMap((action) => action.buses)
      .filter((bus) => rightBuses.has(bus.toUpperCase()))
  )].sort((a, b) => a.localeCompare(b));
}

function buildScriptSetReview(scripts: ReviewableScript[]) {
  const findings: ScriptSetFinding[] = [];
  const pairs = new Map<string, Partial<Record<'on' | 'off' | 'in' | 'out', ReviewableScript>>>();
  const rowMaps = new Map<string, Array<{ script: ReviewableScript; rows: Map<string, string> }>>();

  for (const script of scripts) {
    const pair = parseScriptPairName(script.name);
    if (pair) {
      const existing = pairs.get(pair.base) ?? {};
      existing[pair.direction] = script;
      pairs.set(pair.base, existing);
    }

    const targetedSlot = parseTargetedSlotNumber(script.name);
    const slotIndexes = extractSlotItemIndexes(script.source);
    if (targetedSlot !== null && usesLiveSlotResolution(script.source) && slotIndexes.length >= 3) {
      findings.push({
        severity: 'warning',
        category: 'slotPrecompute',
        message: `${script.name} appears to target one slot but reads ${slotIndexes.length} slot position(s).`,
        scripts: [script.name],
        detail:
          `The script name targets Mix/Slot ${targetedSlot}, while the script reads overlay item indexes ${slotIndexes.join(', ')}. ` +
          'This may be intentional shared setup, but unrelated missing slots can break a per-slot action before it reaches the target slot.',
        recommendation:
          'For generated scripts, read only the needed slot unless the broader precompute is explicitly required and guarded.',
        confidence: 0.78,
      });
    }

    const rows = extractDataSourceRowMap(script.source);
    if (rows.size >= 2) {
      const family = siblingFamilyName(script.name).toLowerCase();
      const existing = rowMaps.get(family) ?? [];
      existing.push({ script, rows });
      rowMaps.set(family, existing);
    }
  }

  for (const pair of pairs.values()) {
    const candidates = [
      { first: pair.on, second: pair.off, label: 'On/Off' },
      { first: pair.in, second: pair.out, label: 'In/Out' },
    ];

    for (const candidate of candidates) {
      if (!candidate.first || !candidate.second) continue;
      if (!usesLiveSlotResolution(candidate.first.source) || !usesLiveSlotResolution(candidate.second.source)) continue;

      findings.push({
        severity: 'warning',
        category: 'pairedSlotDrift',
        message: `Paired ${candidate.label} scripts resolve live slot occupants independently.`,
        scripts: [candidate.first.name, candidate.second.name],
        detail:
          'If the multiview/layout slot changes between the first script and its companion script, the companion can act on a different current occupant than the one originally affected.',
        recommendation:
          'Prefer a paired design that stores the original target, uses a fixed caller/input when appropriate, or includes a clear all-reset companion.',
        confidence: 0.84,
      });

      if (candidate.label === 'On/Off' && usesCallReturnSwitch(candidate.first.source) && usesCallReturnSwitch(candidate.second.source)) {
        const onActions = extractAudioBusActions(candidate.first.source).filter((action) => action.direction === 'on');
        const offActions = extractAudioBusActions(candidate.second.source).filter((action) => action.direction === 'off');
        const sharedBuses = overlappingBusNames(onActions, offActions);

        if (sharedBuses.length > 0) {
          findings.push({
            severity: 'warning',
            category: 'sharedTalkbackBus',
            message: `Paired talkback scripts toggle a shared operator mic bus: ${sharedBuses.join(', ')}.`,
            scripts: [candidate.first.name, candidate.second.name],
            detail:
              'The Off script removes the operator/producer mic from a bus while the caller target is resolved from the current live slot. If another caller still hears that bus, talkback can disappear for them.',
            recommendation:
              'Use a clear all-talkback reset, a fixed caller target, or explicit state tracking when per-slot talkback buttons share one operator mic bus.',
            confidence: 0.8,
          });
        }
      }
    }
  }

  for (const siblings of rowMaps.values()) {
    if (siblings.length < 2) continue;

    const labels = [...new Set(siblings.flatMap((sibling) => [...sibling.rows.keys()]))].sort();
    const missing = siblings.flatMap((sibling) =>
      labels
        .filter((label) => !sibling.rows.has(label))
        .map((label) => `${sibling.script.name} missing "${label}"`)
    );
    const differingRows = labels.flatMap((label) => {
      const values = [...new Set(
        siblings
          .map((sibling) => sibling.rows.get(label))
          .filter((value): value is string => value !== undefined)
      )];
      return values.length > 1 ? [`"${label}" maps to ${values.join(' vs ')}`] : [];
    });

    if (missing.length === 0 && differingRows.length === 0) continue;

    findings.push({
      severity: 'warning',
      category: 'rowMapDrift',
      message: `Sibling scripts use different data-source row maps: ${siblings.map((sibling) => sibling.script.name).join(', ')}.`,
      scripts: siblings.map((sibling) => sibling.script.name),
      detail: [...missing, ...differingRows].join('; '),
      recommendation:
        'Verify whether row-map differences are intentional. For generated scripts, prefer one shared reviewed mapping table or clearly documented per-slot overrides.',
      confidence: 0.74,
    });
  }

  return {
    findingCount: findings.length,
    warnings: findings.filter((finding) => finding.severity === 'warning').length,
    info: findings.filter((finding) => finding.severity === 'info').length,
    findings,
  };
}

export const explainPresetScriptsTool = createTool({
  name: 'vmix_explain_preset_scripts',
  description:
    'Read-only review of VB.NET scripts stored in a saved .vmix preset. Explains each script and flags risks ' +
    '(unsafe loops, unknown functions, fragile input/field references) against current live state. Never executes scripts.',
  schema,
  handler: async (params: { path?: string; content?: string; scriptName?: string }, ctx: ToolContext) => {
    if (!params.path?.trim() && !params.content) {
      return errorResult('Provide either a .vmix file path or its content.');
    }
    try {
      const preset = redactPresetFile(parsePresetFile(loadPresetFile(params)));
      const state = await ctx.state.getState();
      const selected = params.scriptName
        ? preset.scripts.filter((s) => s.name === params.scriptName)
        : preset.scripts;
      const normalizedScripts = selected.map((script) => ({
        name: script.name,
        source: normalizeQuotes(script.source),
      }));
      // A saved script may legitimately reference inputs not in the current live
      // session (defined in the preset, or added dynamically like vMix Call inputs).
      // Validate against live state plus the preset, and treat truly-unknown inputs
      // as warnings rather than blocking errors.
      const presetInputs = preset.inputs.map((input) => ({ key: input.key, title: input.title }));
      const scripts = normalizedScripts.map((script) => {
        const validation = validateScriptAgainstState(state, script.source, {
          presetInputs,
          unresolvedInputSeverity: 'warning',
        });
        return {
          name: script.name,
          lineCount: script.source.split(/\r?\n/).length,
          valid: validation.valid,
          issueSummary: validation.issueSummary,
          issues: validation.issues,
          diagnostics: validation.scriptingDiagnostics,
          apiCalls: validation.apiCalls,
          recommendations: validation.recommendations,
        };
      });
      return toolJsonContent({
        source: preset.meta.source,
        freshnessNote: preset.meta.freshnessNote,
        meta: preset.meta,
        scriptCount: scripts.length,
        scriptSetReview: buildScriptSetReview(normalizedScripts),
        scripts,
        note: 'Scripts validated against live state plus the saved preset. Inputs present in neither (often dynamically-added or vMix Call inputs) are flagged as warnings, not blocking errors.',
      });
    } catch (error) {
      return errorResult(formatErrorMessage(error));
    }
  },
});

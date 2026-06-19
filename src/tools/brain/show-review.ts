/**
 * vmix_show_review - Natural-language show review orchestrator.
 *
 * Read-only coordinator for "check my show", "am I ready to go live", and
 * similar user intents. It combines compact live-state review, audio diagnosis,
 * preflight, and an operator checklist without requiring the user to know the
 * specialist tool parameters.
 */
import { z } from 'zod';
import { SERVER_BUILD_MARKER, SERVER_VERSION } from '../../version.js';
import { createTool, toolJsonContent, type ToolContext, type ToolResult } from '../base.js';
import { analyzeInput, findInputByNumber } from './analysis-helpers.js';
import { auditPresetFileTool } from './audit-preset-file.js';
import { diagnoseAudioTool } from './diagnose-audio.js';
import { diagnoseOutputsTool } from './diagnose-outputs.js';
import { generateShowChecklistTool } from './generate-show-checklist.js';
import { preflightTool } from './preflight.js';
import { buildProductionSummary } from './production-summary.js';

const ReviewIntentSchema = z
  .enum(['showReview', 'goLive', 'rehearsal', 'recovery', 'endShow', 'audio'])
  .default('showReview');

type ReviewIntent = z.infer<typeof ReviewIntentSchema>;
type ChecklistScenario = 'rehearsal' | 'goLive' | 'recovery' | 'endShow';

interface ShowReviewParams {
  intent?: ReviewIntent;
  presetPath?: string;
  presetContent?: string;
  includePassedChecks?: boolean;
}

interface ToolCallOk<T> {
  ok: true;
  data: T;
}

interface ToolCallError {
  ok: false;
  error: string;
}

type ToolCall<T> = ToolCallOk<T> | ToolCallError;

interface AudioIssueInput {
  number: number;
  title: string;
}

interface AudioIssue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  detail: string;
  recommendation: string;
  confidence: number;
  inputs?: AudioIssueInput[];
  buses?: string[];
}

interface AudioData {
  summary: {
    inputCount: number;
    likelyAudioSources: number;
    mutedRoutedInputs: number;
    unroutedLikelyAudioSources: number;
    remoteGuests: number;
    guestOrCallInputs: number;
    callerReturnCandidates: number;
    issueCounts: {
      total: number;
      critical: number;
      warning: number;
      info: number;
    };
  };
  issues: AudioIssue[];
  passingChecks: Array<{
    name: string;
    passed: boolean;
    detail: string;
  }>;
  analysisConfidence?: {
    score: number;
    level: string;
    summary: string;
  };
  savedPresetAudioEvidence?: {
    counts: {
      videoCallInputs: number;
      inputsWithSavedAudio: number;
    };
    callReturns: Array<{
      title: string;
      liveInputNumber: number | null;
      savedAudioBuses: string[];
      savedMuted: boolean | null;
      returnAudioIndex: number | null;
      returnVideoName: string | null;
      hasRedactedCallKey: boolean;
    }>;
    note: string;
  } | null;
  parserLimitations?: string[];
}

interface PreflightData {
  verdict: 'ready' | 'caution' | 'not-ready';
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
  program: {
    inputNumber: number | null;
    title: string | null;
  };
  preview: {
    inputNumber: number | null;
    title: string | null;
  };
  findings: Array<{
    severity: 'error' | 'warning' | 'info';
    category: string;
    message: string;
    detail?: string;
  }>;
}

interface ChecklistData {
  scenario: ChecklistScenario;
  preflight: {
    status: string;
    score: number;
    summary: string;
    blockers: string[];
    cautions: string[];
  };
  handoff: {
    recommendedDisposition: string;
    sections: Array<{
      id: string;
      title: string;
      status: 'ready' | 'review' | 'blocked';
      items: string[];
    }>;
  };
}

interface PresetAuditFinding {
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  detail?: string;
}

interface PresetAuditData {
  source: string;
  freshnessNote: string;
  meta: {
    modifiedAt?: string | null;
    presetVersion?: string | null;
  };
  findingSummary: {
    total: number;
    errors: number;
    warnings: number;
    info: number;
  };
  findings: PresetAuditFinding[];
  note: string;
}

interface OutputReadinessData {
  overallStatus: 'ready' | 'review' | 'blocked';
  readinessSummary: {
    disposition: 'ready' | 'needsVerification' | 'notArmed' | 'blocked';
    headline: string;
    detail: string;
    toneGuidance: string;
  };
  visibleOutputState: {
    recording: boolean;
    streaming: boolean;
    external: boolean;
    fadeToBlack: boolean;
    activeOutputCount: number;
    activeOutputs: string[];
    status?: string;
  };
  destinationChecks: Array<{
    id: string;
    label: string;
    status: 'pass' | 'info' | 'review' | 'blocked';
    visibleState: string;
    visibleFacts: string[];
  }>;
  videoPath: {
    status: 'pass' | 'info' | 'review' | 'blocked';
    mixDestinationAwareness: {
      parsedMixCount: number;
      canMapMixDestinations: boolean;
    };
    outputLikeInputs: unknown[];
    recommendation: string;
  };
  audioPath: {
    status: 'pass' | 'info' | 'review' | 'blocked';
    master: unknown;
    parsedAuxBusCount: number;
  };
  reviewItems: Array<{
    severity: 'critical' | 'warning' | 'info';
    category: string;
    message: string;
    evidence?: unknown;
    recommendation: string;
    confidence: number;
  }>;
  knownUnknowns: string[];
  recommendedNextSteps: string[];
}

async function runJsonTool<T>(label: string, run: () => Promise<ToolResult>): Promise<ToolCall<T>> {
  try {
    const result = await run();
    const text = result.content[0]?.text ?? '';
    if (result.isError) {
      return { ok: false, error: text || `${label} returned an error.` };
    }
    return { ok: true, data: JSON.parse(text) as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `${label} failed: ${message}` };
  }
}

function checklistScenarioFor(intent: ReviewIntent): ChecklistScenario {
  switch (intent) {
    case 'rehearsal':
      return 'rehearsal';
    case 'recovery':
      return 'recovery';
    case 'endShow':
      return 'endShow';
    case 'showReview':
    case 'goLive':
    case 'audio':
      return 'goLive';
  }
}

function compactAudioEvidence(evidence: AudioData['savedPresetAudioEvidence']) {
  if (!evidence) return null;
  return {
    counts: evidence.counts,
    callReturns: evidence.callReturns.map((call) => ({
      title: call.title,
      liveInputNumber: call.liveInputNumber,
      savedAudioBuses: call.savedAudioBuses,
      savedMuted: call.savedMuted,
      returnAudioIndex: call.returnAudioIndex,
      returnVideoName: call.returnVideoName,
      hasRedactedCallKey: call.hasRedactedCallKey,
    })),
    note: evidence.note,
  };
}

function summarizeAudio(call: ToolCall<AudioData>) {
  if (!call.ok) {
    return {
      status: 'unavailable' as const,
      error: call.error,
    };
  }

  const issues = call.data.issues ?? [];
  const reviewIssues = issues
    .filter((issue) => issue.severity !== 'info')
    .slice(0, 10)
    .map((issue) => ({
      severity: issue.severity,
      category: issue.category,
      title: issue.title,
      detail: issue.detail,
      buses: issue.buses ?? [],
      inputs: (issue.inputs ?? []).map((input) => ({
        number: input.number,
        title: input.title,
      })),
      recommendation: issue.recommendation,
      confidence: issue.confidence,
    }));

  return {
    status: 'available' as const,
    summary: call.data.summary,
    confidence: call.data.analysisConfidence ?? null,
    reviewIssues,
    informationalIssueCount: issues.filter((issue) => issue.severity === 'info').length,
    passingChecks: (call.data.passingChecks ?? []).map((check) => ({
      name: check.name,
      status: check.passed ? 'pass' : 'review',
      detail: check.detail,
    })),
    savedPresetAudioEvidence: compactAudioEvidence(call.data.savedPresetAudioEvidence ?? null),
    parserLimitations: call.data.parserLimitations ?? [],
  };
}

function summarizePreflight(call: ToolCall<PreflightData>) {
  if (!call.ok) {
    return {
      status: 'unavailable' as const,
      error: call.error,
    };
  }

  return {
    status: 'available' as const,
    verdict: call.data.verdict,
    summary: call.data.summary,
    program: call.data.program,
    preview: call.data.preview,
    reviewFindings: call.data.findings
      .filter((finding) => finding.severity !== 'info')
      .slice(0, 12)
      .map((finding) => ({
        severity: finding.severity,
        category: finding.category,
        message: finding.message,
        detail: finding.detail ?? null,
      })),
    informationalFindingCount: call.data.findings.filter((finding) => finding.severity === 'info').length,
  };
}

function summarizeChecklist(call: ToolCall<ChecklistData>) {
  if (!call.ok) {
    return {
      status: 'unavailable' as const,
      error: call.error,
    };
  }

  return {
    status: 'available' as const,
    scenario: call.data.scenario,
    preflight: call.data.preflight,
    recommendedDisposition: call.data.handoff.recommendedDisposition,
    sections: call.data.handoff.sections.slice(0, 8).map((section) => ({
      id: section.id,
      title: section.title,
      status: section.status,
      items: section.items.slice(0, 4),
      itemCount: section.items.length,
      truncated: section.items.length > 4,
    })),
    sectionCount: call.data.handoff.sections.length,
  };
}

function summarizePresetAudit(call: ToolCall<PresetAuditData> | null, requested: boolean) {
  if (!requested) {
    return {
      status: 'notRequested' as const,
      requested: false,
      findingSummary: null,
      reviewFindings: [],
      informationalFindingCount: 0,
      note: 'No saved preset path was supplied, so saved-preset audit findings were not included. Raw XML content is available as a fallback when a server-host path is unavailable.',
    };
  }

  if (!call?.ok) {
    return {
      status: 'unavailable' as const,
      requested: true,
      error: call?.error ?? 'Saved preset audit was requested but did not run.',
    };
  }

  const findings = call.data.findings ?? [];
  return {
    status: 'available' as const,
    requested: true,
    source: call.data.source,
    freshnessNote: call.data.freshnessNote,
    preset: {
      modifiedAt: call.data.meta.modifiedAt ?? null,
      presetVersion: call.data.meta.presetVersion ?? null,
    },
    findingSummary: call.data.findingSummary,
    reviewFindings: findings
      .filter((finding) => finding.severity !== 'info')
      .slice(0, 12)
      .map((finding) => ({
        severity: finding.severity,
        category: finding.category,
        message: finding.message,
        detail: finding.detail ?? null,
      })),
    informationalFindingCount: findings.filter((finding) => finding.severity === 'info').length,
    note: call.data.note,
  };
}

function summarizeOutputReadiness(call: ToolCall<OutputReadinessData>) {
  if (!call.ok) {
    return {
      status: 'unavailable' as const,
      error: call.error,
    };
  }

  return {
    status: 'available' as const,
    overallStatus: call.data.overallStatus,
    readinessSummary: call.data.readinessSummary,
    visibleOutputState: call.data.visibleOutputState,
    destinationChecks: call.data.destinationChecks.map((check) => ({
      id: check.id,
      label: check.label,
      status: check.status,
      visibleState: check.visibleState,
      visibleFacts: check.visibleFacts,
    })),
    videoPath: {
      status: call.data.videoPath.status,
      mixDestinationAwareness: call.data.videoPath.mixDestinationAwareness,
      outputLikeInputCount: call.data.videoPath.outputLikeInputs.length,
      recommendation: call.data.videoPath.recommendation,
    },
    audioPath: call.data.audioPath,
    reviewItems: call.data.reviewItems.slice(0, 10).map((item) => ({
      severity: item.severity,
      category: item.category,
      message: item.message,
      evidence: item.evidence,
      recommendation: item.recommendation,
      confidence: item.confidence,
    })),
    reviewItemCount: call.data.reviewItems.length,
    knownUnknowns: call.data.knownUnknowns,
    recommendedNextSteps: call.data.recommendedNextSteps,
  };
}

function overallStatus(args: {
  preflight: ReturnType<typeof summarizePreflight>;
  audio: ReturnType<typeof summarizeAudio>;
  outputReadiness: ReturnType<typeof summarizeOutputReadiness>;
  checklist: ReturnType<typeof summarizeChecklist>;
  presetAudit: ReturnType<typeof summarizePresetAudit>;
}): 'ready' | 'review' | 'blocked' {
  const preflight = args.preflight;
  const audio = args.audio;
  const outputReadiness = args.outputReadiness;
  const checklist = args.checklist;
  const presetAudit = args.presetAudit;

  if (preflight.status === 'available' && preflight.verdict === 'not-ready') return 'blocked';
  if (audio.status === 'available' && audio.summary.issueCounts.critical > 0) return 'blocked';
  if (outputReadiness.status === 'available' && outputReadiness.overallStatus === 'blocked') return 'blocked';
  if (checklist.status === 'available' && checklist.preflight.status === 'blocked') return 'blocked';
  if (presetAudit.status === 'available' && presetAudit.findingSummary.errors > 0) return 'blocked';
  if (preflight.status === 'available' && preflight.verdict === 'caution') return 'review';
  if (audio.status === 'available' && audio.summary.issueCounts.warning > 0) return 'review';
  if (outputReadiness.status === 'available' && outputReadiness.overallStatus === 'review') return 'review';
  if (presetAudit.status === 'available' && presetAudit.findingSummary.warnings > 0) return 'review';
  if (
    preflight.status === 'unavailable' ||
    audio.status === 'unavailable' ||
    outputReadiness.status === 'unavailable' ||
    checklist.status === 'unavailable' ||
    presetAudit.status === 'unavailable'
  ) {
    return 'review';
  }
  return 'ready';
}

function buildPresentationGuidance(args: {
  status: 'ready' | 'review' | 'blocked';
  preflight: ReturnType<typeof summarizePreflight>;
  audio: ReturnType<typeof summarizeAudio>;
  outputReadiness: ReturnType<typeof summarizeOutputReadiness>;
  checklist: ReturnType<typeof summarizeChecklist>;
  presetAudit: ReturnType<typeof summarizePresetAudit>;
}) {
  const blockedCategories: string[] = [];
  const cautionCategories: string[] = [];

  if (args.preflight.status === 'available') {
    if (args.preflight.verdict === 'not-ready') blockedCategories.push('preflight');
    if (args.preflight.verdict === 'caution') cautionCategories.push('preflight');
  } else {
    cautionCategories.push('preflight unavailable');
  }

  if (args.audio.status === 'available') {
    if (args.audio.summary.issueCounts.critical > 0) blockedCategories.push('audio');
    if (args.audio.summary.issueCounts.warning > 0) cautionCategories.push('audio');
  } else {
    cautionCategories.push('audio unavailable');
  }

  if (args.outputReadiness.status === 'available') {
    if (args.outputReadiness.overallStatus === 'blocked') blockedCategories.push('output readiness');
    if (args.outputReadiness.overallStatus === 'review') cautionCategories.push('output readiness');
  } else {
    cautionCategories.push('output readiness unavailable');
  }

  if (args.checklist.status === 'available') {
    if (args.checklist.preflight.status === 'blocked') blockedCategories.push('checklist');
    if (args.checklist.preflight.status === 'review') cautionCategories.push('checklist');
  } else {
    cautionCategories.push('checklist unavailable');
  }

  if (args.presetAudit.status === 'available') {
    if (args.presetAudit.findingSummary.errors > 0) blockedCategories.push('saved preset audit');
    if (args.presetAudit.findingSummary.warnings > 0) cautionCategories.push('saved preset audit');
  } else if (args.presetAudit.status === 'unavailable') {
    cautionCategories.push('saved preset audit unavailable');
  }

  const uniqueBlocked = [...new Set(blockedCategories)];
  const uniqueCautions = [...new Set(cautionCategories)];

  if (args.status === 'blocked') {
    return {
      statusLabel: 'blocked',
      headline: 'Blocked: resolve true blocker findings before going live.',
      blockedCategories: uniqueBlocked,
      cautionCategories: uniqueCautions,
      severityGuidance:
        'Use blocker language only for the listed blocked categories. Keep lesser findings under Priority checks or Cautions.',
      sectionLabels: {
        blockers: 'Blockers',
        priorityChecks: 'Priority checks',
        cautions: 'Cautions',
        passing: 'Looking good',
      },
    };
  }

  if (args.status === 'review') {
    return {
      statusLabel: 'caution',
      headline: 'Caution: no blockers found, but priority checks need operator review.',
      blockedCategories: uniqueBlocked,
      cautionCategories: uniqueCautions,
      severityGuidance:
        uniqueBlocked.length === 0
          ? 'Do not use blocker or red-alert wording when there are no blocked categories. Label serious warnings as Priority checks or Cautions.'
          : 'Use blocker language only for the listed blocked categories; label other warnings as Priority checks or Cautions.',
      sectionLabels: {
        blockers: 'Blockers',
        priorityChecks: 'Priority checks',
        cautions: 'Cautions',
        passing: 'Looking good',
      },
    };
  }

  return {
    statusLabel: 'ready',
    headline: 'Ready from parsed state; still verify destinations and operator intent by eye and ear.',
    blockedCategories: uniqueBlocked,
    cautionCategories: uniqueCautions,
    severityGuidance:
      'Use ready language for parsed state, then list external verification steps without implying they are failures.',
    sectionLabels: {
      blockers: 'Blockers',
      priorityChecks: 'Priority checks',
      cautions: 'Cautions',
      passing: 'Looking good',
    },
  };
}

export const showReviewTool = createTool({
  name: 'vmix_show_review',
  description:
    'Natural-language read-only show review for requests like "check my show", "am I ready to go live", ' +
    '"preflight this setup", or "check audio before the show". Orchestrates live-state review, audio diagnosis, ' +
    'output readiness, go-live preflight, checklist guidance, and compact saved-preset audit evidence when an explicit server-host .vmix path or raw XML fallback is supplied.',
  schema: z.object({
    intent: ReviewIntentSchema.optional().describe(
      'Review intent: showReview, goLive, rehearsal, recovery, endShow, or audio. Default: showReview.'
    ),
    presetPath: z
      .string()
      .optional()
      .describe('Optional explicit path to a saved .vmix preset on the CueScope server host for cross-reference. Never scanned automatically.'),
    presetContent: z
      .string()
      .optional()
      .describe('Optional raw .vmix XML content fallback when presetPath is unavailable. Secrets are redacted by downstream preset tools.'),
    includePassedChecks: z
      .boolean()
      .optional()
      .describe('Include passing audio/checklist checks where supported. Default: true.'),
  }),
  handler: async (
    {
      intent = 'showReview',
      presetPath,
      presetContent,
      includePassedChecks = true,
    }: ShowReviewParams,
    ctx: ToolContext
  ) => {
    const state = await ctx.state.getState();
    const inputs = state.inputs.map(analyzeInput);
    const productionSummary = buildProductionSummary(state, inputs);
    const program = state.active > 0 ? findInputByNumber(state, state.active) : null;
    const preview = state.preview > 0 ? findInputByNumber(state, state.preview) : null;
    const presetContextRequested = Boolean(presetPath?.trim() ?? presetContent);
    const presetParams = { presetPath, presetContent };
    const presetAuditParams = { path: presetPath, content: presetContent };
    const checklistScenario = checklistScenarioFor(intent);
    const presetAuditPromise = presetContextRequested
      ? runJsonTool<PresetAuditData>('vmix_audit_preset_file', () =>
          auditPresetFileTool.handler(presetAuditParams, ctx)
        )
      : Promise.resolve<ToolCall<PresetAuditData> | null>(null);

    const [preflightCall, audioCallWithPreset, outputReadinessCall, checklistCall, presetAuditCall] = await Promise.all([
      runJsonTool<PreflightData>('vmix_preflight', () => preflightTool.handler(presetParams, ctx)),
      runJsonTool<AudioData>('vmix_diagnose_audio', () =>
        diagnoseAudioTool.handler({ includeOk: includePassedChecks, ...presetParams }, ctx)
      ),
      runJsonTool<OutputReadinessData>('vmix_diagnose_outputs', () =>
        diagnoseOutputsTool.handler({ focus: 'goLive', includePassedChecks }, ctx)
      ),
      runJsonTool<ChecklistData>('vmix_generate_show_checklist', () =>
        generateShowChecklistTool.handler(
          { scenario: checklistScenario, includePassedChecks },
          ctx
        )
      ),
      presetAuditPromise,
    ]);

    const audioCall =
      audioCallWithPreset.ok || !presetContextRequested
        ? audioCallWithPreset
        : await runJsonTool<AudioData>('vmix_diagnose_audio_live_only_fallback', () =>
            diagnoseAudioTool.handler({ includeOk: includePassedChecks }, ctx)
          );

    const preflight = summarizePreflight(preflightCall);
    const audio = summarizeAudio(audioCall);
    const outputReadiness = summarizeOutputReadiness(outputReadinessCall);
    const checklist = summarizeChecklist(checklistCall);
    const presetAudit = summarizePresetAudit(presetAuditCall, presetContextRequested);
    const status = overallStatus({ preflight, audio, outputReadiness, checklist, presetAudit });
    const presentationGuidance = buildPresentationGuidance({
      status,
      preflight,
      audio,
      outputReadiness,
      checklist,
      presetAudit,
    });

    const presetContext = {
      requested: presetContextRequested,
      source: presetPath?.trim() ? 'presetPath' : presetContent ? 'presetContent' : null,
      savedAudioEvidenceIncluded:
        audio.status === 'available' && audio.savedPresetAudioEvidence !== null,
      savedPresetAuditIncluded: presetAudit.status === 'available',
      note: presetContextRequested
        ? 'Saved preset context was passed to tools that support it. Treat it as last-saved evidence, not proof of unsaved live changes.'
        : 'No saved preset path was supplied. Review is live-state only; ask for an explicit .vmix path on the CueScope server host if saved-preset context would improve confidence. Raw XML content is a fallback.',
      error:
        !audioCallWithPreset.ok && presetContextRequested
          ? audioCallWithPreset.error
          : null,
      auditError:
        presetAudit.status === 'unavailable'
          ? presetAudit.error
          : null,
    };

    const result = {
      mode: 'readOnlyShowReview',
      intent,
      overallStatus: status,
      presentationGuidance,
      server: {
        version: SERVER_VERSION,
        buildMarker: SERVER_BUILD_MARKER,
      },
      execution: {
        executed: false,
        note: 'This Review Mode review only reads state and saved preset data. It never calls mutating vMix functions.',
      },
      source: {
        vmixVersion: state.version,
        edition: state.edition,
        inputCount: state.inputs.length,
        program: {
          inputNumber: state.active,
          title: program?.title ?? null,
        },
        preview: {
          inputNumber: state.preview,
          title: preview?.title ?? null,
        },
        recording: state.recording,
        streaming: state.streaming,
        external: state.external,
        fadeToBlack: state.fadeToBlack,
      },
      presetContext,
      productionMap: {
        showPatterns: productionSummary.showPatterns.slice(0, 5),
        outputReadiness: {
          observed: productionSummary.outputReadiness.observed,
          risks: productionSummary.outputReadiness.risks.slice(0, 8),
          unknowns: productionSummary.outputReadiness.unknowns,
        },
        riskSummary: productionSummary.riskSummary,
      },
      preflight,
      audio,
      outputReadiness,
      presetAudit,
      checklist,
      recommendedNextSteps: [
        status === 'blocked'
          ? 'Resolve or explicitly accept every blocked item before going live or generating executable operator plans.'
          : status === 'review'
            ? 'Review and accept each caution item against the rundown before going live.'
            : 'Parsed state looks ready; still confirm visual output, destination feeds, platform health, and recording/stream settings by eye/ear.',
        presetContextRequested
          ? 'Use saved-preset findings as last-saved context and re-run after unsaved vMix changes.'
          : 'If a saved .vmix preset file is available, provide its explicit path for saved-preset cross-reference.',
        'Use specialist tools only when deeper detail is needed: vmix_diagnose_audio, vmix_diagnose_outputs, vmix_preflight, vmix_analyze_preset, vmix_audit_preset_file, or vmix_generate_show_checklist.',
      ],
      underlyingWorkflow: [
        {
          tool: 'vmix_preflight',
          usedSavedPresetContext: presetContextRequested,
          status: preflight.status,
        },
        {
          tool: 'vmix_diagnose_audio',
          usedSavedPresetContext: presetContextRequested,
          includeOk: includePassedChecks,
          status: audio.status,
        },
        {
          tool: 'vmix_diagnose_outputs',
          focus: 'goLive',
          includePassedChecks,
          status: outputReadiness.status,
        },
        {
          tool: 'vmix_generate_show_checklist',
          scenario: checklistScenario,
          includePassedChecks,
          status: checklist.status,
        },
        ...(presetContextRequested
          ? [
              {
                tool: 'vmix_audit_preset_file',
                usedSavedPresetContext: true,
                status: presetAudit.status,
              },
            ]
          : []),
      ],
      assumptions: [
        'This review is built from current parsed vMix XML plus optional explicitly supplied saved-preset data.',
        'Saved .vmix evidence may differ from unsaved live changes.',
        'Visual appearance, platform health, final destination bindings, and operator intent still require human confirmation.',
        'No private directories are scanned automatically; saved preset context requires an explicit path or content.',
      ],
    };

    return toolJsonContent(result);
  },
});

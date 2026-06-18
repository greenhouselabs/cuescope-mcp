/**
 * Operator-readable production summaries for Review Mode
 */

import type {
  AudioBusName,
  VmixAudioRouting,
  VmixOverlayChannel,
  VmixState,
} from '../../state/types.js';
import { createAudioRouting, createOverlayChannels } from '../../state/normalized-topology.js';
import {
  findInputByNumber,
  isLikelyOfflinePlaceholder,
  isLikelyAudioSource,
  type InputAnalysis,
  type ProductionRole,
} from './analysis-helpers.js';
import { findPairedAudioMappings, mappingUsesMaster } from './paired-audio.js';

type RiskSeverity = 'critical' | 'warning' | 'info';
type RiskCategory =
  | 'program'
  | 'preview'
  | 'overlay'
  | 'audio'
  | 'graphics'
  | 'roleDetection'
  | 'productionState';

interface ProductionSummaryInput {
  number: number;
  key: string;
  title: string;
  type: string;
  role: string;
  productionRole: ProductionRole;
  confidence: number;
  stableReference: string;
}

interface ProductionSummaryRisk {
  severity: RiskSeverity;
  category: RiskCategory;
  message: string;
  evidence: string[];
  recommendation: string;
}

interface ProductionOutputReadinessRisk {
  severity: RiskSeverity;
  message: string;
  evidence: string[];
  recommendation: string;
  confidence: number;
}

type PreflightStatus = 'go' | 'caution' | 'blocked';
type PreflightCheckStatus = 'pass' | 'info' | 'caution' | 'blocked';

interface PreflightCheck {
  id: string;
  label: string;
  status: PreflightCheckStatus;
  summary: string;
  evidence: string[];
  recommendation: string;
}

interface ProductionShowPattern {
  id: 'pairedAudioVideoShow' | 'remoteGuestMixMinusShow' | 'sportsReplayScorebugShow';
  label: string;
  confidence: number;
  summary: string;
  evidence: string[];
  caveats: string[];
  recommendedChecks: string[];
  docs: string[];
}

function summarizeInput(input: InputAnalysis): ProductionSummaryInput {
  return {
    number: input.number,
    key: input.key,
    title: input.title,
    type: input.type,
    role: input.role,
    productionRole: input.productionRole.primary.role,
    confidence: input.productionRole.primary.confidence,
    stableReference: input.stableReference,
  };
}

function summarizeInputs(inputs: InputAnalysis[]): ProductionSummaryInput[] {
  return inputs.map(summarizeInput);
}

function getInputAnalysis(inputs: InputAnalysis[], inputNumber: number | null): InputAnalysis | null {
  if (inputNumber === null) return null;
  return inputs.find((input) => input.number === inputNumber) ?? null;
}

function hasProductionRole(input: InputAnalysis, roles: ProductionRole[]): boolean {
  return roles.includes(input.productionRole.primary.role);
}

function buildShowMap(
  state: VmixState,
  inputs: InputAnalysis[],
  overlayChannels: VmixOverlayChannel[]
) {
  const program = getInputAnalysis(inputs, state.active);
  const preview = getInputAnalysis(inputs, state.preview);
  const activeOverlays = overlayChannels.filter((overlay) => overlay.active);

  return {
    program: {
      inputNumber: state.active,
      input: program ? summarizeInput(program) : null,
    },
    preview: {
      inputNumber: state.preview,
      input: preview ? summarizeInput(preview) : null,
    },
    mixes: (state.mixes ?? []).map((mix) => {
      const activeMixInput = getInputAnalysis(inputs, mix.active);
      const previewMixInput = getInputAnalysis(inputs, mix.preview);

      return {
        number: mix.number,
        activeInputNumber: mix.active,
        activeInput: summarizeNullableInput(activeMixInput),
        previewInputNumber: mix.preview,
        previewInput: summarizeNullableInput(previewMixInput),
      };
    }),
    overlays: activeOverlays.map((overlay) => ({
      channel: overlay.channel,
      inputNumber: overlay.inputNumber,
      inputTitle: overlay.inputTitle ?? null,
      input: summarizeNullableInput(getInputAnalysis(inputs, overlay.inputNumber)),
    })),
    productionState: {
      recording: state.recording,
      streaming: state.streaming,
      external: state.external,
      fadeToBlack: state.fadeToBlack,
    },
  };
}

function summarizeNullableInput(input: InputAnalysis | null): ProductionSummaryInput | null {
  return input ? summarizeInput(input) : null;
}

function buildInventories(inputs: InputAnalysis[]) {
  const liveSources = inputs.filter((input) =>
    hasProductionRole(input, ['hostCamera', 'guestCamera', 'callInput'])
  );
  const graphics = inputs.filter((input) =>
    hasProductionRole(input, ['lowerThird', 'scorebug', 'graphic'])
  );
  const media = inputs.filter((input) =>
    hasProductionRole(input, ['introOutro', 'replay', 'mediaPlayback'])
  );
  const audio = inputs.filter((input) =>
    hasProductionRole(input, ['music', 'audioSource']) || isLikelyAudioSource(input.role)
  );
  const compositions = inputs.filter((input) =>
    hasProductionRole(input, ['virtualSet', 'mixInput'])
  );

  return {
    liveSources: summarizeInputs(liveSources),
    graphics: summarizeInputs(graphics),
    media: summarizeInputs(media),
    audio: summarizeInputs(deduplicateInputs(audio)),
    compositions: summarizeInputs(compositions),
    unknown: summarizeInputs(inputs.filter((input) => input.productionRole.primary.role === 'unknown')),
  };
}

function deduplicateInputs(inputs: InputAnalysis[]): InputAnalysis[] {
  const seen = new Set<number>();
  const unique: InputAnalysis[] = [];

  for (const input of inputs) {
    if (seen.has(input.number)) continue;
    seen.add(input.number);
    unique.push(input);
  }

  return unique;
}

function buildGraphicsInventory(inputs: InputAnalysis[]) {
  const graphics = inputs.filter((input) =>
    hasProductionRole(input, ['lowerThird', 'scorebug', 'graphic'])
  );

  return {
    count: graphics.length,
    lowerThirds: summarizeInputs(
      graphics.filter((input) => input.productionRole.primary.role === 'lowerThird')
    ),
    scorebugs: summarizeInputs(
      graphics.filter((input) => input.productionRole.primary.role === 'scorebug')
    ),
    otherGraphics: summarizeInputs(
      graphics.filter((input) => input.productionRole.primary.role === 'graphic')
    ),
    fieldInputs: graphics
      .filter((input) => input.fieldNames.length > 0)
      .map((input) => ({
        ...summarizeInput(input),
        fieldNames: input.fieldNames,
      })),
  };
}

function buildAudioRoutingMap(inputs: InputAnalysis[], audioRouting: VmixAudioRouting) {
  const likelyAudioSources = inputs.filter((input) => isLikelyAudioSource(input.role));

  return {
    likelyAudioSources: likelyAudioSources.length,
    routedLikelyAudioSources: likelyAudioSources.filter((input) => input.audioBuses.length > 0).length,
    unroutedLikelyAudioSources: summarizeInputs(
      likelyAudioSources.filter((input) => input.audioBuses.length === 0)
    ),
    mutedRoutedInputs: summarizeInputs(
      inputs.filter((input) => input.muted && input.audioBuses.length > 0)
    ),
    buses: mapAudioBuses(inputs, audioRouting),
  };
}

function mapAudioBuses(inputs: InputAnalysis[], audioRouting: VmixAudioRouting) {
  const result = {} as Record<
    AudioBusName,
    {
      output: VmixAudioRouting['buses'][AudioBusName]['output'];
      inputCount: number;
      mutedInputCount: number;
      likelyGuestOrCallCount: number;
      inputs: ProductionSummaryInput[];
    }
  >;

  for (const [bus, summary] of Object.entries(audioRouting.buses) as [
    AudioBusName,
    VmixAudioRouting['buses'][AudioBusName],
  ][]) {
    const routedInputs = inputs.filter((input) => input.audioBuses.includes(bus));
    result[bus] = {
      output: summary.output,
      inputCount: routedInputs.length,
      mutedInputCount: routedInputs.filter((input) => input.muted).length,
      likelyGuestOrCallCount: routedInputs.filter((input) =>
        hasProductionRole(input, ['guestCamera', 'callInput'])
      ).length,
      inputs: summarizeInputs(routedInputs),
    };
  }

  return result;
}

function buildOverlayUsage(inputs: InputAnalysis[], overlayChannels: VmixOverlayChannel[]) {
  return {
    activeChannels: overlayChannels
      .filter((overlay) => overlay.active)
      .map((overlay) => {
        const input = getInputAnalysis(inputs, overlay.inputNumber);
        return {
          channel: overlay.channel,
          inputNumber: overlay.inputNumber,
          input: summarizeNullableInput(input),
          likelyGraphic: input
            ? hasProductionRole(input, ['lowerThird', 'scorebug', 'graphic'])
            : false,
        };
      }),
    emptyChannels: overlayChannels
      .filter((overlay) => !overlay.active)
      .map((overlay) => overlay.channel),
    graphicsOnOverlay: summarizeInputs(
      inputs.filter((input) =>
        hasProductionRole(input, ['lowerThird', 'scorebug', 'graphic']) &&
        overlayChannels.some((overlay) => overlay.inputNumber === input.number)
      )
    ),
  };
}

function buildOutputReadiness(
  state: VmixState,
  inputs: InputAnalysis[],
  audioRouting: VmixAudioRouting
) {
  const outputActive = state.recording || state.streaming || state.external;
  const activeOutputs = [
    state.recording ? 'recording' : null,
    state.streaming ? 'streaming' : null,
    state.external ? 'external' : null,
  ].filter((name): name is string => name !== null);
  const master = audioRouting.buses.M.output;
  const auxBuses = (Object.entries(audioRouting.buses) as [
    AudioBusName,
    VmixAudioRouting['buses'][AudioBusName],
  ][])
    .filter(([bus]) => bus !== 'M')
    .map(([bus, summary]) => ({
      bus,
      output: summary.output,
      inputCount: summary.inputs.length,
      audibleInputCount: summary.inputs.filter((input) => !input.muted).length,
    }));
  const auxOnlyAudibleInputs = inputs.filter(
    (input) =>
      input.audioBuses.length > 0 &&
      !input.audioBuses.includes('M') &&
      !input.muted &&
      (isLikelyAudioSource(input.role) ||
        ['hostCamera', 'guestCamera', 'callInput', 'music', 'audioSource'].includes(
          input.productionRole.primary.role
        ))
  );
  const risks: ProductionOutputReadinessRisk[] = [];

  if (outputActive && state.fadeToBlack) {
    risks.push({
      severity: 'critical',
      message: 'An output is active while Fade to Black is enabled.',
      evidence: [`active outputs: ${activeOutputs.join(', ')}`],
      recommendation: 'Confirm Fade to Black is intentional before trusting any live or recorded output.',
      confidence: 0.95,
    });
  }

  if (outputActive && master.muted === true) {
    risks.push({
      severity: 'critical',
      message: 'An output is active while Master audio is muted.',
      evidence: [`active outputs: ${activeOutputs.join(', ')}`],
      recommendation: 'Unmute Master or confirm the active output intentionally uses a different audio bus.',
      confidence: 0.92,
    });
  }

  if (outputActive && master.volume !== null && master.volume <= 0) {
    risks.push({
      severity: 'critical',
      message: 'An output is active while Master volume is at zero.',
      evidence: [`active outputs: ${activeOutputs.join(', ')}`, `Master volume: ${master.volume}`],
      recommendation: 'Raise Master volume or confirm the active output intentionally uses a different audio bus.',
      confidence: 0.92,
    });
  } else if (outputActive && master.volume !== null && master.volume < 25) {
    risks.push({
      severity: 'warning',
      message: 'An output is active while Master volume is low.',
      evidence: [`active outputs: ${activeOutputs.join(', ')}`, `Master volume: ${master.volume}`],
      recommendation: 'Check the actual stream/record/external audio path before relying on this level.',
      confidence: 0.76,
    });
  }

  if (outputActive && auxOnlyAudibleInputs.length > 0) {
    risks.push({
      severity: 'warning',
      message: 'Audible production audio is routed only to aux buses while an output is active.',
      evidence: auxOnlyAudibleInputs.map(
        (input) => `${input.number} ${input.title}: ${input.audioBuses.join(', ')}`
      ),
      recommendation:
        'Confirm those aux buses feed the intended stream, recording, monitor, or external output; otherwise route needed audio to Master.',
      confidence: 0.78,
    });
  }

  if (outputActive && (state.mixes?.length ?? 0) > 1) {
    risks.push({
      severity: state.external ? 'warning' : 'info',
      message: 'Multiple mix paths are parsed, but final output destination binding is not visible.',
      evidence: [
        `active outputs: ${activeOutputs.join(', ')}`,
        `parsed mixes: ${(state.mixes ?? []).map((mix) => mix.number).join(', ')}`,
      ],
      recommendation:
        'Confirm which mix feeds each stream, recording, fullscreen, external, NDI, SRT, or hardware destination before generating output-aware plans.',
      confidence: 0.72,
    });
  }

  return {
    observed: {
      recording: state.recording,
      streaming: state.streaming,
      external: state.external,
      fadeToBlack: state.fadeToBlack,
      activeOutputs,
      activeOutputCount: activeOutputs.length,
      status: state.fadeToBlack && outputActive ? 'blocked' : outputActive ? 'active' : 'idle',
    },
    audioOutputVisibility: {
      master,
      parsedAuxBusCount: auxBuses.filter((bus) => bus.output.parsed).length,
      auxBuses,
    },
    mixDestinationAwareness: {
      parsedMixCount: state.mixes?.length ?? 0,
      canMapMixDestinations: false,
      parsedMixes: (state.mixes ?? []).map((mix) => {
        const active = getInputAnalysis(inputs, mix.active);
        const preview = getInputAnalysis(inputs, mix.preview);

        return {
          number: mix.number,
          activeInputNumber: mix.active,
          activeInputTitle: active?.title ?? null,
          previewInputNumber: mix.preview,
          previewInputTitle: preview?.title ?? null,
        };
      }),
      note:
        'The MCP can parse mix active/preview paths, but current vMix XML does not prove which destination each mix feeds.',
    },
    risks,
    unknowns: [
      'stream platform/profile destination and health',
      'recording file format, path, and disk health',
      'which video mix feeds each output destination',
      'which audio bus feeds each stream/record/external destination',
      'fullscreen, NDI, SRT, and hardware output bindings',
    ],
    recommendedChecks: outputActive
      ? [
          'Confirm the active output destinations directly in vMix settings.',
          'Listen to the actual stream/record/external audio path, not only local meters.',
          'Confirm whether Master or an aux bus feeds each active destination.',
          'Confirm whether secondary mixes need explicit Mix parameters in any generated plan.',
        ]
      : [
          'Before going live, confirm stream/record/external destinations and which mix/audio bus each one uses.',
          'Run an output preflight after enabling recording, streaming, or external output.',
      ],
  };
}

function buildPreflightReport(
  state: VmixState,
  inputs: InputAnalysis[],
  overlayChannels: VmixOverlayChannel[],
  risks: ProductionSummaryRisk[],
  outputReadiness: ReturnType<typeof buildOutputReadiness>
) {
  const checks = [
    buildProgramPreviewPreflightCheck(state, inputs),
    buildAudioPreflightCheck(risks, outputReadiness.risks),
    buildOutputPreflightCheck(outputReadiness),
    buildGraphicsPreflightCheck(inputs, overlayChannels),
    buildOverlayPreflightCheck(risks, overlayChannels),
    buildMixPreflightCheck(state, outputReadiness),
    buildAutomationSafetyPreflightCheck(),
  ];
  const status = summarizePreflightStatus(checks);
  const blockers = checks.filter((check) => check.status === 'blocked');
  const cautions = checks.filter((check) => check.status === 'caution');

  return {
    status,
    score: scorePreflight(checks),
    summary: summarizePreflight(status, blockers.length, cautions.length),
    checks,
    blockers: blockers.map((check) => check.summary),
    cautions: cautions.map((check) => check.summary),
    operatorChecklist: buildOperatorChecklist(state, outputReadiness, blockers, cautions),
    knownUnknowns: [
      ...outputReadiness.unknowns,
      'operator intent, rundown timing, and whether current state is rehearsal or live',
      'actual visual appearance of Program, Preview, overlays, and clean feeds',
    ],
    recommendedNextTests: buildRecommendedNextTests(outputReadiness, checks),
  };
}

function summarizePreflightStatus(checks: PreflightCheck[]): PreflightStatus {
  if (checks.some((check) => check.status === 'blocked')) return 'blocked';
  if (checks.some((check) => check.status === 'caution')) return 'caution';
  return 'go';
}

function scorePreflight(checks: PreflightCheck[]): number {
  const penalty = checks.reduce((total, check) => {
    if (check.status === 'blocked') return total + 25;
    if (check.status === 'caution') return total + 10;
    if (check.status === 'info') return total + 2;
    return total;
  }, 0);

  return Math.max(0, 100 - penalty);
}

function summarizePreflight(status: PreflightStatus, blockerCount: number, cautionCount: number): string {
  if (status === 'blocked') {
    return `${blockerCount} blocker(s) must be resolved before trusting the show state.`;
  }

  if (status === 'caution') {
    return `${cautionCount} caution item(s) need operator review before go-live or automation.`;
  }

  return 'No blocking or caution-level preflight issues were detected from parsed state.';
}

function createPreflightCheck(check: PreflightCheck): PreflightCheck {
  return check;
}

function buildProgramPreviewPreflightCheck(state: VmixState, inputs: InputAnalysis[]): PreflightCheck {
  const program = getInputAnalysis(inputs, state.active);
  const preview = getInputAnalysis(inputs, state.preview);

  if (state.fadeToBlack) {
    return createPreflightCheck({
      id: 'programPreview',
      label: 'Program / Preview',
      status: 'blocked',
      summary: 'Fade to Black is active, so Program may be black.',
      evidence: ['state.fadeToBlack is true'],
      recommendation: 'Confirm Fade to Black is intentional before trusting Program output.',
    });
  }

  if (state.active > 0 && program === null) {
    return createPreflightCheck({
      id: 'programPreview',
      label: 'Program / Preview',
      status: 'blocked',
      summary: `Program references missing input ${state.active}.`,
      evidence: [`active input number is ${state.active}`],
      recommendation: 'Refresh state or inspect the preset before switching, recording, or streaming.',
    });
  }

  if (state.preview > 0 && preview === null) {
    return createPreflightCheck({
      id: 'programPreview',
      label: 'Program / Preview',
      status: 'caution',
      summary: `Preview references missing input ${state.preview}.`,
      evidence: [`preview input number is ${state.preview}`],
      recommendation: 'Refresh state or inspect Preview before planning a transition.',
    });
  }

  if (program && isLikelyOfflinePlaceholder(program)) {
    return createPreflightCheck({
      id: 'programPreview',
      label: 'Program / Preview',
      status: 'caution',
      summary: `Program is currently an offline/slate-style input: ${program.title}.`,
      evidence: [`program input: ${state.active}`, `input type: ${program.type}`],
      recommendation: 'Confirm this placeholder or slate is intentional before go-live or automation.',
    });
  }

  return createPreflightCheck({
    id: 'programPreview',
    label: 'Program / Preview',
    status: 'pass',
    summary: `Program is ${program?.title ?? 'empty'}; Preview is ${preview?.title ?? 'empty'}.`,
    evidence: [`program input: ${state.active}`, `preview input: ${state.preview}`],
    recommendation: 'Confirm this matches the rundown before go-live or automation.',
  });
}

function buildAudioPreflightCheck(
  risks: ProductionSummaryRisk[],
  outputRisks: ProductionOutputReadinessRisk[]
): PreflightCheck {
  const audioRisks = risks.filter((risk) => risk.category === 'audio');
  const relevantOutputRisks = outputRisks.filter((risk) =>
    /audio|master|aux|bus/i.test(`${risk.message} ${risk.recommendation}`)
  );
  const critical = [...audioRisks, ...relevantOutputRisks].filter((risk) => risk.severity === 'critical');
  const warnings = [...audioRisks, ...relevantOutputRisks].filter((risk) => risk.severity === 'warning');

  if (critical.length > 0) {
    return createPreflightCheck({
      id: 'audio',
      label: 'Audio',
      status: 'blocked',
      summary: `${critical.length} critical audio issue(s) were detected.`,
      evidence: critical.map((risk) => risk.message),
      recommendation: 'Resolve critical Program, Master, or output-audio blockers before going live.',
    });
  }

  if (warnings.length > 0) {
    return createPreflightCheck({
      id: 'audio',
      label: 'Audio',
      status: 'caution',
      summary: `${warnings.length} audio caution item(s) need review.`,
      evidence: warnings.map((risk) => risk.message),
      recommendation: 'Listen on the actual stream/record/output path and confirm intended bus routing.',
    });
  }

  return createPreflightCheck({
    id: 'audio',
    label: 'Audio',
    status: 'pass',
    summary: 'No critical or warning-level audio issues were detected from parsed state.',
    evidence: ['No audio risks at warning or critical severity.'],
    recommendation: 'Still perform an operator listen check on the destination feed.',
  });
}

function buildOutputPreflightCheck(
  outputReadiness: ReturnType<typeof buildOutputReadiness>
): PreflightCheck {
  const critical = outputReadiness.risks.filter((risk) => risk.severity === 'critical');
  const warnings = outputReadiness.risks.filter((risk) => risk.severity === 'warning');

  if (critical.length > 0) {
    return createPreflightCheck({
      id: 'outputs',
      label: 'Outputs',
      status: 'blocked',
      summary: `${critical.length} critical output issue(s) were detected.`,
      evidence: critical.map((risk) => risk.message),
      recommendation: 'Resolve output blockers before relying on recording, streaming, or external output.',
    });
  }

  if (warnings.length > 0) {
    return createPreflightCheck({
      id: 'outputs',
      label: 'Outputs',
      status: 'caution',
      summary: `${warnings.length} output caution item(s) need destination verification.`,
      evidence: warnings.map((risk) => risk.message),
      recommendation: 'Confirm stream, record, external, fullscreen, NDI, SRT, and hardware output bindings in vMix.',
    });
  }

  if (outputReadiness.observed.activeOutputCount === 0) {
    return createPreflightCheck({
      id: 'outputs',
      label: 'Outputs',
      status: 'info',
      summary: 'Recording, streaming, and external output are currently inactive.',
      evidence: ['No active output flags are true.'],
      recommendation: 'Run this preflight again after enabling any output for rehearsal or go-live.',
    });
  }

  return createPreflightCheck({
    id: 'outputs',
    label: 'Outputs',
    status: 'pass',
    summary: `Active outputs: ${outputReadiness.observed.activeOutputs.join(', ')}.`,
    evidence: outputReadiness.observed.activeOutputs,
    recommendation: 'Confirm destination health directly in vMix and the target platform or device.',
  });
}

function buildGraphicsPreflightCheck(
  inputs: InputAnalysis[],
  overlayChannels: VmixOverlayChannel[]
): PreflightCheck {
  const graphics = inputs.filter((input) =>
    hasProductionRole(input, ['lowerThird', 'scorebug', 'graphic'])
  );
  const fieldGraphics = graphics.filter((input) => input.fieldNames.length > 0);
  const activeGraphics = graphics.filter((input) =>
    overlayChannels.some((overlay) => overlay.inputNumber === input.number)
  );

  if (graphics.length === 0) {
    return createPreflightCheck({
      id: 'graphics',
      label: 'Graphics / Titles',
      status: 'info',
      summary: 'No obvious graphics or title inputs were detected.',
      evidence: ['graphics inventory count is 0'],
      recommendation: 'Confirm graphics are intentionally absent or rename graphics inputs for clearer detection.',
    });
  }

  return createPreflightCheck({
    id: 'graphics',
    label: 'Graphics / Titles',
    status: 'pass',
    summary: `${graphics.length} graphic/title input(s) detected; ${activeGraphics.length} are on overlays.`,
    evidence: fieldGraphics.map((input) => `${input.title}: ${input.fieldNames.join(', ')}`),
    recommendation: 'Confirm visible graphics, field values, and data-source freshness before go-live.',
  });
}

function buildOverlayPreflightCheck(
  risks: ProductionSummaryRisk[],
  overlayChannels: VmixOverlayChannel[]
): PreflightCheck {
  const overlayRisks = risks.filter((risk) => risk.category === 'overlay');
  const activeOverlays = overlayChannels.filter((overlay) => overlay.active);

  if (overlayRisks.length > 0) {
    return createPreflightCheck({
      id: 'overlays',
      label: 'Overlays',
      status: 'caution',
      summary: `${overlayRisks.length} overlay issue(s) need review.`,
      evidence: overlayRisks.map((risk) => risk.message),
      recommendation: 'Resolve stale or missing overlay input references before relying on overlay guidance.',
    });
  }

  return createPreflightCheck({
    id: 'overlays',
    label: 'Overlays',
    status: activeOverlays.length > 0 ? 'pass' : 'info',
    summary:
      activeOverlays.length > 0
        ? `${activeOverlays.length} overlay channel(s) are active.`
        : 'No overlay channels are currently active.',
    evidence: activeOverlays.map((overlay) => `Overlay ${overlay.channel}: ${overlay.inputTitle ?? overlay.inputNumber}`),
    recommendation: 'Confirm overlay state matches the rundown and clean-feed expectations.',
  });
}

function buildMixPreflightCheck(
  state: VmixState,
  outputReadiness: ReturnType<typeof buildOutputReadiness>
): PreflightCheck {
  const mixCount = state.mixes?.length ?? 0;

  if (mixCount > 1 && outputReadiness.observed.activeOutputCount > 0) {
    return createPreflightCheck({
      id: 'mixes',
      label: 'Mixes / Clean Feeds',
      status: 'caution',
      summary: `${mixCount} mix path(s) are parsed while output destinations are active or armed.`,
      evidence: outputReadiness.mixDestinationAwareness.parsedMixes.map(
        (mix) =>
          `Mix ${mix.number}: active ${mix.activeInputTitle ?? mix.activeInputNumber}, preview ${mix.previewInputTitle ?? mix.previewInputNumber}`
      ),
      recommendation: 'Confirm which mix feeds each active destination and use explicit Mix parameters when needed.',
    });
  }

  if (mixCount > 1) {
    return createPreflightCheck({
      id: 'mixes',
      label: 'Mixes / Clean Feeds',
      status: 'info',
      summary: `${mixCount} mix path(s) are parsed.`,
      evidence: outputReadiness.mixDestinationAwareness.parsedMixes.map(
        (mix) =>
          `Mix ${mix.number}: active ${mix.activeInputTitle ?? mix.activeInputNumber}, preview ${mix.previewInputTitle ?? mix.previewInputNumber}`
      ),
      recommendation: 'Confirm clean-feed and secondary mix destinations before any output-aware plan.',
    });
  }

  return createPreflightCheck({
    id: 'mixes',
    label: 'Mixes / Clean Feeds',
    status: 'pass',
    summary: 'No secondary mix path was detected in parsed state.',
    evidence: ['parsed mix count is 0 or 1'],
    recommendation: 'Use main Program/Preview assumptions unless the operator identifies another mix path.',
  });
}

function buildAutomationSafetyPreflightCheck(): PreflightCheck {
  return createPreflightCheck({
    id: 'automationSafety',
    label: 'Automation Safety',
    status: 'pass',
    summary: 'This preflight is read-only and does not execute vMix functions.',
    evidence: ['Review Mode analysis artifact only.'],
    recommendation: 'Validate any generated script or API plan before executing it in Control Mode.',
  });
}

function buildOperatorChecklist(
  state: VmixState,
  outputReadiness: ReturnType<typeof buildOutputReadiness>,
  blockers: PreflightCheck[],
  cautions: PreflightCheck[]
): string[] {
  const checklist = [
    'Resolve every blocked preflight check before going live or running automation.',
    'Review every caution check with the operator and confirm whether it is intentional.',
    'Confirm Program and Preview match the rundown.',
    'Listen to the actual destination feed, not only local meters.',
    'Confirm graphics, titles, clocks, and score fields are current.',
  ];

  if (outputReadiness.observed.activeOutputCount > 0) {
    checklist.push('Confirm active recording, streaming, external, and hardware destinations directly in vMix.');
  } else {
    checklist.push('Enable outputs only after confirming destination settings, then rerun preflight.');
  }

  if ((state.mixes?.length ?? 0) > 1) {
    checklist.push('Confirm which mix feeds each clean feed, screen, recording, stream, or external output.');
  }

  if (blockers.length === 0 && cautions.length === 0) {
    checklist.push('Run a short rehearsal transition and re-read state before show start.');
  }

  return checklist;
}

function buildRecommendedNextTests(
  outputReadiness: ReturnType<typeof buildOutputReadiness>,
  checks: PreflightCheck[]
): string[] {
  const tests = [
    'Re-read vmix://state/live after any operator change and compare the result.',
    'Run vmix_diagnose_audio before enabling recording or streaming.',
  ];

  if (outputReadiness.observed.activeOutputCount > 0) {
    tests.push('Record or monitor a short rehearsal output and verify video, audio, overlays, and clean-feed routing.');
  }

  if (checks.some((check) => check.id === 'mixes' && check.status !== 'pass')) {
    tests.push('Switch or preview each parsed mix in rehearsal and confirm the intended destination sees the correct feed.');
  }

  if (checks.some((check) => check.id === 'graphics' && check.status !== 'pass')) {
    tests.push('Inspect graphics manually or provide a screenshot because XML cannot prove rendered appearance.');
  }

  return tests;
}

function buildShowPatterns(state: VmixState, inputs: InputAnalysis[]): ProductionShowPattern[] {
  return [
    ...buildPairedAudioVideoShowPatterns(state),
    ...buildRemoteGuestMixMinusShowPatterns(state, inputs),
    ...buildSportsReplayScorebugShowPatterns(state, inputs),
  ];
}

function buildPairedAudioVideoShowPatterns(state: VmixState): ProductionShowPattern[] {
  const pairedMappings = findPairedAudioMappings(state);
  if (pairedMappings.length < 2) return [];

  const activeMapping = pairedMappings.find((mapping) => mapping.video.number === state.active);
  const mutedVideoCount = pairedMappings.filter((mapping) => mapping.video.muted).length;
  const pausedMusicCount = pairedMappings.filter((mapping) => mapping.music.state === 'Paused').length;
  const auxOnlyMusicCount = pairedMappings.filter((mapping) => !mappingUsesMaster(mapping)).length;
  const buses = [...new Set(pairedMappings.map((mapping) => mapping.bus))];
  const confidence = Math.min(
    0.94,
    0.62 +
      pairedMappings.length * 0.06 +
      (activeMapping ? 0.08 : 0) +
      (mutedVideoCount === pairedMappings.length ? 0.06 : 0)
  );

  return [
    {
      id: 'pairedAudioVideoShow',
      label: 'Paired silent-video/music-bed show',
      confidence: Number(confidence.toFixed(2)),
      summary:
        `${pairedMappings.length} video input(s) appear paired with separate music beds on shared aux bus(es): ` +
        `${buses.join(', ')}.`,
      evidence: pairedMappings.map(
        (mapping) =>
          `${mapping.video.number} ${mapping.video.title} -> ${mapping.music.number} ${mapping.music.title} on Bus ${mapping.bus}`
      ),
      caveats: [
        `${pausedMusicCount} paired music bed(s) are currently paused.`,
        `${auxOnlyMusicCount} paired music bed(s) are not routed to Master.`,
        'The MCP can see input-to-bus assignment, but final stream/record bus selection may need operator verification.',
      ],
      recommendedChecks: [
        'Confirm which bus feeds stream/recording output.',
        'Confirm whether matching music should restart or resume when a video hits Program.',
        'Confirm behavior when Program goes to an unmapped input.',
        'Target duplicate timer/title inputs by number or key, not shared title.',
      ],
      docs: [
        'vmix://docs/production-patterns',
        'vmix://docs/audio-routing',
        'vmix://docs/examples',
      ],
    },
  ];
}

function isRemoteGuestInput(input: InputAnalysis): boolean {
  return (
    input.role === 'remoteGuest' ||
    hasProductionRole(input, ['guestCamera', 'callInput'])
  );
}

function buildRemoteGuestMixMinusShowPatterns(
  state: VmixState,
  inputs: InputAnalysis[]
): ProductionShowPattern[] {
  const remoteGuests = inputs.filter(isRemoteGuestInput);
  if (remoteGuests.length === 0) return [];

  const guestsWithAux = remoteGuests.filter((input) => input.audioBuses.some((bus) => bus !== 'M'));
  const guestsWithoutAux = remoteGuests.filter((input) => input.audioBuses.every((bus) => bus === 'M'));
  const auxBuses = [...new Set(remoteGuests.flatMap((input) => input.audioBuses.filter((bus) => bus !== 'M')))];
  const sharedAuxBuses = auxBuses.filter(
    (bus) => remoteGuests.filter((input) => input.audioBuses.includes(bus)).length > 1
  );
  const hasCompositeProgram =
    state.active > 0 &&
    (findInputByNumber(state, state.active)?.layers ?? []).some((layer) =>
      remoteGuests.some(
        (guest) =>
          layer.input === guest.number ||
          (layer.key !== undefined && layer.key === guest.key) ||
          (layer.title !== undefined && layer.title === guest.title)
      )
    );
  const confidence = Math.min(
    0.94,
    0.58 +
      remoteGuests.length * 0.08 +
      (guestsWithAux.length > 0 ? 0.08 : 0) +
      (hasCompositeProgram ? 0.08 : 0)
  );

  return [
    {
      id: 'remoteGuestMixMinusShow',
      label: 'Remote guest / mix-minus show',
      confidence: Number(confidence.toFixed(2)),
      summary:
        `${remoteGuests.length} remote guest/call input(s) were detected` +
        (auxBuses.length > 0
          ? ` with visible aux-bus routing on ${auxBuses.join(', ')}.`
          : ' without visible aux-bus return routing.'),
      evidence: remoteGuests.map(
        (input) =>
          `${input.number} ${input.title}: routed to ${input.audioBuses.join(', ') || 'no visible buses'}`
      ),
      caveats: [
        'The MCP can see input bus assignments, but not every vMix Call return-bus or headphone destination.',
        `${guestsWithoutAux.length} guest/call input(s) have no visible aux return candidate.`,
        `${sharedAuxBuses.length} aux bus(es) contain more than one guest/call input.`,
      ],
      recommendedChecks: [
        'Confirm each remote guest hears a mix-minus feed that excludes their own audio.',
        'Confirm host/program audio is routed to each guest return bus intentionally.',
        'Confirm remote guests are routed to Master only when they should be heard on Program.',
        'Check vMix Call return settings directly before going live.',
      ],
      docs: [
        'vmix://docs/audio-routing',
        'vmix://docs/production-patterns',
        'vmix://docs/examples',
      ],
    },
  ];
}

function buildSportsReplayScorebugShowPatterns(
  state: VmixState,
  inputs: InputAnalysis[]
): ProductionShowPattern[] {
  const scorebugs = inputs.filter((input) => hasProductionRole(input, ['scorebug']));
  if (scorebugs.length === 0) return [];

  const replayInputs = inputs.filter((input) => hasProductionRole(input, ['replay']));
  const cameraInputs = inputs.filter((input) => hasProductionRole(input, ['hostCamera', 'guestCamera']));
  const mixInputs = inputs.filter((input) => hasProductionRole(input, ['mixInput']));
  const overlayChannels = state.overlayChannels ?? createOverlayChannels(state.overlays, state.inputs);
  const scorebugsOnOverlay = scorebugs.filter((scorebug) =>
    overlayChannels.some((overlay) => overlay.inputNumber === scorebug.number)
  );
  const mixEvidence = buildMixPathEvidence(state, inputs);

  if (replayInputs.length === 0 && cameraInputs.length < 2) return [];

  const confidence = Math.min(
    0.94,
    0.58 +
      scorebugs.length * 0.08 +
      (replayInputs.length > 0 ? 0.12 : 0) +
      (cameraInputs.length >= 2 ? 0.08 : 0) +
      (scorebugsOnOverlay.length > 0 ? 0.06 : 0) +
      (mixInputs.length > 0 ? 0.04 : 0)
  );

  return [
    {
      id: 'sportsReplayScorebugShow',
      label: 'Sports/replay show with scorebug',
      confidence: Number(confidence.toFixed(2)),
      summary:
        `${scorebugs.length} scorebug input(s)` +
        (replayInputs.length > 0 ? `, ${replayInputs.length} replay-like input(s)` : '') +
        `, and ${cameraInputs.length} camera-like source(s) were detected.`,
      evidence: [
        ...scorebugs.map(
          (input) =>
            `${input.number} ${input.title}: score fields ${input.fieldNames.join(', ') || 'not exposed'}`
        ),
        ...replayInputs.map((input) => `${input.number} ${input.title}: replay-like source`),
        ...scorebugsOnOverlay.map((input) => `${input.title} is assigned to an overlay channel`),
        ...mixInputs.map((input) => `${input.number} ${input.title}: mix/clean-feed input`),
        ...mixEvidence,
      ],
      caveats: [
        'Score and clock field values can be stale unless the operator confirms the data source or manual update workflow.',
        'Replay internals, selected event, replay channel, and replay recording state are not deeply parsed yet.',
        'Multi-mix or clean-feed output routing may affect a different destination than main Program.',
      ],
      recommendedChecks: [
        'Confirm the scorebug is on the intended overlay channel and shows current score/clock values.',
        'Confirm replay output should go to Program, Preview, or a secondary mix before any replay plan.',
        'Confirm replay audio is routed intentionally.',
        'Use explicit Mix parameters for multi-mix plans when the target output is not main Program.',
      ],
      docs: [
        'vmix://docs/production-patterns',
        'vmix://docs/examples',
      ],
    },
  ];
}

function buildMixPathEvidence(state: VmixState, inputs: InputAnalysis[]): string[] {
  return (state.mixes ?? []).map((mix) => {
    const active = getInputAnalysis(inputs, mix.active);
    const preview = getInputAnalysis(inputs, mix.preview);
    const activeLabel = active ? `${mix.active} ${active.title}` : String(mix.active);
    const previewLabel = preview ? `${mix.preview} ${preview.title}` : String(mix.preview);

    return `Mix ${mix.number}: active ${activeLabel}, preview ${previewLabel}`;
  });
}

function buildRiskWarnings(
  state: VmixState,
  inputs: InputAnalysis[],
  overlayChannels: VmixOverlayChannel[]
): ProductionSummaryRisk[] {
  const risks: ProductionSummaryRisk[] = [];
  const program = getInputAnalysis(inputs, state.active);
  const preview = getInputAnalysis(inputs, state.preview);
  const liveSources = inputs.filter((input) =>
    hasProductionRole(input, ['hostCamera', 'guestCamera', 'callInput'])
  );
  const graphics = inputs.filter((input) =>
    hasProductionRole(input, ['lowerThird', 'scorebug', 'graphic'])
  );

  if (state.fadeToBlack) {
    risks.push({
      severity: 'critical',
      category: 'productionState',
      message: 'Fade to Black is currently active.',
      evidence: ['state.fadeToBlack is true'],
      recommendation: 'Confirm this is intentional before assuming Program is visible.',
    });
  }

  if (state.active > 0 && program === null) {
    risks.push({
      severity: 'critical',
      category: 'program',
      message: `Program references input ${state.active}, but that input was not found.`,
      evidence: [`active input number is ${state.active}`],
      recommendation: 'Refresh state or inspect the preset before generating Program-aware guidance.',
    });
  }

  if (program && isLikelyOfflinePlaceholder(program)) {
    risks.push({
      severity: 'warning',
      category: 'program',
      message: `Program is currently an offline/slate-style input: ${program.title}.`,
      evidence: [`program input number is ${state.active}`, `input type is ${program.type}`],
      recommendation:
        'Confirm this placeholder or slate is intentional before trusting Program-aware go-live guidance.',
    });
  }

  if (state.preview > 0 && preview === null) {
    risks.push({
      severity: 'warning',
      category: 'preview',
      message: `Preview references input ${state.preview}, but that input was not found.`,
      evidence: [`preview input number is ${state.preview}`],
      recommendation: 'Refresh state or inspect Preview before planning a transition.',
    });
  }

  if (liveSources.length === 0) {
    risks.push({
      severity: 'warning',
      category: 'program',
      message: 'No obvious live host, guest, or call source was detected.',
      evidence: ['production-role inventory has zero live sources'],
      recommendation: 'Confirm whether this preset is media/graphics-only or rename camera/call inputs more clearly.',
    });
  }

  if (graphics.length === 0) {
    risks.push({
      severity: 'info',
      category: 'graphics',
      message: 'No obvious lower third, scorebug, or graphic input was detected.',
      evidence: ['production-role inventory has zero graphics'],
      recommendation: 'Confirm graphics are intentionally absent or use recognizable names/fields for graphics inputs.',
    });
  }

  addAudioRisks(risks, state, inputs);
  addOverlayRisks(risks, state, overlayChannels);
  addRoleConfidenceRisks(risks, inputs);

  return risks.sort((left, right) => severityRank(left.severity) - severityRank(right.severity));
}

function addAudioRisks(
  risks: ProductionSummaryRisk[],
  state: VmixState,
  inputs: InputAnalysis[]
): void {
  const routedMuted = inputs.filter((input) => input.muted && input.audioBuses.length > 0);
  const likelyAudioUnrouted = inputs.filter(
    (input) => isLikelyAudioSource(input.role) && input.audioBuses.length === 0
  );
  const program = getInputAnalysis(inputs, state.active);
  const pairedMappings = findPairedAudioMappings(state);
  const pairedVideoNumbers = new Set(pairedMappings.map((mapping) => mapping.video.number));
  const programPair = pairedMappings.find((mapping) => mapping.video.number === state.active);
  const unpairedRoutedMuted = routedMuted.filter((input) => !pairedVideoNumbers.has(input.number));
  const pairedRoutedMuted = routedMuted.filter((input) => pairedVideoNumbers.has(input.number));
  const guestsAndCalls = inputs.filter((input) =>
    hasProductionRole(input, ['guestCamera', 'callInput'])
  );

  if (program && program.muted && program.audioBuses.length > 0) {
    if (programPair) {
      risks.push({
        severity: 'warning',
        category: 'audio',
        message: `${program.title} is on Program and muted, but a paired music bed was inferred.`,
        evidence: [
          `video routed to ${program.audioBuses.join(', ')}`,
          `paired music candidate: ${programPair.music.title} on Bus ${programPair.bus}`,
        ],
        recommendation:
          'Verify the paired music track is playing and routed to the actual stream/record bus; do not unmute both video and music unless double audio is intended.',
      });
    } else {
      risks.push({
        severity: 'critical',
        category: 'audio',
        message: `${program.title} is on Program and muted while routed.`,
        evidence: [`routed to ${program.audioBuses.join(', ')}`],
        recommendation: `Unmute ${program.title} or confirm Program should be silent.`,
      });
    }
  }

  if (unpairedRoutedMuted.length > 0) {
    risks.push({
      severity: 'warning',
      category: 'audio',
      message: `${unpairedRoutedMuted.length} routed input(s) are muted.`,
      evidence: unpairedRoutedMuted.map((input) => `${input.title}: ${input.audioBuses.join(', ')}`),
      recommendation: 'Review whether these inputs should be heard or intentionally parked muted.',
    });
  }

  if (pairedRoutedMuted.length > 0) {
    risks.push({
      severity: 'info',
      category: 'audio',
      message: `${pairedRoutedMuted.length} muted routed video input(s) appear to have paired music-bed candidates.`,
      evidence: pairedRoutedMuted.map((input) => {
        const mapping = pairedMappings.find((candidate) => candidate.video.number === input.number);
        return mapping
          ? `${input.title} -> ${mapping.music.title} on Bus ${mapping.bus}`
          : `${input.title}: ${input.audioBuses.join(', ')}`;
      }),
      recommendation:
        'Treat muted video as intentional only after confirming the paired music track is playing and reaches the intended output.',
    });
  }

  if (likelyAudioUnrouted.length > 0) {
    risks.push({
      severity: 'warning',
      category: 'audio',
      message: `${likelyAudioUnrouted.length} likely audio source(s) have no visible bus routing.`,
      evidence: likelyAudioUnrouted.map((input) => input.title),
      recommendation: 'Route intentional audio sources to Master or the intended aux bus.',
    });
  }

  for (const input of guestsAndCalls) {
    const auxBuses = input.audioBuses.filter((bus) => bus !== 'M');
    if (!input.muted && input.audioBuses.includes('M') && auxBuses.length === 0) {
      risks.push({
        severity: 'warning',
        category: 'audio',
        message: `${input.title} has no obvious mix-minus return bus.`,
        evidence: [`${input.title} is routed only to Master`],
        recommendation: `Confirm how ${input.title} hears the show before relying on this routing.`,
      });
    }
  }
}

function addOverlayRisks(
  risks: ProductionSummaryRisk[],
  state: VmixState,
  overlayChannels: VmixOverlayChannel[]
): void {
  for (const overlay of overlayChannels) {
    if (overlay.inputNumber === null) continue;

    const input = findInputByNumber(state, overlay.inputNumber);
    if (!input) {
      risks.push({
        severity: 'warning',
        category: 'overlay',
        message: `Overlay channel ${overlay.channel} references missing input ${overlay.inputNumber}.`,
        evidence: [`overlay ${overlay.channel} input number is ${overlay.inputNumber}`],
        recommendation: 'Refresh state or clear the stale overlay assignment before relying on overlay guidance.',
      });
    }
  }
}

function addRoleConfidenceRisks(risks: ProductionSummaryRisk[], inputs: InputAnalysis[]): void {
  const lowConfidenceInputs = inputs.filter(
    (input) =>
      input.productionRole.primary.role !== 'unknown' &&
      input.productionRole.primary.confidence < 0.6
  );

  if (lowConfidenceInputs.length > 0) {
    risks.push({
      severity: 'info',
      category: 'roleDetection',
      message: `${lowConfidenceInputs.length} input(s) have low-confidence production-role detection.`,
      evidence: lowConfidenceInputs.map(
        (input) => `${input.title}: ${input.productionRole.primary.role}`
      ),
      recommendation: 'Treat these role labels as hints and prefer explicit input names or fields for automation.',
    });
  }
}

function severityRank(severity: RiskSeverity): number {
  const ranks: Record<RiskSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return ranks[severity];
}

export function buildPreflightReportForState(state: VmixState, inputs: InputAnalysis[]) {
  // Lean path for callers that need only the preflight report (e.g. the
  // automation handoff) without paying to build the full production summary.
  const overlayChannels = state.overlayChannels ?? createOverlayChannels(state.overlays, state.inputs);
  const audioRouting = state.audioRouting ?? createAudioRouting(state.inputs, state.audio);
  const risks = buildRiskWarnings(state, inputs, overlayChannels);
  const outputReadiness = buildOutputReadiness(state, inputs, audioRouting);
  return buildPreflightReport(state, inputs, overlayChannels, risks, outputReadiness);
}

export function buildProductionSummary(state: VmixState, inputs: InputAnalysis[]) {
  const overlayChannels = state.overlayChannels ?? createOverlayChannels(state.overlays, state.inputs);
  const audioRouting = state.audioRouting ?? createAudioRouting(state.inputs, state.audio);
  const risks = buildRiskWarnings(state, inputs, overlayChannels);
  const outputReadiness = buildOutputReadiness(state, inputs, audioRouting);

  return {
    showMap: buildShowMap(state, inputs, overlayChannels),
    showPatterns: buildShowPatterns(state, inputs),
    outputReadiness,
    preflightReport: buildPreflightReport(state, inputs, overlayChannels, risks, outputReadiness),
    inventory: buildInventories(inputs),
    graphicsInventory: buildGraphicsInventory(inputs),
    audioRouting: buildAudioRoutingMap(inputs, audioRouting),
    overlayUsage: buildOverlayUsage(inputs, overlayChannels),
    riskWarnings: risks,
    riskSummary: {
      total: risks.length,
      critical: risks.filter((risk) => risk.severity === 'critical').length,
      warning: risks.filter((risk) => risk.severity === 'warning').length,
      info: risks.filter((risk) => risk.severity === 'info').length,
    },
  };
}

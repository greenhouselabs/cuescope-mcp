/**
 * vmix_diagnose_audio - Read-only audio routing diagnostics
 */

import { z } from 'zod';
import { createTool, toolJsonContent, type ToolContext } from '../base.js';
import type { VmixState } from '../../state/types.js';
import { getAudioChannel } from '../../state/normalized-topology.js';
import { loadPresetFile } from '../../state/preset/preset-loader.js';
import { parsePresetFile } from '../../state/preset/preset-parser.js';
import { redactPresetFile } from '../../state/preset/preset-redaction.js';
import type { PresetFile, PresetInput } from '../../state/preset/preset-types.js';
import { normalizeInputKey } from '../../utils/input-normalizer.js';
import { assumptionDetail, average, buildAnalysisConfidence } from './analysis-metadata.js';
import {
  analyzeInput,
  AUDIO_BUS_NAMES,
  buildAudioBusMap,
  findInputByNumber,
  isLikelyAudioSource,
  type AudioBusName,
  type InputAnalysis,
} from './analysis-helpers.js';
import { findPairedAudioMappings } from './paired-audio.js';

type AuxBusName = Exclude<AudioBusName, 'M'>;
type Severity = 'critical' | 'warning' | 'info';
type IssueCategory =
  | 'outputBus'
  | 'inputMute'
  | 'routing'
  | 'programAudio'
  | 'mixMinus'
  | 'feedbackLoop'
  | 'monitoring';

interface IssueInput {
  number: number;
  title: string;
  role: string;
  productionRole: string;
  productionRoleConfidence: number;
  stableReference: string;
  muted: boolean;
  audioBuses: string[];
}

interface AudioIssue {
  severity: Severity;
  category: IssueCategory;
  title: string;
  detail: string;
  inputs: IssueInput[];
  buses: string[];
  recommendation: string;
  confidence: number;
}

interface OutputBusSummary {
  bus: AudioBusName;
  output: {
    parsed: boolean;
    muted: boolean | null;
    volume: number | null;
  };
  inputCount: number;
  audibleInputCount: number;
  mutedInputCount: number;
  inputs: IssueInput[];
}

interface DiagnoseAudioParams {
  includeOk?: boolean;
  presetPath?: string;
  presetContent?: string;
}

const AUX_BUS_NAMES = AUDIO_BUS_NAMES.filter((bus): bus is AuxBusName => bus !== 'M');

function toIssueInput(input: InputAnalysis): IssueInput {
  return {
    number: input.number,
    title: input.title,
    role: input.role,
    productionRole: input.productionRole.primary.role,
    productionRoleConfidence: input.productionRole.primary.confidence,
    stableReference: input.stableReference,
    muted: input.muted,
    audioBuses: input.audioBuses,
  };
}

function isGuestOrCallInput(input: InputAnalysis): boolean {
  return (
    input.role === 'remoteGuest' ||
    input.productionRole.primary.role === 'callInput' ||
    input.productionRole.primary.role === 'guestCamera'
  );
}

function isLikelyProductionAudioSource(input: InputAnalysis): boolean {
  return (
    isLikelyAudioSource(input.role) ||
    ['hostCamera', 'guestCamera', 'callInput', 'music', 'audioSource'].includes(
      input.productionRole.primary.role
    )
  );
}

function describeAudioSource(input: InputAnalysis): string {
  const productionRole = input.productionRole.primary.role;
  if (productionRole !== 'unknown') return productionRole;
  return input.role;
}

function isLikelyParkedInput(
  input: InputAnalysis,
  placement: { program: boolean; preview: boolean }
): boolean {
  return input.muted && !placement.program && !placement.preview;
}

function buildBusSummaries(state: VmixState, inputs: InputAnalysis[]): OutputBusSummary[] {
  const busMap = buildAudioBusMap(inputs);

  return AUDIO_BUS_NAMES.map((bus) => {
    const routedInputs = busMap[bus] ?? [];
    const output = getAudioChannel(state.audio, bus);

    return {
      bus,
      output: {
        parsed: output !== null,
        muted: output?.muted ?? null,
        volume: output?.volume ?? null,
      },
      inputCount: routedInputs.length,
      audibleInputCount: routedInputs.filter((input) => !input.muted).length,
      mutedInputCount: routedInputs.filter((input) => input.muted).length,
      inputs: routedInputs.map(toIssueInput),
    };
  });
}

function createIssue(args: AudioIssue): AudioIssue {
  return {
    ...args,
    confidence: Number(args.confidence.toFixed(2)),
  };
}

function buildOutputBusIssues(busSummaries: OutputBusSummary[]): AudioIssue[] {
  const issues: AudioIssue[] = [];

  for (const summary of busSummaries) {
    const hasRoutedInputs = summary.inputCount > 0;
    const isMaster = summary.bus === 'M';
    const busLabel = isMaster ? 'Master' : `Bus ${summary.bus}`;

    if (summary.output.muted === true && (hasRoutedInputs || isMaster)) {
      issues.push(
        createIssue({
          severity: isMaster ? 'critical' : 'warning',
          category: 'outputBus',
          title: `${busLabel} output is muted`,
          detail: `${busLabel} is muted while ${summary.inputCount} input(s) are routed there.`,
          inputs: summary.inputs,
          buses: [summary.bus],
          recommendation: `Unmute ${busLabel} or move the affected inputs to an audible bus before relying on this route.`,
          confidence: 0.95,
        })
      );
    }

    if (summary.output.volume !== null && summary.output.volume <= 0 && (hasRoutedInputs || isMaster)) {
      issues.push(
        createIssue({
          severity: isMaster ? 'critical' : 'warning',
          category: 'outputBus',
          title: `${busLabel} output volume is at zero`,
          detail: `${busLabel} volume is ${summary.output.volume}, so routed audio will not be heard on that output.`,
          inputs: summary.inputs,
          buses: [summary.bus],
          recommendation: `Raise ${busLabel} volume or confirm this bus is intentionally silent.`,
          confidence: 0.95,
        })
      );
    } else if (
      summary.output.volume !== null &&
      summary.output.volume < 25 &&
      (hasRoutedInputs || isMaster)
    ) {
      issues.push(
        createIssue({
          severity: 'warning',
          category: 'outputBus',
          title: `${busLabel} output volume is very low`,
          detail: `${busLabel} volume is ${summary.output.volume}, which may be quieter than expected.`,
          inputs: summary.inputs,
          buses: [summary.bus],
          recommendation: `Verify ${busLabel} level against the intended stream, recording, or monitor destination.`,
          confidence: 0.8,
        })
      );
    }

    if (!summary.output.parsed && hasRoutedInputs) {
      issues.push(
        createIssue({
          severity: 'info',
          category: 'outputBus',
          title: `${busLabel} has routed inputs but no parsed output state`,
          detail: `${summary.inputCount} input(s) are routed to ${busLabel}, but the current XML parser did not expose that bus mute/volume state.`,
          inputs: summary.inputs,
          buses: [summary.bus],
          recommendation: `Review ${busLabel} directly in vMix if this bus feeds a caller, monitor, stream, or recording.`,
          confidence: 0.65,
        })
      );
    }
  }

  return issues;
}

function buildInputRoutingIssues(state: VmixState, inputs: InputAnalysis[]): AudioIssue[] {
  const issues: AudioIssue[] = [];
  const pairedMappings = findPairedAudioMappings(state);

  for (const input of inputs) {
    const isProgram = state.active === input.number;
    const isPreview = state.preview === input.number;
    const likelyParked = isLikelyParkedInput(input, { program: isProgram, preview: isPreview });
    const pairedMapping = pairedMappings.find((mapping) => mapping.video.number === input.number);

    if (input.muted && input.audioBuses.length > 0) {
      issues.push(
        createIssue({
          severity: pairedMapping
            ? (isProgram ? 'warning' : 'info')
            : isProgram
              ? 'critical'
              : isPreview
                ? 'warning'
                : 'info',
          category: isProgram ? 'programAudio' : 'inputMute',
          title: pairedMapping
            ? `${input.title} is muted while paired music bed is inferred`
            : `${input.title} is muted while routed`,
          detail: pairedMapping
            ? `${input.title} is routed to ${input.audioBuses.join(', ')} and muted, but ${pairedMapping.music.title} shares Bus ${pairedMapping.bus} as a likely music bed.${
                isProgram ? ' It is currently on Program.' : ''
              }`
            : `${input.title} is routed to ${input.audioBuses.join(', ')} but muted at the input level.${
                isProgram ? ' It is currently on Program.' : ''
              }${likelyParked ? ' It is muted and not on Program or Preview, so it may be intentionally parked.' : ''}`,
          inputs: [toIssueInput(input)],
          buses: input.audioBuses,
          recommendation: pairedMapping
            ? `Verify ${pairedMapping.music.title} is playing and reaches the intended output. Do not unmute both video and music unless double audio is intended.`
            : likelyParked
              ? `Confirm ${input.title} is intentionally parked; unmute it only if it should be active in this show state.`
              : `Unmute ${input.title} or remove it from buses where it should not be heard.`,
          confidence: pairedMapping ? 0.78 : likelyParked ? 0.72 : 0.96,
        })
      );
    }

    if (isLikelyProductionAudioSource(input) && input.audioBuses.length === 0) {
      issues.push(
        createIssue({
          severity: isProgram ? 'critical' : likelyParked ? 'info' : 'warning',
          category: isProgram ? 'programAudio' : 'routing',
          title: `${input.title} has no visible audio bus routing`,
          detail: `${input.title} looks like an audio-capable ${describeAudioSource(input)} input, but no buses are visible in the current XML.${
            isProgram ? ' It is currently on Program.' : isPreview ? ' It is currently on Preview.' : ''
          }${likelyParked ? ' It is muted and not on Program or Preview, so it may be intentionally parked.' : ''}`,
          inputs: [toIssueInput(input)],
          buses: [],
          recommendation: likelyParked
            ? `Confirm ${input.title} is intentionally parked or route it to the expected bus before making it active.`
            : `Route ${input.title} to Master or the intended aux bus, or confirm it is intentionally silent.`,
          confidence: likelyParked ? 0.7 : 0.82,
        })
      );
    }

    if (
      isProgram &&
      isLikelyProductionAudioSource(input) &&
      !input.muted &&
      input.audioBuses.length > 0 &&
      !input.audioBuses.includes('M')
    ) {
      issues.push(
        createIssue({
          severity: 'warning',
          category: 'programAudio',
          title: `${input.title} is on Program but not routed to Master`,
          detail: `${input.title} is routed to ${input.audioBuses.join(', ')} but not Master, so it may be absent from the main program output.`,
          inputs: [toIssueInput(input)],
          buses: input.audioBuses,
          recommendation: `Add Master routing for ${input.title} if it should be heard on the stream or main recording.`,
          confidence: 0.78,
        })
      );
    }
  }

  return issues;
}

function buildMixMinusIssues(inputs: InputAnalysis[]): AudioIssue[] {
  const issues: AudioIssue[] = [];
  const remoteGuests = inputs.filter(isGuestOrCallInput);

  for (const guest of remoteGuests) {
    const auxBuses = guest.audioBuses.filter((bus) => bus !== 'M');

    if (!guest.muted && guest.audioBuses.includes('M') && auxBuses.length === 0) {
      issues.push(
        createIssue({
          severity: 'warning',
          category: 'mixMinus',
          title: `${guest.title} has no obvious mix-minus return bus`,
          detail: `${guest.title} is routed only to Master. That may be correct for program audio, but no aux bus is visible for a caller return or mix-minus path.`,
          inputs: [toIssueInput(guest)],
          buses: guest.audioBuses,
          recommendation: `Confirm how ${guest.title} hears the show, and use a dedicated aux bus if this caller needs mix-minus.`,
          confidence: 0.72,
        })
      );
    }

    if (!guest.muted && guest.audioBuses.length > 0 && !guest.audioBuses.includes('M')) {
      issues.push(
        createIssue({
          severity: 'info',
          category: 'monitoring',
          title: `${guest.title} is not routed to Master`,
          detail: `${guest.title} is routed to ${guest.audioBuses.join(', ')} only. This may be intentional for a return/feed bus, but it will not be heard on Master.`,
          inputs: [toIssueInput(guest)],
          buses: guest.audioBuses,
          recommendation: `Confirm whether ${guest.title} should be audible in the main program mix.`,
          confidence: 0.68,
        })
      );
    }
  }

  for (const bus of AUX_BUS_NAMES) {
    const guestsOnBus = remoteGuests.filter((guest) => guest.audioBuses.includes(bus));

    if (guestsOnBus.length > 1) {
      issues.push(
        createIssue({
          severity: 'warning',
          category: 'mixMinus',
          title: `Multiple remote guests share Bus ${bus}`,
          detail: `${guestsOnBus.map((guest) => guest.title).join(', ')} are all routed to Bus ${bus}. If Bus ${bus} is used as a caller return, this can create caller foldback or mix-minus mistakes.`,
          inputs: guestsOnBus.map(toIssueInput),
          buses: [bus],
          recommendation: `Verify Bus ${bus} does not send a guest their own audio, or split callers across dedicated return buses.`,
          confidence: 0.7,
        })
      );
      issues.push(
        createIssue({
          severity: 'warning',
          category: 'feedbackLoop',
          title: `Bus ${bus} may send callers their own audio`,
          detail: `${guestsOnBus.map((guest) => guest.title).join(', ')} are routed to Bus ${bus}. If Bus ${bus} is selected as a vMix Call return, a caller may hear their own audio or another caller instead of a clean mix-minus.`,
          inputs: guestsOnBus.map(toIssueInput),
          buses: [bus],
          recommendation: `If Bus ${bus} is a shared caller return, it is safe only when every caller monitoring it should hear the same caller-safe mix and the bus excludes any caller audio that must not fold back. If callers need different mixes, use dedicated return buses per caller.`,
          confidence: 0.66,
        })
      );
    }
  }

  return issues;
}

function buildMonitoringIssues(
  inputs: InputAnalysis[],
  busSummaries: OutputBusSummary[]
): AudioIssue[] {
  const issues: AudioIssue[] = [];
  const master = busSummaries.find((summary) => summary.bus === 'M');
  const auxWithAudibleInputs = busSummaries.filter(
    (summary) => summary.bus !== 'M' && summary.audibleInputCount > 0
  );
  const auxOnlyInputs = inputs.filter(
    (input) =>
      isLikelyProductionAudioSource(input) &&
      !isGuestOrCallInput(input) &&
      !input.muted &&
      input.audioBuses.length > 0 &&
      !input.audioBuses.includes('M')
  );

  for (const input of auxOnlyInputs) {
    issues.push(
      createIssue({
        severity: 'info',
        category: 'monitoring',
        title: `${input.title} is routed only to aux buses`,
        detail: `${input.title} looks like ${describeAudioSource(input)} audio and is routed to ${input.audioBuses.join(', ')} but not Master. This may be intentional for a monitor, return, or recording feed, but it will not be heard in the main program mix.`,
        inputs: [toIssueInput(input)],
        buses: input.audioBuses,
        recommendation: `Confirm what ${input.audioBuses.join(', ')} feeds. Add Master routing only if ${input.title} should be heard on a Master-fed stream or recording.`,
        confidence: 0.72,
      })
    );
  }

  if (master?.audibleInputCount === 0 && auxWithAudibleInputs.length > 0) {
    issues.push(
      createIssue({
        severity: 'warning',
        category: 'monitoring',
        title: 'Aux buses have audible inputs while Master has none',
        detail: `${auxWithAudibleInputs
          .map((summary) => `Bus ${summary.bus}: ${summary.audibleInputCount}`)
          .join(', ')} audible input(s), while Master has no audible routed inputs. This can indicate monitor/return routing is being confused with the main program mix.`,
        inputs: auxWithAudibleInputs.flatMap((summary) => summary.inputs),
        buses: auxWithAudibleInputs.map((summary) => summary.bus),
        recommendation: 'Confirm whether the main stream/recording should use Master or an aux bus, then route program audio accordingly.',
        confidence: 0.78,
      })
    );
  }

  return issues;
}

function buildPassingChecks(
  inputs: InputAnalysis[],
  busSummaries: OutputBusSummary[],
  issues: AudioIssue[]
) {
  const hasIssue = (category: IssueCategory) => issues.some((issue) => issue.category === category);
  const master = busSummaries.find((summary) => summary.bus === 'M');
  const remoteGuests = inputs.filter(isGuestOrCallInput);
  const routedMuted = inputs.filter((input) => input.muted && input.audioBuses.length > 0);
  const unroutedLikelyAudio = inputs.filter(
    (input) => isLikelyProductionAudioSource(input) && input.audioBuses.length === 0
  );

  return [
    {
      name: 'Master output',
      passed:
        master?.output.muted === false &&
        master.output.volume !== null &&
        master.output.volume >= 25 &&
        !hasIssue('outputBus'),
      detail: 'Master is parsed, unmuted, and above the low-volume warning threshold.',
    },
    {
      name: 'Muted routed inputs',
      passed: routedMuted.length === 0,
      detail: `${routedMuted.length} routed input(s) are muted.`,
    },
    {
      name: 'Likely audio sources routed',
      passed: unroutedLikelyAudio.length === 0,
      detail: `${unroutedLikelyAudio.length} likely audio source(s) have no visible bus routing.`,
    },
    {
      name: 'Remote guest return candidates',
      passed:
        remoteGuests.length === 0 ||
        remoteGuests.every((guest) => guest.audioBuses.some((bus) => bus !== 'M')),
      detail: `${remoteGuests.length} remote guest input(s) were detected.`,
    },
  ];
}

function countIssues(issues: AudioIssue[]) {
  return {
    total: issues.length,
    critical: issues.filter((issue) => issue.severity === 'critical').length,
    warning: issues.filter((issue) => issue.severity === 'warning').length,
    info: issues.filter((issue) => issue.severity === 'info').length,
  };
}

function buildAudioConfidence(
  inputs: InputAnalysis[],
  busSummaries: OutputBusSummary[],
  issues: AudioIssue[]
) {
  const parsedBusCount = busSummaries.filter((summary) => summary.output.parsed).length;
  const issueConfidence = average(issues.map((issue) => issue.confidence), issues.length > 0 ? 0.75 : 0.86);
  const issueLoadPenalty = Math.min(0.25, issues.length * 0.03);

  return buildAnalysisConfidence(
    [
      {
        name: 'stateXml',
        score: inputs.length > 0 ? 0.9 : 0.45,
        weight: 1.5,
        reason:
          inputs.length > 0
            ? `${inputs.length} input(s) were parsed for audio review.`
            : 'No inputs were visible for audio review.',
      },
      {
        name: 'busOutputVisibility',
        score: parsedBusCount / AUDIO_BUS_NAMES.length,
        weight: 1,
        reason: `${parsedBusCount} of ${AUDIO_BUS_NAMES.length} output bus states were visible in XML.`,
      },
      {
        name: 'issueConfidence',
        score: issueConfidence,
        weight: 2,
        reason: issues.length > 0
          ? 'Averaged confidence across produced audio issues.'
          : 'No audio issues were produced by the current rules.',
      },
      {
        name: 'issueLoad',
        score: 1 - issueLoadPenalty,
        weight: 0.75,
        reason: `${issues.length} issue(s) were produced.`,
      },
    ],
    'Confidence reflects input visibility, parsed bus outputs, issue confidence, and issue volume.'
  );
}

function buildAudioAssumptions() {
  return [
    assumptionDetail(
      'Input bus assignments in XML reflect the intended routing state.',
      'The diagnostic reads parsed input audiobusses values and parsed bus output states.',
      'high',
      0.86
    ),
    assumptionDetail(
      'vMix Call return-bus and monitoring destinations are not fully visible.',
      'The parser cannot see every caller return, headphone, hardware output, or external mixer destination.',
      'high',
      0.68
    ),
    assumptionDetail(
      'Mix-minus and foldback risks are conservative review prompts.',
      'Shared aux-bus routing can be valid, but it needs operator confirmation before a live show.',
      'medium',
      0.72
    ),
  ];
}

function buildRecommendations(issues: AudioIssue[]): string[] {
  const recommendations: string[] = [];

  if (issues.some((issue) => issue.severity === 'critical')) {
    recommendations.push('Resolve critical Program or Master audio blockers before going live.');
  }

  if (issues.some((issue) => issue.category === 'mixMinus')) {
    recommendations.push('Review vMix Call and remote guest return buses before sending aux audio back to callers.');
  }

  if (issues.some((issue) => issue.category === 'feedbackLoop')) {
    recommendations.push('Check likely caller-return buses for caller self-audio or shared foldback before going live.');
  }

  if (issues.some((issue) => issue.category === 'routing')) {
    recommendations.push('Route intentional audio sources to Master or the correct aux bus, and leave non-audio graphics unrouted.');
  }

  if (issues.some((issue) => issue.category === 'monitoring')) {
    recommendations.push('Compare Master routing against aux, monitor, return, and recording buses so the intended output carries the show mix.');
  }

  if (issues.some((issue) => issue.category === 'inputMute')) {
    recommendations.push('Check whether muted routed inputs are intentionally parked or should be live in the mix.');
  }

  if (recommendations.length === 0) {
    recommendations.push('No obvious audio blockers were detected from the current XML.');
  }

  return recommendations;
}

function findLiveInputForPresetInput(presetInput: PresetInput, inputs: InputAnalysis[]): InputAnalysis | null {
  if (presetInput.key) {
    const normalizedPresetKey = normalizeInputKey(presetInput.key);
    const byKey = inputs.find((input) => normalizeInputKey(input.stableReference) === normalizedPresetKey);
    if (byKey) return byKey;
  }

  return inputs.find((input) => input.title === presetInput.title) ?? null;
}

function buildSavedPresetAudioEvidence(preset: PresetFile | null, inputs: InputAnalysis[]) {
  if (!preset) return null;

  const callInputs = preset.inputs.filter((input) => input.videoCall !== null);
  return {
    source: preset.meta.source,
    freshnessNote: preset.meta.freshnessNote,
    meta: preset.meta,
    counts: {
      videoCallInputs: callInputs.length,
      inputsWithSavedAudio: preset.inputs.filter((input) => input.audio !== null).length,
    },
    callReturns: callInputs.map((input) => {
      const liveInput = findLiveInputForPresetInput(input, inputs);
      return {
        title: input.title,
        key: input.key,
        liveInputNumber: liveInput?.number ?? null,
        savedAudioBuses: input.audio?.buses ?? [],
        savedMuted: input.audio?.muted ?? null,
        returnAudioIndex: input.videoCall?.returnAudioIndex ?? null,
        returnVideoName: input.videoCall?.returnVideoName ?? null,
        hasRedactedCallKey: input.videoCall?.hasKey ?? false,
      };
    }),
    note:
      'Saved preset call-return fields are last-saved evidence. They may differ from unsaved live vMix changes. ' +
      'ReturnAudioIndex is reported as a raw vMix preset index until its bus mapping is calibrated across presets.',
  };
}

export const diagnoseAudioTool = createTool({
  name: 'vmix_diagnose_audio',
  description:
    'Read-only audio diagnostic for the current vMix state. Reviews input mute state, bus routing, ' +
    'Master/aux output state, Program audio, and likely remote guest mix-minus risks without executing vMix functions. ' +
    'Optionally adds last-saved vMix Call return metadata from a supplied .vmix preset file.',
  schema: z.object({
    includeOk: z
      .boolean()
      .optional()
      .describe('Include passing diagnostic checks in the response. Default: false.'),
    presetPath: z
      .string()
      .optional()
      .describe('Optional absolute path to a saved .vmix preset. Adds last-saved vMix Call return metadata when available.'),
    presetContent: z
      .string()
      .optional()
      .describe('Optional raw .vmix XML content. Adds last-saved vMix Call return metadata when available.'),
  }),
  handler: async ({ includeOk, presetPath, presetContent }: DiagnoseAudioParams, ctx: ToolContext) => {
    const state = await ctx.state.getState();
    const inputs = state.inputs.map(analyzeInput);
    const savedPreset =
      presetPath?.trim() || presetContent
        ? redactPresetFile(parsePresetFile(loadPresetFile({ path: presetPath, content: presetContent })))
        : null;
    const busSummaries = buildBusSummaries(state, inputs);
    const activeInput = state.active > 0 ? findInputByNumber(state, state.active) : null;
    const previewInput = state.preview > 0 ? findInputByNumber(state, state.preview) : null;
    const activeAnalysis = activeInput ? analyzeInput(activeInput) : null;
    const previewAnalysis = previewInput ? analyzeInput(previewInput) : null;
    const audioBusMap = buildAudioBusMap(inputs);
    // routedInputsByBus duplicated buses.outputs[].inputs (full analysis vs slim).
    // Keep only the bus -> input number index here; full per-input detail for
    // routed inputs lives once in buses.outputs[].inputs.
    const routedInputNumbersByBus: Record<string, number[]> = {};
    for (const [bus, busInputs] of Object.entries(audioBusMap)) {
      routedInputNumbersByBus[bus] = busInputs.map((input) => input.number);
    }
    const likelyAudioSources = inputs.filter(isLikelyProductionAudioSource);
    const routedMuted = inputs.filter((input) => input.muted && input.audioBuses.length > 0);
    const unroutedLikelyAudio = likelyAudioSources.filter((input) => input.audioBuses.length === 0);
    const guestOrCallInputs = inputs.filter(isGuestOrCallInput);
    const callerReturnCandidates = guestOrCallInputs.filter((input) =>
      input.audioBuses.some((bus) => bus !== 'M')
    );
    const monitorOnlyInputs = likelyAudioSources.filter(
      (input) => input.audioBuses.length > 0 && !input.audioBuses.includes('M')
    );
    const issues = [
      ...buildOutputBusIssues(busSummaries),
      ...buildInputRoutingIssues(state, inputs),
      ...buildMixMinusIssues(inputs),
      ...buildMonitoringIssues(inputs, busSummaries),
    ].sort((a, b) => {
      const severityRank: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
      return severityRank[a.severity] - severityRank[b.severity];
    });

    const result = {
      summary: {
        inputCount: inputs.length,
        likelyAudioSources: likelyAudioSources.length,
        audibleRoutedInputs: inputs.filter((input) => !input.muted && input.audioBuses.length > 0).length,
        mutedRoutedInputs: routedMuted.length,
        unroutedLikelyAudioSources: unroutedLikelyAudio.length,
        remoteGuests: inputs.filter((input) => input.role === 'remoteGuest').length,
        guestOrCallInputs: guestOrCallInputs.length,
        callerReturnCandidates: callerReturnCandidates.length,
        monitorOnlyInputs: monitorOnlyInputs.length,
        issueCounts: countIssues(issues),
      },
      program: {
        inputNumber: state.active,
        input: activeAnalysis,
      },
      preview: {
        inputNumber: state.preview,
        input: previewAnalysis,
      },
      buses: {
        outputs: busSummaries,
        routedInputsByBus: routedInputNumbersByBus,
        unrouted: (audioBusMap['unrouted'] ?? []).map(toIssueInput),
      },
      issues,
      recommendations: buildRecommendations(issues),
      savedPresetAudioEvidence: buildSavedPresetAudioEvidence(savedPreset, inputs),
      passingChecks: includeOk ? buildPassingChecks(inputs, busSummaries, issues) : [],
      analysisConfidence: buildAudioConfidence(inputs, busSummaries, issues),
      assumptions: [
        'This diagnostic is read-only and uses the current vMix XML cache.',
        savedPreset
          ? 'Saved preset call-return metadata is last-saved evidence and may differ from unsaved live changes.'
          : 'Saved .vmix files may expose additional last-saved vMix Call return metadata when provided with presetPath or presetContent.',
        'Bus routing means the input is assigned to that bus; actual hardware/stream destination mapping is not visible yet.',
        'Mix-minus and foldback warnings are conservative because the current parser cannot see vMix Call return-bus assignments.',
      ],
      assumptionDetails: buildAudioAssumptions(),
      parserLimitations: [
        savedPreset
          ? 'Live XML still does not deeply expose vMix Call return routing; saved .vmix evidence is last-saved and not proof of unsaved live changes.'
          : 'Live XML does not deeply expose vMix Call return routing. Provide presetPath or presetContent to include last-saved .vmix call-return metadata when available.',
        'The current parser does not deeply parse headphones/monitoring destinations, triggers, mix output destinations, or audio meters.',
        'Aux bus mute and volume are reported only when present in the current XML.',
      ],
    };

    return toolJsonContent(result);
  },
});

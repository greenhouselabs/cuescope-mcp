/**
 * vmix_diagnose_outputs - Read-only output/stream destination readiness review.
 *
 * This tool focuses the existing production-summary output analysis into a
 * compact operator handoff. It reports what live XML can prove and keeps
 * stream keys, recording paths, destination bindings, and platform health as
 * explicit operator checks unless they become safely parseable later.
 */
import { z } from 'zod';
import { createTool, toolJsonContent, type ToolContext } from '../base.js';
import { analyzeInput, findInputByNumber, type InputAnalysis } from './analysis-helpers.js';
import { buildProductionSummary } from './production-summary.js';

const OutputFocusSchema = z
  .enum(['goLive', 'recording', 'streaming', 'external', 'all'])
  .default('goLive');

type OutputFocus = z.infer<typeof OutputFocusSchema>;
type ReviewStatus = 'ready' | 'review' | 'blocked';
type CheckStatus = 'pass' | 'info' | 'review' | 'blocked';
type ReadinessDisposition = 'ready' | 'needsVerification' | 'notArmed' | 'blocked';
type ProductionSummary = ReturnType<typeof buildProductionSummary>;
type OutputReadiness = ProductionSummary['outputReadiness'];
type OutputRisk = OutputReadiness['risks'][number];

interface DiagnoseOutputsParams {
  focus?: OutputFocus;
  includePassedChecks?: boolean;
}

function compactInput(input: InputAnalysis | null) {
  if (!input) return null;
  return {
    number: input.number,
    title: input.title,
    type: input.type,
    role: input.role,
    productionRole: input.productionRole.primary.role,
    stableReference: input.stableReference,
    muted: input.muted,
    audioBuses: input.audioBuses,
  };
}

function compactRisk(risk: OutputRisk) {
  return {
    severity: risk.severity,
    message: risk.message,
    evidence: risk.evidence,
    recommendation: risk.recommendation,
    confidence: risk.confidence,
  };
}

function focusIncludes(focus: OutputFocus, destination: 'recording' | 'streaming' | 'external'): boolean {
  if (focus === 'goLive' || focus === 'all') return true;
  return focus === destination;
}

function statusForDestination(
  focus: OutputFocus,
  destination: 'recording' | 'streaming' | 'external',
  active: boolean,
  blocked: boolean
): CheckStatus {
  if (blocked && active) return 'blocked';
  if (active) return 'pass';
  return focusIncludes(focus, destination) ? 'review' : 'info';
}

function buildDestinationChecks(args: {
  focus: OutputFocus;
  outputReadiness: OutputReadiness;
  recordingDuration: number;
}) {
  const { focus, outputReadiness, recordingDuration } = args;
  const observed = outputReadiness.observed;
  const outputBlocked = observed.activeOutputCount > 0 && observed.fadeToBlack;

  return [
    {
      id: 'streaming',
      label: 'Streaming',
      status: statusForDestination(focus, 'streaming', observed.streaming, outputBlocked),
      visibleState: observed.streaming ? 'active' : 'inactive',
      visibleFacts: [
        `streaming flag: ${observed.streaming ? 'ON' : 'OFF'}`,
        `fade to black: ${observed.fadeToBlack ? 'ON' : 'OFF'}`,
      ],
      notVisible: [
        'stream URL, key, profile, destination account, and platform health',
        'whether the platform is receiving audio/video cleanly',
      ],
      operatorChecks: [
        'Confirm destination/profile/key inside vMix without exposing secrets.',
        'Confirm the platform preview/health page receives the intended feed.',
        'Confirm which video mix and audio bus feed the stream.',
      ],
    },
    {
      id: 'recording',
      label: 'Recording',
      status: statusForDestination(focus, 'recording', observed.recording, outputBlocked),
      visibleState: observed.recording ? 'active' : 'inactive',
      visibleFacts: [
        `recording flag: ${observed.recording ? 'ON' : 'OFF'}`,
        `recording duration seconds: ${recordingDuration}`,
      ],
      notVisible: [
        'recording filename/path, codec/container, disk space, and write health',
        'whether the recorded file contains the intended audio bus',
      ],
      operatorChecks: [
        'Confirm recording path, format, and free disk space directly in vMix/Windows.',
        'Record a short sample when possible and play it back for audio/video confidence.',
        'Confirm which video mix and audio bus feed the recording.',
      ],
    },
    {
      id: 'external',
      label: 'External / Hardware Output',
      status: statusForDestination(focus, 'external', observed.external, outputBlocked),
      visibleState: observed.external ? 'active' : 'inactive',
      visibleFacts: [
        `external output flag: ${observed.external ? 'ON' : 'OFF'}`,
        `parsed mix count: ${outputReadiness.mixDestinationAwareness.parsedMixCount}`,
      ],
      notVisible: [
        'fullscreen, NDI, SRT, hardware-device, and connector bindings',
        'downstream monitor, recorder, converter, or switcher status',
      ],
      operatorChecks: [
        'Confirm the physical or network output destination directly in vMix settings.',
        'Verify the downstream device sees the intended feed.',
        'Confirm whether a secondary mix or clean feed should drive this output.',
      ],
    },
  ];
}

function buildOutputLikeInputs(inputs: InputAnalysis[]) {
  return inputs
    .map((input) => {
      const title = input.title.toLowerCase();
      const type = input.type.toLowerCase();
      const reasons: string[] = [];
      let confidence = 0;

      if (type === 'output') {
        reasons.push('input type is Output');
        confidence = Math.max(confidence, 0.92);
      }
      if (/\b(output|clean feed|return feed|program feed|fullscreen)\b/.test(title)) {
        reasons.push('title suggests output/feed usage');
        confidence = Math.max(confidence, 0.72);
      }
      if (/\b(green ?room|return)\b/.test(title)) {
        reasons.push('title suggests return or green-room feed usage');
        confidence = Math.max(confidence, 0.64);
      }

      if (reasons.length === 0) return null;
      return {
        input: compactInput(input),
        reasons,
        confidence: Number(confidence.toFixed(2)),
        caveat:
          'This is a visible input/helper candidate, not proof of a final stream, record, fullscreen, NDI, SRT, or hardware binding.',
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 20);
}

function buildVideoPathReview(
  outputReadiness: OutputReadiness,
  program: InputAnalysis | null,
  preview: InputAnalysis | null,
  outputLikeInputs: ReturnType<typeof buildOutputLikeInputs>
) {
  const mixAwareness = outputReadiness.mixDestinationAwareness;
  const blocked = outputReadiness.observed.fadeToBlack && outputReadiness.observed.activeOutputCount > 0;
  const status: CheckStatus = blocked
    ? 'blocked'
    : mixAwareness.parsedMixCount > 1 || outputLikeInputs.length > 0
      ? 'review'
      : 'pass';

  return {
    status,
    program: compactInput(program),
    preview: compactInput(preview),
    fadeToBlack: outputReadiness.observed.fadeToBlack,
    mixDestinationAwareness: mixAwareness,
    outputLikeInputs,
    recommendation: blocked
      ? 'Confirm Fade to Black is intentional before trusting any active output.'
      : 'Confirm which Program/Mix/Output input feeds each real destination before air.',
  };
}

function buildAudioPathReview(outputReadiness: OutputReadiness) {
  const audioRisks = outputReadiness.risks.filter((risk) =>
    /audio|master|aux|bus/i.test(`${risk.message} ${risk.recommendation}`)
  );
  const critical = audioRisks.filter((risk) => risk.severity === 'critical');
  const warnings = audioRisks.filter((risk) => risk.severity === 'warning');
  const status: CheckStatus =
    critical.length > 0 ? 'blocked' : warnings.length > 0 ? 'review' : 'pass';

  return {
    status,
    master: outputReadiness.audioOutputVisibility.master,
    parsedAuxBusCount: outputReadiness.audioOutputVisibility.parsedAuxBusCount,
    auxBuses: outputReadiness.audioOutputVisibility.auxBuses,
    risks: audioRisks.map(compactRisk),
    recommendation:
      status === 'blocked'
        ? 'Resolve Master/output-audio blockers before trusting any destination.'
        : 'Listen to the actual stream/record/external destination, not only local meters.',
  };
}

function buildReviewItems(args: {
  outputReadiness: OutputReadiness;
  destinationChecks: ReturnType<typeof buildDestinationChecks>;
  videoPath: ReturnType<typeof buildVideoPathReview>;
  audioPath: ReturnType<typeof buildAudioPathReview>;
}) {
  const reviewItems = args.outputReadiness.risks.map((risk) => ({
    severity: risk.severity === 'critical' ? 'critical' : risk.severity,
    category: 'outputReadiness',
    message: risk.message,
    evidence: risk.evidence,
    recommendation: risk.recommendation,
    confidence: risk.confidence,
  }));

  for (const check of args.destinationChecks) {
    if (check.status !== 'review') continue;
    reviewItems.push({
      severity: 'warning' as const,
      category: check.id,
      message: `${check.label} is not active or cannot be fully verified from live XML.`,
      evidence: check.visibleFacts,
      recommendation: check.operatorChecks[0] ?? 'Confirm this destination directly in vMix.',
      confidence: 0.82,
    });
  }

  if (args.videoPath.status === 'review') {
    reviewItems.push({
      severity: 'warning' as const,
      category: 'videoPath',
      message: 'Final video destination binding needs operator confirmation.',
      evidence: [
        `parsed mixes: ${args.outputReadiness.mixDestinationAwareness.parsedMixCount}`,
        `output-like helper inputs: ${args.videoPath.outputLikeInputs.length}`,
      ],
      recommendation: args.videoPath.recommendation,
      confidence: 0.78,
    });
  }

  if (args.audioPath.status === 'review') {
    reviewItems.push({
      severity: 'warning' as const,
      category: 'audioPath',
      message: 'Final audio bus selection needs operator confirmation.',
      evidence: [
        `parsed aux buses: ${args.outputReadiness.audioOutputVisibility.parsedAuxBusCount}`,
      ],
      recommendation: args.audioPath.recommendation,
      confidence: 0.78,
    });
  }

  return reviewItems;
}

function overallStatus(args: {
  outputReadiness: OutputReadiness;
  destinationChecks: ReturnType<typeof buildDestinationChecks>;
  videoPath: ReturnType<typeof buildVideoPathReview>;
  audioPath: ReturnType<typeof buildAudioPathReview>;
  reviewItems: ReturnType<typeof buildReviewItems>;
}): ReviewStatus {
  if (
    args.outputReadiness.risks.some((risk) => risk.severity === 'critical') ||
    args.destinationChecks.some((check) => check.status === 'blocked') ||
    args.videoPath.status === 'blocked' ||
    args.audioPath.status === 'blocked'
  ) {
    return 'blocked';
  }

  if (
    args.reviewItems.length > 0 ||
    args.destinationChecks.some((check) => check.status === 'review') ||
    args.videoPath.status === 'review' ||
    args.audioPath.status === 'review'
  ) {
    return 'review';
  }

  return 'ready';
}

function buildReadinessSummary(args: {
  status: ReviewStatus;
  outputReadiness: OutputReadiness;
  destinationChecks: ReturnType<typeof buildDestinationChecks>;
}): {
  disposition: ReadinessDisposition;
  headline: string;
  detail: string;
  toneGuidance: string;
} {
  const activeOutputCount = args.outputReadiness.observed.activeOutputCount;
  const reviewedDestinations = args.destinationChecks
    .filter((check) => check.status === 'review')
    .map((check) => check.label);

  if (args.status === 'blocked') {
    return {
      disposition: 'blocked',
      headline: 'Active output blockers found; resolve them before trusting any destination.',
      detail:
        'At least one visible output, video-path, or audio-path condition is unsafe enough to block confidence.',
      toneGuidance: 'Use blocker language because a true active-output risk is present.',
    };
  }

  if (activeOutputCount === 0) {
    return {
      disposition: 'notArmed',
      headline: 'Outputs are not armed yet; visible state is ready for operator verification.',
      detail:
        reviewedDestinations.length > 0
          ? `The focused destinations are idle (${reviewedDestinations.join(', ')}), so final destination health cannot be proven until they are armed.`
          : 'The focused destinations are idle, so final destination health cannot be proven until they are armed.',
      toneGuidance:
        'Do not summarize idle outputs with failure language unless a true blocker exists; say "not armed yet" and list the operator checks.',
    };
  }

  if (args.status === 'review') {
    return {
      disposition: 'needsVerification',
      headline: 'Outputs have no parsed blockers, but destination bindings need operator verification.',
      detail:
        'At least one output is active or visible; remaining confidence depends on vMix settings, platform health, recorded-file playback, or downstream device checks.',
      toneGuidance: 'Use review/verification language rather than failure language unless a blocker exists.',
    };
  }

  return {
    disposition: 'ready',
    headline: 'Visible output state has no parsed blockers; verify destinations by eye and ear.',
    detail:
      'Live XML cannot prove platform health, recording write health, final audio/video destination bindings, or downstream hardware status.',
    toneGuidance:
      'Say visible state looks ready, then name the external verification steps that still require the operator.',
  };
}

function buildPassedChecks(args: {
  includePassedChecks: boolean;
  destinationChecks: ReturnType<typeof buildDestinationChecks>;
  videoPath: ReturnType<typeof buildVideoPathReview>;
  audioPath: ReturnType<typeof buildAudioPathReview>;
  outputReadiness: OutputReadiness;
}) {
  if (!args.includePassedChecks) return [];

  const checks = args.destinationChecks
    .filter((check) => check.status === 'pass')
    .map((check) => ({
      name: check.label,
      status: 'pass',
      detail: `${check.label} visible state is ${check.visibleState}.`,
    }));

  if (args.videoPath.status === 'pass') {
    checks.push({
      name: 'Video path',
      status: 'pass',
      detail: 'Program/Preview resolved and no active-output video blocker was detected.',
    });
  }

  if (args.audioPath.status === 'pass') {
    checks.push({
      name: 'Audio path',
      status: 'pass',
      detail: 'No critical or warning-level output audio risk was detected from parsed state.',
    });
  }

  if (args.outputReadiness.observed.fadeToBlack === false) {
    checks.push({
      name: 'Fade to Black',
      status: 'pass',
      detail: 'Fade to Black is off.',
    });
  }

  return checks;
}

export const diagnoseOutputsTool = createTool({
  name: 'vmix_diagnose_outputs',
  description:
    'Read-only output/stream destination readiness review. Use for "are my outputs ready", ' +
    '"check stream/recording/external output", or "what output bindings do I need to verify". ' +
    'Reports visible live state, output/audio risks, multi-mix caveats, and human checks for destinations that live XML cannot prove.',
  schema: z.object({
    focus: OutputFocusSchema.optional().describe(
      'Review focus: goLive, recording, streaming, external, or all. Default: goLive.'
    ),
    includePassedChecks: z
      .boolean()
      .optional()
      .describe('Include passing visible-state checks. Default: true.'),
  }),
  handler: async (
    { focus = 'goLive', includePassedChecks = true }: DiagnoseOutputsParams,
    ctx: ToolContext
  ) => {
    const state = await ctx.state.getState();
    const inputs = state.inputs.map(analyzeInput);
    const productionSummary = buildProductionSummary(state, inputs);
    const outputReadiness = productionSummary.outputReadiness;
    const programInput = state.active > 0 ? findInputByNumber(state, state.active) : null;
    const previewInput = state.preview > 0 ? findInputByNumber(state, state.preview) : null;
    const program = programInput ? analyzeInput(programInput) : null;
    const preview = previewInput ? analyzeInput(previewInput) : null;
    const outputLikeInputs = buildOutputLikeInputs(inputs);
    const destinationChecks = buildDestinationChecks({
      focus,
      outputReadiness,
      recordingDuration: state.recordingDuration,
    });
    const videoPath = buildVideoPathReview(outputReadiness, program, preview, outputLikeInputs);
    const audioPath = buildAudioPathReview(outputReadiness);
    const reviewItems = buildReviewItems({
      outputReadiness,
      destinationChecks,
      videoPath,
      audioPath,
    });
    const status = overallStatus({
      outputReadiness,
      destinationChecks,
      videoPath,
      audioPath,
      reviewItems,
    });
    const readinessSummary = buildReadinessSummary({
      status,
      outputReadiness,
      destinationChecks,
    });

    return toolJsonContent({
      mode: 'readOnlyOutputReadiness',
      focus,
      overallStatus: status,
      readinessSummary,
      execution: {
        executed: false,
        note: 'This Review Mode tool only reads current state. It never starts/stops streams, recordings, external output, fullscreen, NDI, SRT, or hardware outputs.',
      },
      source: {
        vmixVersion: state.version,
        edition: state.edition,
        inputCount: state.inputs.length,
        programInputNumber: state.active,
        previewInputNumber: state.preview,
      },
      visibleOutputState: {
        ...outputReadiness.observed,
        recordingDurationSeconds: state.recordingDuration,
      },
      destinationChecks,
      videoPath,
      audioPath,
      reviewItems,
      passingChecks: buildPassedChecks({
        includePassedChecks,
        destinationChecks,
        videoPath,
        audioPath,
        outputReadiness,
      }),
      knownUnknowns: outputReadiness.unknowns,
      recommendedNextSteps: [
        status === 'blocked'
          ? 'Resolve active-output blockers before trusting the stream, recording, or external destination.'
          : status === 'review'
            ? readinessSummary.disposition === 'notArmed'
              ? 'Treat this as not armed yet rather than failed; confirm the review items directly in vMix before going live.'
              : 'Confirm every review item directly in vMix and on the actual destination before going live.'
            : 'Visible output state has no parsed blockers; still confirm platform health, recording file, and downstream devices by eye/ear.',
        outputReadiness.observed.activeOutputCount === 0
          ? 'Outputs are not armed yet; re-run this review after arming recording, streaming, or external output for final confidence.'
          : 'Since at least one output is active, verify the actual destination feed now.',
        'Do not paste stream keys, RTMP/SRT URLs with credentials, recording paths, or private network details into chat.',
      ],
      assumptions: [
        'Live XML exposes output activity flags, Program/Preview, mixes, inputs, and audio bus state, but not every final destination binding.',
        'Output-like inputs are helper candidates, not proof of stream/record/fullscreen/NDI/SRT/hardware routing.',
        'Platform health, recording write health, disk space, and downstream hardware status require operator verification.',
      ],
      relatedTools: [
        'vmix_show_review',
        'vmix_preflight',
        'vmix_diagnose_audio',
        'vmix_generate_show_checklist',
      ],
    });
  },
});

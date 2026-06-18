/**
 * vmix_generate_api_sequence - Read-only vMix API sequence generation
 */

import { z } from 'zod';
import { createTool, toolJsonContent, type ToolContext } from '../base.js';
import type { VmixInput, VmixState } from '../../state/types.js';
import { analyzeInput, summarizeRequiredInput, type InputAnalysis } from './analysis-helpers.js';
import {
  describeInput,
  extractFieldValues,
  parseOverlayChannel,
  parseSeconds,
  stableInputReference,
} from './goal-parsing.js';
import {
  findCurrentProgramPairedAudioMapping,
  findPairedAudioMappings,
  isPairedAudioGoal,
  mappingUsesMaster,
  parsePairedAudioGenerationOptions,
  type PairedAudioMapping,
} from './paired-audio.js';
import { buildPreflightIssueMessages, getAutomationPreflightHandoff } from './preflight-handoff.js';

type SequencePattern =
  | 'switchInput'
  | 'previewInput'
  | 'timedOverlay'
  | 'titleTextUpdate'
  | 'volumeChange'
  | 'pairedAudioFollow'
  | 'recordingControl'
  | 'customSequence';

type RiskLevel = 'low' | 'medium' | 'high';
type ApiParamValue = string | number | boolean;

interface ApiSequenceStep {
  step: number;
  function: string;
  params: Record<string, ApiParamValue>;
  delayAfterMs?: number;
  purpose: string;
  risk: RiskLevel;
}

interface SequenceIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  detail?: string;
}

interface ApiSequenceArtifact {
  pattern: SequencePattern;
  confidence: number;
  explanation: string;
  sequence: ApiSequenceStep[];
  requiredInputs: InputAnalysis[];
  requiredFields: Array<{
    input: InputAnalysis;
    fields: string[];
  }>;
  issues: SequenceIssue[];
  assumptions: string[];
  reviewChecklist: string[];
  testSteps: string[];
  failureModes: string[];
}

function parseVolume(text: string): number {
  const percentMatch = text.match(/(?:volume|vol|level)\D*(\d{1,3})\s*%?/i);
  if (!percentMatch?.[1]) return 80;

  const volume = parseInt(percentMatch[1], 10);
  if (!Number.isFinite(volume)) return 80;
  return Math.max(0, Math.min(100, volume));
}

function resolveInput(state: VmixState, reference: string): VmixInput | null {
  const trimmed = reference.trim();
  const lower = trimmed.toLowerCase();

  const keyMatch = state.inputs.find((input) => input.key.toLowerCase() === lower);
  if (keyMatch) return keyMatch;

  if (/^\d+$/.test(trimmed)) {
    const number = parseInt(trimmed, 10);
    const numberMatch = state.inputs.find((input) => input.number === number);
    if (numberMatch) return numberMatch;
  }

  const exactTitle = state.inputs.find((input) => input.title.toLowerCase() === lower);
  if (exactTitle) return exactTitle;

  const partialMatches = state.inputs.filter((input) => input.title.toLowerCase().includes(lower));
  return partialMatches.length === 1 ? partialMatches[0]! : null;
}

function findTargetInput(state: VmixState, goal: string): VmixInput | null {
  const targetMatch = goal.match(
    /(?:cut|switch|fade|preview|show|display|volume|vol|level|route)\s+(?:to|on|for)?\s*["']?([^"',\n]+?)["']?(?:\s+(?:on|for|to|at|in|with)\b|$)/i
  );
  const targetText = targetMatch?.[1]?.trim();

  if (targetText) {
    const input = resolveInput(state, targetText);
    if (input) return input;
  }

  const lowerGoal = goal.toLowerCase();
  const mentionedInputs = state.inputs.filter((input) => lowerGoal.includes(input.title.toLowerCase()));
  if (mentionedInputs.length === 1) return mentionedInputs[0]!;

  return null;
}

function findOverlayInput(state: VmixState, goal: string): VmixInput | null {
  const lowerGoal = goal.toLowerCase();
  const mentioned = state.inputs.find((input) => lowerGoal.includes(input.title.toLowerCase()));
  if (mentioned) return mentioned;

  return (
    state.inputs.find((input) => {
      const analysis = analyzeInput(input);
      return analysis.role === 'titleGraphic' || analysis.role === 'imageGraphic';
    }) ??
    state.inputs.find((input) => {
      const title = input.title.toLowerCase();
      return title.includes('lower') || title.includes('graphic') || title.includes('overlay');
    }) ??
    null
  );
}

function findTitleInput(state: VmixState, goal: string): VmixInput | null {
  const lowerGoal = goal.toLowerCase();
  const mentioned = state.inputs.find(
    (input) => lowerGoal.includes(input.title.toLowerCase()) && Object.keys(input.fields ?? {}).length > 0
  );
  if (mentioned) return mentioned;

  return (
    state.inputs.find((input) => analyzeInput(input).role === 'titleGraphic') ??
    state.inputs.find((input) => Object.keys(input.fields ?? {}).length > 0) ??
    null
  );
}

function buildStep(
  step: number,
  functionName: string,
  params: Record<string, ApiParamValue>,
  purpose: string,
  risk: RiskLevel,
  delayAfterMs?: number
): ApiSequenceStep {
  return delayAfterMs !== undefined
    ? { step, function: functionName, params, delayAfterMs, purpose, risk }
    : { step, function: functionName, params, purpose, risk };
}

function buildSwitchArtifact(state: VmixState, goal: string): ApiSequenceArtifact | null {
  const input = findTargetInput(state, goal);
  if (!input) return null;

  const lowerGoal = goal.toLowerCase();
  const functionName = lowerGoal.includes('fade') ? 'Fade' : 'Cut';
  const durationMatch = goal.match(/(?:duration|over)\D*(\d{2,5})\s*(?:ms|milliseconds)?/i);
  const duration = durationMatch?.[1] ? parseInt(durationMatch[1], 10) : undefined;
  const params: Record<string, ApiParamValue> = { Input: stableInputReference(input) };
  if (functionName === 'Fade' && duration !== undefined) params['Duration'] = duration;

  return {
    pattern: 'switchInput',
    confidence: 0.86,
    explanation: `${functionName} to ${input.title}.`,
    sequence: [buildStep(1, functionName, params, `Take ${input.title} to Program.`, 'medium')],
    requiredInputs: [analyzeInput(input)],
    requiredFields: [],
    issues: [],
    assumptions: ['Input keys are preferred for API params when available.'],
    reviewChecklist: [`Confirm ${input.title} is the intended Program source.`],
    testSteps: ['Try the same function in a rehearsal preset before using it live.'],
    failureModes: [
      'If the input was deleted and recreated, its key may have changed.',
      'A live switch affects Program immediately if executed later in Control Mode or manually.',
    ],
  };
}

function buildPreviewArtifact(state: VmixState, goal: string): ApiSequenceArtifact | null {
  const input = findTargetInput(state, goal);
  if (!input) return null;

  return {
    pattern: 'previewInput',
    confidence: 0.86,
    explanation: `Put ${input.title} in Preview.`,
    sequence: [
      buildStep(
        1,
        'PreviewInput',
        { Input: stableInputReference(input) },
        `Load ${input.title} into Preview.`,
        'low'
      ),
    ],
    requiredInputs: [analyzeInput(input)],
    requiredFields: [],
    issues: [],
    assumptions: ['Preview changes are lower risk than Program transitions but still affect the operator surface.'],
    reviewChecklist: [`Confirm ${input.title} is the intended Preview source.`],
    testSteps: ['Confirm Preview updates without changing Program.'],
    failureModes: ['If the input key changes, update the Input param before execution.'],
  };
}

function buildTimedOverlayArtifact(state: VmixState, goal: string): ApiSequenceArtifact | null {
  const input = findOverlayInput(state, goal);
  if (!input) return null;

  const seconds = parseSeconds(goal, 5);
  const channel = parseOverlayChannel(goal);

  return {
    pattern: 'timedOverlay',
    confidence: 0.84,
    explanation: `Show ${input.title} on overlay channel ${channel} for ${seconds} seconds, then hide it.`,
    sequence: [
      buildStep(
        1,
        `OverlayInput${channel}In`,
        { Input: stableInputReference(input) },
        `Show ${input.title} on overlay channel ${channel}.`,
        'medium',
        seconds * 1000
      ),
      buildStep(
        2,
        `OverlayInput${channel}Out`,
        {},
        `Hide overlay channel ${channel}.`,
        'medium'
      ),
    ],
    requiredInputs: [analyzeInput(input)],
    requiredFields: [],
    issues: [],
    assumptions: ['Overlay channels are 1-4 in vMix.'],
    reviewChecklist: [
      `Confirm ${input.title} is the intended overlay graphic.`,
      `Confirm overlay channel ${channel} is not reserved for another graphic.`,
    ],
    testSteps: ['Run the sequence in rehearsal and confirm the overlay clears after the delay.'],
    failureModes: [
      'Executing the Out step later can clear whatever is on that overlay channel at that time.',
      'The delay is advisory in Review Mode and must be implemented by the caller/manual operator.',
    ],
  };
}

function buildTitleUpdateArtifact(state: VmixState, goal: string): ApiSequenceArtifact | null {
  const input = findTitleInput(state, goal);
  const fields = Object.keys(input?.fields ?? {});
  if (!input || fields.length === 0) return null;

  const fieldValues = extractFieldValues(goal, fields);
  const selectedFields = Object.keys(fieldValues).length > 0 ? Object.keys(fieldValues) : fields.slice(0, 3);
  const issues: SequenceIssue[] =
    Object.keys(fieldValues).length === 0
      ? [
          {
            severity: 'warning',
            message: 'No exact field values were detected, so placeholder values were generated.',
            detail: `Available fields: ${fields.join(', ')}.`,
          },
        ]
      : [];
  const sequence = selectedFields.map((field, index) =>
    buildStep(
      index + 1,
      'SetText',
      {
        Input: stableInputReference(input),
        SelectedName: field,
        Value: fieldValues[field] ?? `New ${field} value`,
      },
      `Update ${field} on ${input.title}.`,
      'low'
    )
  );

  return {
    pattern: 'titleTextUpdate',
    confidence: Object.keys(fieldValues).length > 0 ? 0.82 : 0.68,
    explanation: `Update title field(s) on ${input.title}.`,
    sequence,
    requiredInputs: [analyzeInput(input)],
    requiredFields: [{ input: analyzeInput(input), fields: selectedFields }],
    issues,
    assumptions: ['Only visible title fields from the current XML are used.'],
    reviewChecklist: [
      `Confirm ${input.title} is the intended title input.`,
      `Review field names exactly: ${fields.join(', ')}.`,
    ],
    testSteps: ['Apply to a duplicate title input or rehearsal preset first.'],
    failureModes: ['If the title template changes, SelectedName values may stop matching.'],
  };
}

function buildVolumeArtifact(state: VmixState, goal: string): ApiSequenceArtifact | null {
  const input = findTargetInput(state, goal);
  if (!input) return null;

  const volume = parseVolume(goal);

  return {
    pattern: 'volumeChange',
    confidence: 0.72,
    explanation: `Set ${input.title} volume to ${volume}.`,
    sequence: [
      buildStep(
        1,
        'SetVolume',
        { Input: stableInputReference(input), Value: volume },
        `Set ${input.title} input volume.`,
        'medium'
      ),
    ],
    requiredInputs: [analyzeInput(input)],
    requiredFields: [],
    issues: [],
    assumptions: ['Volume is clamped to the 0-100 range for this generated API plan.'],
    reviewChecklist: [`Confirm ${input.title} is the input whose volume should change.`],
    testSteps: ['Watch vMix audio meters and listen on the intended output bus during rehearsal.'],
    failureModes: ['Input volume changes can affect Program, recording, streaming, or aux bus feeds.'],
  };
}

function describeMapping(mapping: PairedAudioMapping): string {
  return `${mapping.video.number} ${mapping.video.title} -> ${mapping.music.number} ${mapping.music.title} on Bus ${mapping.bus}`;
}

function buildPairedAudioNeedsExplicitPairsArtifact(): ApiSequenceArtifact {
  return {
    pattern: 'pairedAudioFollow',
    confidence: 0.42,
    explanation:
      'No safe video/music pair was inferred. Provide explicit stable video and music-bed input keys before generating paired Program-follow API payloads.',
    sequence: [],
    requiredInputs: [],
    requiredFields: [],
    issues: [
      {
        severity: 'warning',
        message: 'No safe paired video/music relationship was detected.',
        detail:
          'The generator will not infer music beds from vMix Call inputs, caller returns, Return Feed, IFB, talkback, or mix-minus paths. Provide explicit pairs before creating playback steps.',
      },
      {
        severity: 'info',
        message: 'A standalone API sequence cannot watch Program.',
        detail:
          'After explicit pairs are known, use per-input triggers for one-shot payloads or generate the VB.NET watcher for continuous Program-follow behavior.',
      },
    ],
    assumptions: [
      'The current state does not expose a safe, explicit silent-video plus separate music-bed relationship.',
      'Caller-return and mix-minus paths are excluded from paired-music inference.',
    ],
    reviewChecklist: [
      'Identify the real video inputs that should trigger music.',
      'Identify the real music/audio-bed inputs and confirm they are routed to the intended output bus.',
      'Generate one trigger payload per explicit video/music pair, or use the VB.NET watcher artifact.',
    ],
    testSteps: [
      'Regenerate with explicit pairs and review the exact stable keys.',
      'Apply only in rehearsal or a duplicate preset before relying on the sequence.',
    ],
    failureModes: [
      'Guessing pairs from caller-return routing can play audio into the wrong monitoring or mix-minus path.',
      'A one-shot API payload does not react to future Program changes unless attached to a trigger or watcher.',
    ],
  };
}

function buildPairedAudioFollowArtifact(state: VmixState, goal: string): ApiSequenceArtifact | null {
  const mappings = findPairedAudioMappings(state);
  if (mappings.length === 0) return buildPairedAudioNeedsExplicitPairsArtifact();

  const options = parsePairedAudioGenerationOptions(goal);
  const currentMapping = findCurrentProgramPairedAudioMapping(state, mappings);
  const targetMapping = currentMapping ?? mappings[0]!;
  const otherMusicInputs = mappings
    .map((mapping) => mapping.music)
    .filter((music) => music.number !== targetMapping.music.number);
  const sequence: ApiSequenceStep[] = [];

  for (const music of otherMusicInputs) {
    sequence.push(
      buildStep(
        sequence.length + 1,
        'Pause',
        { Input: stableInputReference(music) },
        `Park non-matching music track ${music.title}.`,
        'medium',
        150
      )
    );
  }

  if (options.playbackBehavior === 'restart') {
    sequence.push(
      buildStep(
        sequence.length + 1,
        'Restart',
        { Input: stableInputReference(targetMapping.music) },
        `Start ${targetMapping.music.title} from the top for ${targetMapping.video.title}.`,
        'medium',
        150
      )
    );
  }

  sequence.push(
    buildStep(
      sequence.length + 1,
      'Play',
      { Input: stableInputReference(targetMapping.music) },
      options.playbackBehavior === 'restart'
        ? `Ensure ${targetMapping.music.title} is playing.`
        : `Resume ${targetMapping.music.title} from its current position.`,
      'medium'
    )
  );

  const issues: SequenceIssue[] = [
    {
      severity: 'warning',
      message: 'This API sequence is one-shot, not a continuous Program-follow automation.',
      detail:
        'Run the generated VB.NET monitor script for continuous follow behavior; this sequence applies only to the selected/current Program mapping.',
    },
  ];

  if (!mappingUsesMaster(targetMapping)) {
    issues.push({
      severity: 'warning',
      message: 'The target music track is not routed to Master.',
      detail:
        'Playing this input may not make it audible on a Master-fed stream or recording. Confirm output bus routing before relying on it.',
    });
  }

  if (options.unmappedBehavior === 'pauseAll') {
    issues.push({
      severity: 'info',
      message: 'Unmapped Program behavior applies to the VB.NET monitor script, not this one-shot sequence.',
      detail:
        'The one-shot sequence targets the current/detected Program pair only. Ask for the VB.NET artifact when unmapped inputs should pause all music automatically.',
    });
  }

  return {
    pattern: 'pairedAudioFollow',
    confidence: currentMapping ? 0.82 : 0.72,
    explanation: currentMapping
      ? `Prepare a one-shot sequence for the current Program pair: ${describeMapping(targetMapping)}.`
      : `Prepare a one-shot sequence for the first detected pair because Program is not a mapped video: ${describeMapping(targetMapping)}.`,
    sequence,
    requiredInputs: [targetMapping.video, targetMapping.music, ...otherMusicInputs].map(analyzeInput),
    requiredFields: [],
    issues,
    assumptions: [
      'Video/music pairs are inferred by shared non-Master audio buses.',
      'Pause is used to park non-matching music tracks.',
      options.playbackBehavior === 'restart'
        ? 'Restart intentionally starts the selected music track from 0:00.'
        : 'Resume behavior uses Play only and does not reset the selected music track to 0:00.',
    ],
    reviewChecklist: [
      `Confirm the selected pair is correct: ${describeMapping(targetMapping)}.`,
      'Confirm whether the music bus feeds the stream/recording output.',
      'Use the VB.NET monitor artifact, not this sequence alone, for continuous follow automation.',
    ],
    testSteps: [
      'Run only in rehearsal or manually apply the calls one at a time.',
      'Listen on the actual output bus after the Play step.',
    ],
    failureModes: [
      'This sequence does not automatically react to future Program changes.',
      'If input keys change after re-importing media, update the Input params.',
      'If music is aux-only and the output is Master-fed, the audience may not hear the track.',
    ],
  };
}

function buildRecordingArtifact(goal: string): ApiSequenceArtifact {
  const lowerGoal = goal.toLowerCase();
  const target = lowerGoal.includes('stream') && !lowerGoal.includes('record') ? 'Streaming' : 'Recording';
  const action = lowerGoal.includes('stop') ? 'Stop' : lowerGoal.includes('start') ? 'Start' : 'StartStop';
  const functionName = `${action}${target}`;

  return {
    pattern: 'recordingControl',
    confidence: 0.78,
    explanation: `Prepare a ${functionName} API call.`,
    sequence: [
      buildStep(
        1,
        functionName,
        {},
        `${action} ${target.toLowerCase()}.`,
        'high'
      ),
    ],
    requiredInputs: [],
    requiredFields: [],
    issues: [
      {
        severity: 'warning',
        message: `${functionName} is show-critical.`,
        detail: 'Review production state before any manual or Control Mode execution.',
      },
    ],
    assumptions: ['This is a reviewable plan only and does not start/stop anything in Review Mode.'],
    reviewChecklist: [
      `Confirm ${target.toLowerCase()} is the intended output control.`,
      'Confirm the current show is not live unless this action is intentional.',
    ],
    testSteps: ['Test in a non-live vMix session first.'],
    failureModes: ['Executing this at the wrong time can start or stop a production-critical output.'],
  };
}

function buildCustomArtifact(state: VmixState, goal: string): ApiSequenceArtifact {
  const usefulInputs = state.inputs.slice(0, 8);

  return {
    pattern: 'customSequence',
    confidence: 0.35,
    explanation: 'Could not confidently match a supported API-sequence pattern.',
    sequence: [],
    requiredInputs: usefulInputs.map(analyzeInput),
    requiredFields: [],
    issues: [
      {
        severity: 'info',
        message: 'No API calls were generated because the request needs more specific production intent.',
        detail: `Goal: "${goal}". Visible inputs include: ${usefulInputs.map(describeInput).join(', ') || 'none'}.`,
      },
    ],
    assumptions: ['The tool avoids guessing API calls when a safe, obvious mapping is not available.'],
    reviewChecklist: [
      'Clarify the target input, exact vMix function, timing, and whether Program is affected.',
      'Use vmix_find_input first if the target input name is uncertain.',
    ],
    testSteps: ['Generate again with a more specific goal.'],
    failureModes: ['A vague API sequence can affect the wrong source or output if translated manually.'],
  };
}

function generateArtifact(state: VmixState, goal: string): ApiSequenceArtifact {
  const lowerGoal = goal.toLowerCase();

  if (isPairedAudioGoal(goal)) {
    const artifact = buildPairedAudioFollowArtifact(state, goal);
    if (artifact) return artifact;
  }

  if (lowerGoal.includes('preview')) {
    const artifact = buildPreviewArtifact(state, goal);
    if (artifact) return artifact;
  }

  if (
    (lowerGoal.includes('show') || lowerGoal.includes('display')) &&
    (lowerGoal.includes('lower third') || lowerGoal.includes('overlay') || lowerGoal.includes('graphic')) &&
    (lowerGoal.includes('second') || lowerGoal.includes('sec'))
  ) {
    const artifact = buildTimedOverlayArtifact(state, goal);
    if (artifact) return artifact;
  }

  if (
    (lowerGoal.includes('set') || lowerGoal.includes('update') || lowerGoal.includes('change')) &&
    (lowerGoal.includes('text') || lowerGoal.includes('title') || lowerGoal.includes('score'))
  ) {
    const artifact = buildTitleUpdateArtifact(state, goal);
    if (artifact) return artifact;
  }

  if (lowerGoal.includes('volume') || lowerGoal.includes('vol') || lowerGoal.includes('level')) {
    const artifact = buildVolumeArtifact(state, goal);
    if (artifact) return artifact;
  }

  if (
    lowerGoal.includes('record') ||
    lowerGoal.includes('stream') ||
    lowerGoal.includes('recording') ||
    lowerGoal.includes('streaming')
  ) {
    return buildRecordingArtifact(goal);
  }

  if (lowerGoal.includes('cut') || lowerGoal.includes('fade') || lowerGoal.includes('switch')) {
    const artifact = buildSwitchArtifact(state, goal);
    if (artifact) return artifact;
  }

  return buildCustomArtifact(state, goal);
}

function buildStateContext(state: VmixState) {
  return {
    inputCount: state.inputs.length,
    program: state.active,
    preview: state.preview,
    mixes: (state.mixes ?? []).map((mix) => ({
      number: mix.number,
      active: mix.active,
      preview: mix.preview,
    })),
  };
}

export const generateApiSequenceTool = createTool({
  name: 'vmix_generate_api_sequence',
  description:
    'Read-only vMix API sequence generator. Produces a reviewable ordered function-call plan with params, delays, ' +
    'risk notes, and assumptions without executing anything. Each sequence step is already batch-compatible: its ' +
    'function + params (+ delayAfterMs) map directly to a vMix batch command, so no separate command array is emitted.',
  schema: z.object({
    goal: z.string().min(1).describe('Natural language goal for the vMix API call sequence.'),
  }),
  handler: async ({ goal }: { goal: string }, ctx: ToolContext) => {
    const state = await ctx.state.getState();
    const artifact = generateArtifact(state, goal);
    const automationPreflight = getAutomationPreflightHandoff(state);
    const preflightIssues = buildPreflightIssueMessages(automationPreflight, 'API sequence');
    const issues = [...artifact.issues, ...preflightIssues];
    const blockingIssues = issues.filter((issue) => issue.severity === 'error');
    const result = {
      goal,
      mode: 'readOnlyApiSequenceGeneration',
      execution: {
        executed: false,
        note: 'Review Mode only returns a reviewable API plan. It never calls vMix functions.',
      },
      pattern: artifact.pattern,
      confidence: Number(artifact.confidence.toFixed(2)),
      valid: blockingIssues.length === 0,
      explanation: artifact.explanation,
      sequence: artifact.sequence,
      requiredInputs: artifact.requiredInputs.map(summarizeRequiredInput),
      requiredFields: artifact.requiredFields,
      issues,
      automationPreflight,
      assumptions: artifact.assumptions,
      reviewChecklist: [
        automationPreflight.executionRecommendation,
        ...automationPreflight.requiredOperatorConfirmations,
        ...artifact.reviewChecklist,
      ],
      testSteps: [
        ...automationPreflight.recommendedNextTests,
        ...artifact.testSteps,
      ],
      failureModes: artifact.failureModes,
      stateContext: buildStateContext(state),
      parserLimitations: [
        'Pattern matching is heuristic; mix active/preview paths are parsed when vMix exposes them, but mix output destinations still require operator verification.',
        'Generated API sequences are plans only; the caller or operator must decide whether, when, and how to execute them.',
      ],
    };

    return toolJsonContent(result, !result.valid);
  },
});

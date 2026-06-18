/**
 * vmix_compare_xml_snapshots - Read-only comparison for two vMix XML snapshots
 */

import { z } from 'zod';
import { createTool, toolJsonContent, type ToolContext } from '../base.js';
import { parseVmixState } from '../../state/parser.js';
import type { VmixInput, VmixState } from '../../state/types.js';
import { getAudioChannel } from '../../state/normalized-topology.js';
import { assumptionDetail, buildAnalysisConfidence } from './analysis-metadata.js';
import { AUDIO_BUS_NAMES, findInputByNumber } from './analysis-helpers.js';

type ChangeCategory =
  | 'showState'
  | 'programPreview'
  | 'mix'
  | 'inputInventory'
  | 'inputProperty'
  | 'overlay'
  | 'audio'
  | 'titleField';
type ChangeSeverity = 'critical' | 'warning' | 'info';

interface SnapshotChange {
  category: ChangeCategory;
  severity: ChangeSeverity;
  label: string;
  before: unknown;
  after: unknown;
  detail?: string;
  input?: SnapshotInputRef;
}

interface SnapshotInputRef {
  number: number;
  title: string;
  type: string;
}

function parseSnapshot(label: string, xml: string): { state: VmixState | null; error: string | null } {
  if (!/<vmix[\s>]/i.test(xml)) {
    return {
      state: null,
      error: `${label} does not look like a vMix XML snapshot. Expected a <vmix> root element.`,
    };
  }

  try {
    return {
      state: parseVmixState(xml),
      error: null,
    };
  } catch (error) {
    return {
      state: null,
      error: `${label} could not be parsed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

function inputIdentity(input: VmixInput): string {
  if (input.key.length > 0) return `key:${input.key.toLowerCase()}`;
  return `number:${input.number}`;
}

function inputLabel(input: VmixInput): string {
  return `${input.number}: ${input.title} (${input.type})`;
}

function summarizeInput(input: VmixInput | null): SnapshotInputRef | null {
  return input ? { number: input.number, title: input.title, type: input.type } : null;
}

function summarizeSnapshot(state: VmixState) {
  return {
    version: state.version,
    edition: state.edition,
    inputCount: state.inputs.length,
    program: {
      inputNumber: state.active,
      input: summarizeInput(findInputByNumber(state, state.active)),
    },
    preview: {
      inputNumber: state.preview,
      input: summarizeInput(findInputByNumber(state, state.preview)),
    },
    mixes: (state.mixes ?? []).map((mix) => ({
      number: mix.number,
      activeInputNumber: mix.active,
      activeInput: summarizeInput(findInputByNumber(state, mix.active)),
      previewInputNumber: mix.preview,
      previewInput: summarizeInput(findInputByNumber(state, mix.preview)),
    })),
    recording: state.recording,
    streaming: state.streaming,
    external: state.external,
    fadeToBlack: state.fadeToBlack,
    activeOverlayCount: state.overlays.filter((inputNumber) => inputNumber !== null).length,
  };
}

function addChange(
  changes: SnapshotChange[],
  category: ChangeCategory,
  severity: ChangeSeverity,
  label: string,
  before: unknown,
  after: unknown,
  detail?: string,
  input?: VmixInput
): void {
  changes.push({
    category,
    severity,
    label,
    before,
    after,
    detail,
    input: input ? { number: input.number, title: input.title, type: input.type } : undefined,
  });
}

function compareScalar(
  changes: SnapshotChange[],
  category: ChangeCategory,
  severity: ChangeSeverity,
  label: string,
  before: unknown,
  after: unknown,
  detail?: string
): void {
  if (before !== after) {
    addChange(changes, category, severity, label, before, after, detail);
  }
}

function compareShowState(before: VmixState, after: VmixState, changes: SnapshotChange[]): void {
  compareScalar(changes, 'showState', 'info', 'vMix version changed', before.version, after.version);
  compareScalar(changes, 'showState', 'info', 'vMix edition changed', before.edition, after.edition);
  compareScalar(changes, 'showState', 'warning', 'Recording state changed', before.recording, after.recording);
  compareScalar(changes, 'showState', 'warning', 'Streaming state changed', before.streaming, after.streaming);
  compareScalar(changes, 'showState', 'info', 'External output state changed', before.external, after.external);

  if (before.fadeToBlack !== after.fadeToBlack) {
    addChange(
      changes,
      'showState',
      after.fadeToBlack ? 'critical' : 'info',
      'Fade to Black state changed',
      before.fadeToBlack,
      after.fadeToBlack,
      after.fadeToBlack ? 'Program output may now be black.' : 'Fade to Black is no longer active.'
    );
  }
}

function compareProgramPreview(before: VmixState, after: VmixState, changes: SnapshotChange[]): void {
  if (before.active !== after.active) {
    addChange(
      changes,
      'programPreview',
      'warning',
      'Program input changed',
      summarizeInput(findInputByNumber(before, before.active)),
      summarizeInput(findInputByNumber(after, after.active)),
      `Program changed from input ${before.active} to input ${after.active}.`
    );
  }

  if (before.preview !== after.preview) {
    addChange(
      changes,
      'programPreview',
      'info',
      'Preview input changed',
      summarizeInput(findInputByNumber(before, before.preview)),
      summarizeInput(findInputByNumber(after, after.preview)),
      `Preview changed from input ${before.preview} to input ${after.preview}.`
    );
  }
}

function compareMixes(before: VmixState, after: VmixState, changes: SnapshotChange[]): void {
  const beforeMap = new Map((before.mixes ?? []).map((mix) => [mix.number, mix]));
  const afterMap = new Map((after.mixes ?? []).map((mix) => [mix.number, mix]));
  const mixNumbers = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  for (const number of mixNumbers) {
    const beforeMix = beforeMap.get(number);
    const afterMix = afterMap.get(number);

    if (!beforeMix && afterMix) {
      addChange(
        changes,
        'mix',
        'info',
        `Mix ${number} appeared`,
        null,
        {
          activeInput: summarizeInput(findInputByNumber(after, afterMix.active)),
          previewInput: summarizeInput(findInputByNumber(after, afterMix.preview)),
        },
        `Mix ${number} appeared in the after snapshot.`
      );
      continue;
    }

    if (beforeMix && !afterMix) {
      addChange(
        changes,
        'mix',
        'warning',
        `Mix ${number} disappeared`,
        {
          activeInput: summarizeInput(findInputByNumber(before, beforeMix.active)),
          previewInput: summarizeInput(findInputByNumber(before, beforeMix.preview)),
        },
        null,
        `Mix ${number} is no longer visible in the after snapshot.`
      );
      continue;
    }

    if (!beforeMix || !afterMix) continue;

    if (beforeMix.active !== afterMix.active) {
      addChange(
        changes,
        'mix',
        'warning',
        `Mix ${number} active input changed`,
        summarizeInput(findInputByNumber(before, beforeMix.active)),
        summarizeInput(findInputByNumber(after, afterMix.active)),
        `Mix ${number} active changed from input ${beforeMix.active} to input ${afterMix.active}.`
      );
    }

    if (beforeMix.preview !== afterMix.preview) {
      addChange(
        changes,
        'mix',
        'info',
        `Mix ${number} preview input changed`,
        summarizeInput(findInputByNumber(before, beforeMix.preview)),
        summarizeInput(findInputByNumber(after, afterMix.preview)),
        `Mix ${number} preview changed from input ${beforeMix.preview} to input ${afterMix.preview}.`
      );
    }
  }
}

function compareInputs(before: VmixState, after: VmixState, changes: SnapshotChange[]): void {
  const beforeMap = new Map(before.inputs.map((input) => [inputIdentity(input), input]));
  const afterMap = new Map(after.inputs.map((input) => [inputIdentity(input), input]));

  for (const [id, beforeInput] of beforeMap) {
    const afterInput = afterMap.get(id);

    if (!afterInput) {
      addChange(
        changes,
        'inputInventory',
        'warning',
        'Input removed',
        summarizeInput(beforeInput),
        null,
        `${inputLabel(beforeInput)} is no longer present.`,
        beforeInput
      );
      continue;
    }

    compareInputProperties(beforeInput, afterInput, changes);
  }

  for (const [id, afterInput] of afterMap) {
    if (!beforeMap.has(id)) {
      addChange(
        changes,
        'inputInventory',
        'info',
        'Input added',
        null,
        summarizeInput(afterInput),
        `${inputLabel(afterInput)} was added.`,
        afterInput
      );
    }
  }
}

function compareInputProperties(before: VmixInput, after: VmixInput, changes: SnapshotChange[]): void {
  const detailPrefix = `${inputLabel(after)} changed`;

  if (before.number !== after.number) {
    addChange(changes, 'inputProperty', 'warning', 'Input number changed', before.number, after.number, detailPrefix, after);
  }

  if (before.title !== after.title) {
    addChange(changes, 'inputProperty', 'info', 'Input title changed', before.title, after.title, detailPrefix, after);
  }

  if (before.type !== after.type) {
    addChange(changes, 'inputProperty', 'warning', 'Input type changed', before.type, after.type, detailPrefix, after);
  }

  if (before.state !== after.state) {
    addChange(changes, 'inputProperty', 'info', 'Input playback state changed', before.state, after.state, detailPrefix, after);
  }

  if (before.position !== after.position && (before.duration > 0 || after.duration > 0)) {
    addChange(changes, 'inputProperty', 'info', 'Input playback position changed', before.position, after.position, detailPrefix, after);
  }

  if (before.duration !== after.duration) {
    addChange(changes, 'inputProperty', 'info', 'Input duration changed', before.duration, after.duration, detailPrefix, after);
  }

  if (before.loop !== after.loop) {
    addChange(changes, 'inputProperty', 'info', 'Input loop state changed', before.loop, after.loop, detailPrefix, after);
  }

  if (before.muted !== after.muted) {
    addChange(
      changes,
      'inputProperty',
      after.muted ? 'warning' : 'info',
      'Input mute state changed',
      before.muted,
      after.muted,
      after.muted ? `${inputLabel(after)} is now muted.` : `${inputLabel(after)} is now unmuted.`,
      after
    );
  }

  if (before.audioBuses !== after.audioBuses) {
    addChange(
      changes,
      'inputProperty',
      'warning',
      'Input audio bus routing changed',
      before.audioBuses,
      after.audioBuses,
      `${inputLabel(after)} bus routing changed.`,
      after
    );
  }

  compareTitleFields(before, after, changes);
}

function compareTitleFields(before: VmixInput, after: VmixInput, changes: SnapshotChange[]): void {
  const beforeFields = before.fields ?? {};
  const afterFields = after.fields ?? {};
  const fieldNames = new Set([...Object.keys(beforeFields), ...Object.keys(afterFields)]);

  for (const fieldName of fieldNames) {
    const hadField = Object.prototype.hasOwnProperty.call(beforeFields, fieldName);
    const hasField = Object.prototype.hasOwnProperty.call(afterFields, fieldName);

    if (!hadField && hasField) {
      addChange(
        changes,
        'titleField',
        'info',
        'Title field added',
        null,
        { fieldName, value: afterFields[fieldName] },
        `${fieldName} was added on ${inputLabel(after)}.`,
        after
      );
      continue;
    }

    if (hadField && !hasField) {
      addChange(
        changes,
        'titleField',
        'warning',
        'Title field removed',
        { fieldName, value: beforeFields[fieldName] },
        null,
        `${fieldName} was removed from ${inputLabel(after)}.`,
        after
      );
      continue;
    }

    if (beforeFields[fieldName] !== afterFields[fieldName]) {
      addChange(
        changes,
        'titleField',
        'info',
        'Title field value changed',
        { fieldName, value: beforeFields[fieldName] },
        { fieldName, value: afterFields[fieldName] },
        `${fieldName} changed on ${inputLabel(after)}.`,
        after
      );
    }
  }
}

function compareOverlays(before: VmixState, after: VmixState, changes: SnapshotChange[]): void {
  const maxChannels = Math.max(before.overlays.length, after.overlays.length);

  for (let index = 0; index < maxChannels; index++) {
    const beforeInputNumber = before.overlays[index] ?? null;
    const afterInputNumber = after.overlays[index] ?? null;

    if (beforeInputNumber !== afterInputNumber) {
      addChange(
        changes,
        'overlay',
        'warning',
        `Overlay channel ${index + 1} changed`,
        summarizeInput(beforeInputNumber ? findInputByNumber(before, beforeInputNumber) : null),
        summarizeInput(afterInputNumber ? findInputByNumber(after, afterInputNumber) : null),
        `Overlay channel ${index + 1} changed from ${beforeInputNumber ?? 'empty'} to ${afterInputNumber ?? 'empty'}.`
      );
    }
  }
}

function compareAudio(before: VmixState, after: VmixState, changes: SnapshotChange[]): void {
  for (const bus of AUDIO_BUS_NAMES) {
    const beforeChannel = getAudioChannel(before.audio, bus);
    const afterChannel = getAudioChannel(after.audio, bus);
    const label = bus === 'M' ? 'Master' : `Bus ${bus}`;

    if (beforeChannel === null && afterChannel !== null) {
      addChange(changes, 'audio', 'info', `${label} output appeared`, null, afterChannel);
      continue;
    }

    if (beforeChannel !== null && afterChannel === null) {
      addChange(changes, 'audio', 'warning', `${label} output disappeared`, beforeChannel, null);
      continue;
    }

    if (!beforeChannel || !afterChannel) continue;

    if (beforeChannel.muted !== afterChannel.muted) {
      addChange(
        changes,
        'audio',
        afterChannel.muted ? 'warning' : 'info',
        `${label} mute state changed`,
        beforeChannel.muted,
        afterChannel.muted,
        afterChannel.muted ? `${label} is now muted.` : `${label} is now unmuted.`
      );
    }

    if (beforeChannel.volume !== afterChannel.volume) {
      addChange(
        changes,
        'audio',
        afterChannel.volume < beforeChannel.volume ? 'warning' : 'info',
        `${label} volume changed`,
        beforeChannel.volume,
        afterChannel.volume
      );
    }
  }
}

function summarizeChangeCounts(changes: SnapshotChange[]) {
  const bySeverity = {
    critical: changes.filter((change) => change.severity === 'critical').length,
    warning: changes.filter((change) => change.severity === 'warning').length,
    info: changes.filter((change) => change.severity === 'info').length,
  };

  const byCategory: Record<ChangeCategory, number> = {
    showState: 0,
    programPreview: 0,
    mix: 0,
    inputInventory: 0,
    inputProperty: 0,
    overlay: 0,
    audio: 0,
    titleField: 0,
  };

  for (const change of changes) {
    byCategory[change.category] += 1;
  }

  return {
    total: changes.length,
    bySeverity,
    byCategory,
  };
}

function buildRecommendations(changes: SnapshotChange[]): string[] {
  const recommendations: string[] = [];

  if (changes.some((change) => change.severity === 'critical')) {
    recommendations.push('Review critical show-state changes before using the after snapshot in production.');
  }

  if (changes.some((change) => change.category === 'programPreview')) {
    recommendations.push('Confirm Program and Preview are in the intended state after the change.');
  }

  if (changes.some((change) => change.category === 'mix')) {
    recommendations.push('Confirm each parsed mix active/preview path and whether plans need an explicit Mix parameter.');
  }

  if (changes.some((change) => change.category === 'audio')) {
    recommendations.push('Check audio outputs and bus routing after this snapshot change.');
  }

  if (changes.some((change) => change.category === 'titleField')) {
    recommendations.push('If scripts depend on title fields, validate exact field names and values again.');
  }

  if (changes.some((change) => change.category === 'inputInventory')) {
    recommendations.push('Regenerate or revalidate scripts that reference inputs added or removed between snapshots.');
  }

  if (recommendations.length === 0) {
    recommendations.push('No parsed vMix state differences were detected.');
  }

  return recommendations;
}

function buildSnapshotConfidence(
  before: VmixState,
  after: VmixState,
  changes: SnapshotChange[]
) {
  const criticalCount = changes.filter((change) => change.severity === 'critical').length;
  const warningCount = changes.filter((change) => change.severity === 'warning').length;
  const keyedBefore = before.inputs.filter((input) => input.key.length > 0).length;
  const keyedAfter = after.inputs.filter((input) => input.key.length > 0).length;
  const totalInputs = before.inputs.length + after.inputs.length;
  const keyCoverage = totalInputs > 0 ? (keyedBefore + keyedAfter) / totalInputs : 0.5;

  return buildAnalysisConfidence(
    [
      {
        name: 'snapshotParsing',
        score: 0.9,
        weight: 2,
        reason: 'Both supplied XML snapshots parsed successfully.',
      },
      {
        name: 'inputIdentityCoverage',
        score: keyCoverage,
        weight: 1.5,
        reason: `${keyedBefore + keyedAfter} of ${totalInputs} input appearances include stable keys.`,
      },
      {
        name: 'changeSeverityLoad',
        score: Math.max(0.5, 1 - criticalCount * 0.12 - warningCount * 0.04),
        weight: 1,
        reason: `${criticalCount} critical and ${warningCount} warning change(s) were detected.`,
      },
    ],
    'Confidence reflects parse success, stable input-key coverage, and severity of detected changes.'
  );
}

function buildSnapshotAssumptions(before: VmixState, after: VmixState) {
  return [
    assumptionDetail(
      'The supplied XML strings are comparable vMix snapshots.',
      'Both snapshots are parsed through the same normalized state parser.',
      'high',
      0.9
    ),
    assumptionDetail(
      'Inputs with stable keys represent the same source across snapshots.',
      `${before.inputs.length} before input(s) and ${after.inputs.length} after input(s) were matched by key when available.`,
      'medium',
      0.86
    ),
    assumptionDetail(
      'This is a normalized state comparison, not a raw XML diff.',
      'Unparsed attributes, mix output destinations, triggers, list internals, virtual set internals, and replay details can be absent from change detection.',
      'medium',
      0.74
    ),
  ];
}

export const compareXmlSnapshotsTool = createTool({
  name: 'vmix_compare_xml_snapshots',
  description:
    'Read-only comparison of two vMix XML snapshots. Explains parsed changes in show state, Program/Preview, ' +
    'mixes, inputs, overlays, audio outputs, routing, playback metadata, and title fields without touching live vMix.',
  schema: z.object({
    beforeXml: z.string().min(1).describe('Earlier vMix XML snapshot.'),
    afterXml: z.string().min(1).describe('Later vMix XML snapshot.'),
    beforeLabel: z.string().optional().describe('Optional label for the earlier snapshot.'),
    afterLabel: z.string().optional().describe('Optional label for the later snapshot.'),
  }),
  handler: (
    {
      beforeXml,
      afterXml,
      beforeLabel,
      afterLabel,
    }: { beforeXml: string; afterXml: string; beforeLabel?: string; afterLabel?: string },
    _ctx: ToolContext
  ) => {
    const resolvedBeforeLabel = beforeLabel ?? 'before';
    const resolvedAfterLabel = afterLabel ?? 'after';
    const beforeParsed = parseSnapshot(resolvedBeforeLabel, beforeXml);
    const afterParsed = parseSnapshot(resolvedAfterLabel, afterXml);
    const parseErrors = [beforeParsed.error, afterParsed.error].filter((error): error is string => error !== null);

    if (parseErrors.length > 0 || beforeParsed.state === null || afterParsed.state === null) {
      return Promise.resolve({
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                mode: 'readOnlyXmlSnapshotComparison',
                valid: false,
                errors: parseErrors,
                execution: {
                  executed: false,
                  note: 'This tool only parses supplied XML strings and never contacts vMix.',
                },
                analysisConfidence: buildAnalysisConfidence(
                  [
                    {
                      name: 'snapshotParsing',
                      score: 0.2,
                      reason: 'At least one supplied XML snapshot could not be parsed as vMix XML.',
                    },
                  ],
                  'Confidence is low because parsing failed.'
                ),
                assumptionDetails: [
                  assumptionDetail(
                    'Both snapshots need a <vmix> root element for comparison.',
                    'Parsing failed before normalized state comparison could run.',
                    'high',
                    0.95
                  ),
                ],
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      });
    }

    const changes: SnapshotChange[] = [];
    compareShowState(beforeParsed.state, afterParsed.state, changes);
    compareProgramPreview(beforeParsed.state, afterParsed.state, changes);
    compareMixes(beforeParsed.state, afterParsed.state, changes);
    compareInputs(beforeParsed.state, afterParsed.state, changes);
    compareOverlays(beforeParsed.state, afterParsed.state, changes);
    compareAudio(beforeParsed.state, afterParsed.state, changes);

    const result = {
      mode: 'readOnlyXmlSnapshotComparison',
      execution: {
        executed: false,
        note: 'This tool compares supplied XML strings only. It never reads live state or calls vMix API functions.',
      },
      labels: {
        before: resolvedBeforeLabel,
        after: resolvedAfterLabel,
      },
      valid: true,
      summary: {
        before: summarizeSnapshot(beforeParsed.state),
        after: summarizeSnapshot(afterParsed.state),
        changes: summarizeChangeCounts(changes),
      },
      changes,
      recommendations: buildRecommendations(changes),
      analysisConfidence: buildSnapshotConfidence(beforeParsed.state, afterParsed.state, changes),
      assumptions: [
        'Snapshots are compared through the current normalized parser rather than a raw XML tree diff.',
        'Inputs are matched by stable key when available, falling back to input number when key is missing.',
      ],
      assumptionDetails: buildSnapshotAssumptions(beforeParsed.state, afterParsed.state),
      parserLimitations: [
        'Mix output destinations, layers, lists, data sources, virtual set internals, triggers, replay details, and all raw XML attributes are not deeply parsed yet.',
        'Self-closing overlay tags and absent audio buses may normalize to empty/default parser values.',
      ],
    };

    return Promise.resolve(toolJsonContent(result));
  },
});

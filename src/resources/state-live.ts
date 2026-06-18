/**
 * vmix://state/live - richer live vMix state snapshot
 */

import { createResource, jsonContent, type ResourceContext } from './base.js';
import { getStateRelationships } from '../state/relationships.js';

function percent(position: number, duration: number): number | null {
  if (duration <= 0) return null;
  return Number(Math.min(100, Math.max(0, (position / duration) * 100)).toFixed(2));
}

function summarizeInput(input: Awaited<ReturnType<ResourceContext['state']['getState']>>['inputs'][number]) {
  const remainingMs = input.duration > 0 ? Math.max(0, input.duration - input.position) : null;

  return {
    number: input.number,
    key: input.key,
    title: input.title,
    type: input.type,
    state: input.state,
    positionMs: input.position,
    durationMs: input.duration,
    remainingMs,
    progressPercent: percent(input.position, input.duration),
    loop: input.loop,
    muted: input.muted,
    audioBuses: input.audioBuses,
    audioBusList: input.audioBusList ?? [],
    meters: input.meters ?? null,
    selectedIndex: input.selectedIndex ?? null,
    hasFields: Object.keys(input.fields ?? {}).length > 0,
    fieldNames: Object.keys(input.fields ?? {}),
    layerCount: input.layers?.length ?? 0,
  };
}

export const stateLiveResource = createResource({
  name: 'vMix Live State',
  uri: 'vmix://state/live',
  description:
    'Richer live vMix state snapshot with Program/Preview, mixes, playback position, mute, routing, fields, and meters.',
  mimeType: 'application/json',
  handler: async (ctx: ResourceContext) => {
    const state = await ctx.state.getState();
    const relationships = getStateRelationships(state);
    const activeInput = state.inputs.find((input) => input.number === state.active) ?? null;
    const previewInput = state.inputs.find((input) => input.number === state.preview) ?? null;
    const mixInputCount = state.inputs.filter((input) => input.type.toLowerCase() === 'mix').length;

    const liveState = {
      version: state.version,
      edition: state.edition,
      outputs: {
        recording: state.recording,
        // vMix reports recording duration in seconds
        recordingDurationSeconds: state.recordingDuration,
        streaming: state.streaming,
        external: state.external,
        fadeToBlack: state.fadeToBlack,
      },
      program: {
        inputNumber: state.active,
        inputTitle: activeInput?.title ?? null,
      },
      preview: {
        inputNumber: state.preview,
        inputTitle: previewInput?.title ?? null,
      },
      mixes: relationships.mixes,
      mixesMeta: {
        parsedMixCount: relationships.mixes.length,
        mixInputCount,
        note:
          'parsedMixCount reflects active/preview paths from a vMix <mixes> state section. Mix-type inputs can exist even when vMix does not expose parsed mix paths.',
      },
      overlays: state.overlayChannels ?? [],
      audio: {
        master: state.audio.master,
        routing: state.audioRouting ?? null,
      },
      inputs: state.inputs.map(summarizeInput),
      parserLimitations: [
        'This snapshot includes parsed XML values only; mix output destinations, aux bus destinations, triggers, data sources, and some GT internals may still be unavailable.',
        'The mixes array represents parsed mix active/preview paths, not the inventory of Mix-type inputs.',
        'Playback positions and meters are point-in-time values and should be re-read to detect movement.',
      ],
    };

    return {
      contents: [jsonContent('vmix://state/live', liveState)],
    };
  },
});

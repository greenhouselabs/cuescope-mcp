/**
 * vmix://audio - Audio Levels and Mute States
 * Provides audio information for master and all inputs
 */

import { createResource, jsonContent, type ResourceContext } from './base.js';
import { createAudioRouting } from '../state/normalized-topology.js';

export const audioResource = createResource({
  name: 'vMix Audio Status',
  uri: 'vmix://audio',
  description: 'Audio Levels and Mute States (JSON) - master and per-input audio info',
  mimeType: 'application/json',
  handler: async (ctx: ResourceContext) => {
    const state = await ctx.state.getState();
    const routing = state.audioRouting ?? createAudioRouting(state.inputs, state.audio);

    const audioInfo = {
      master: state.audio.master,
      routing,
      inputs: state.inputs.map((i) => ({
        number: i.number,
        title: i.title,
        muted: i.muted,
        buses: i.audioBuses,
        busList: i.audioBusList ?? [],
        meters: i.meters ?? null,
      })),
    };

    return {
      contents: [jsonContent('vmix://audio', audioInfo)],
    };
  },
});

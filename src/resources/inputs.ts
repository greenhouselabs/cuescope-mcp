/**
 * vmix://inputs - All vMix Inputs
 * Provides a JSON list of all inputs with their properties
 */

import { createResource, jsonContent, type ResourceContext } from './base.js';

export const inputsResource = createResource({
  name: 'vMix Inputs',
  uri: 'vmix://inputs',
  description: 'All vMix Inputs (JSON) - input names, types, states, and audio routing',
  mimeType: 'application/json',
  handler: async (ctx: ResourceContext) => {
    const state = await ctx.state.getState();

    const inputs = state.inputs.map((i) => ({
      number: i.number,
      title: i.title,
      type: i.type,
      state: i.state,
      key: i.key,
      position: i.position,
      duration: i.duration,
      muted: i.muted,
      audioBuses: i.audioBuses,
      audioBusList: i.audioBusList ?? [],
      selectedIndex: i.selectedIndex ?? null,
      meters: i.meters ?? null,
      layerCount: i.layers?.length ?? 0,
      hasFields: i.fields !== undefined && Object.keys(i.fields).length > 0,
    }));

    return {
      contents: [jsonContent('vmix://inputs', inputs)],
    };
  },
});

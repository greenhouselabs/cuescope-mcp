/**
 * vmix://state/relationships - Normalized state relationships
 */

import { createResource, jsonContent, type ResourceContext } from './base.js';
import { getStateRelationships } from '../state/relationships.js';

export const stateRelationshipsResource = createResource({
  name: 'vMix State Relationships',
  uri: 'vmix://state/relationships',
  mimeType: 'application/json',
  description:
    'Normalized vMix state relationships (JSON) - Program/Preview inputs, overlays, ' +
    'mix active/preview paths, audio bus routing, title fields, and likely input usage.',
  handler: async (ctx: ResourceContext) => {
    const state = await ctx.state.getState();
    const relationships = getStateRelationships(state);
    const mixInputCount = state.inputs.filter((input) => input.type.toLowerCase() === 'mix').length;

    return {
      contents: [
        jsonContent('vmix://state/relationships', {
          ...relationships,
          mixesMeta: {
            parsedMixCount: relationships.mixes.length,
            mixInputCount,
            note:
              'mixes lists parsed mix active/preview paths from the vMix <mixes> state section. Mix-type inputs can still appear in the input inventory when no parsed mix paths are exposed.',
          },
        }),
      ],
    };
  },
});

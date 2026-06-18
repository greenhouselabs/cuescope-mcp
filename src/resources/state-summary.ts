/**
 * vmix://state/summary - vMix State Summary
 * Provides a JSON summary of the current vMix state
 */

import { createResource, jsonContent, type ResourceContext } from './base.js';

export const stateSummaryResource = createResource({
  name: 'vMix State Summary',
  uri: 'vmix://state/summary',
  description: 'vMix State Summary (JSON) - version, recording status, streaming, active inputs',
  mimeType: 'application/json',
  handler: async (ctx: ResourceContext) => {
    const state = await ctx.state.getState();

    const summary = {
      version: state.version,
      edition: state.edition,
      active: state.active,
      preview: state.preview,
      fadeToBlack: state.fadeToBlack,
      recording: state.recording,
      streaming: state.streaming,
      external: state.external,
      inputCount: state.inputs.length,
      activeOverlays: state.overlays.filter((o) => o !== null).length,
    };

    return {
      contents: [jsonContent('vmix://state/summary', summary)],
    };
  },
});

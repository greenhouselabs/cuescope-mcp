/**
 * vmix_overlay_out - Hide overlay channel with transition
 * Uses the overlay's transition settings to fade out
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';

export const overlayOutTool = createTool({
  name: 'vmix_overlay_out',
  description:
    'Hide an overlay channel with a smooth transition effect. ' +
    'The overlay will fade/transition out using the settings configured in vMix. ' +
    'Use this for professional-looking lower third exits and graphic dismissals.',
  schema: z.object({
    channel: z.number().min(1).max(4).describe(
      'Overlay channel (1-4) to hide. The content will transition out smoothly.'
    ),
  }),
  handler: async ({ channel }: { channel: number }, ctx: ToolContext) => {
    await ctx.vmix.http.execute(`OverlayInput${channel}Out`, {});

    return successResult(`Overlay channel ${channel} transitioning out`);
  },
});

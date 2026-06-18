/**
 * vmix_overlay_off - Immediately turn off overlay (no transition)
 * Can target a specific channel or all overlays at once
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';

export const overlayOffTool = createTool({
  name: 'vmix_overlay_off',
  description:
    'Immediately cut off an overlay with no transition effect (instant removal). ' +
    'Use for emergency graphic removal or quick cleanup. ' +
    'Specify a channel (1-4) to turn off one overlay, or omit to turn off ALL overlays at once.',
  schema: z.object({
    channel: z
      .number()
      .min(1)
      .max(4)
      .optional()
      .describe(
        'Overlay channel (1-4) to turn off. Omit this parameter to instantly turn off ALL overlay channels.'
      ),
  }),
  handler: async ({ channel }: { channel?: number }, ctx: ToolContext) => {
    const func = channel ? `OverlayInput${channel}Off` : 'OverlayInputAllOff';
    await ctx.vmix.http.execute(func, {});

    const message = channel
      ? `Overlay channel ${channel} turned off`
      : 'All overlay channels turned off';
    return successResult(message);
  },
});

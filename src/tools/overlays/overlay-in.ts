/**
 * vmix_overlay_in - Show input on overlay channel with transition
 * Overlay channels 1-4 available
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema, MixSchema, OverlayChannelSchema } from '../../validation/schemas.js';

export const overlayInTool = createTool({
  name: 'vmix_overlay_in',
  description:
    'Show an input on an overlay channel (1-4) with a smooth transition effect. ' +
    'Overlays appear on top of the program output - perfect for lower thirds, logos, PIP windows, and graphics. ' +
    'The transition uses the settings configured for that overlay channel in vMix.',
  schema: z.object({
    channel: OverlayChannelSchema.describe(
      'Overlay channel (1-4). Each channel is a separate layer. Channel 1 is typically used for lower thirds.'
    ),
    input: InputReferenceSchema.describe(
      'The input to show on the overlay - can be a number, name ("Lower Third"), or GUID'
    ),
    mix: MixSchema.optional().describe(
      'Mix output to show overlay on (0-3). Optional - defaults to main output.'
    ),
  }),
  handler: async (
    { channel, input, mix }: { channel: number; input: string | number; mix?: number },
    ctx: ToolContext
  ) => {
    const params: Record<string, string | number | undefined> = {
      Input: ctx.vmix.normalizeInput(input),
    };

    if (mix !== undefined) {
      params.Mix = mix;
    }

    await ctx.vmix.http.execute(`OverlayInput${channel}In`, params);

    const mixLabel = mix !== undefined && mix > 0 ? ` on Mix ${mix}` : '';
    return successResult(`"${input}" showing on overlay channel ${channel}${mixLabel}`);
  },
});

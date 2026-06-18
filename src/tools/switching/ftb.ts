/**
 * vmix_switch_ftb - Fade to Black control
 */

import { z } from 'zod';
import { createTool, successResult } from '../base.js';
import { FtbStateSchema } from '../../validation/index.js';

export const ftbTool = createTool({
  name: 'vmix_switch_ftb',
  description:
    'Control Fade to Black (FTB) - fades the entire program output to a black screen. ' +
    'Commonly used during breaks, at the end of shows, or for emergency situations. ' +
    'Audio continues unless separately muted.',
  schema: z.object({
    state: FtbStateSchema.describe(
      "Action to take: 'on' fades to black, 'off' restores video, 'toggle' switches between states"
    ),
  }),
  handler: async ({ state }, ctx) => {
    if (state === 'toggle') {
      await ctx.vmix.http.execute('FadeToBlack');
      return successResult('Fade to Black toggled');
    }

    // Get current state to determine if we need to toggle
    const currentState = await ctx.state.getState();
    const isCurrentlyFTB = currentState.fadeToBlack;
    const needsToggle =
      (state === 'on' && !isCurrentlyFTB) || (state === 'off' && isCurrentlyFTB);

    if (needsToggle) {
      await ctx.vmix.http.execute('FadeToBlack');
    }

    if (state === 'on') {
      return successResult(needsToggle ? 'Fading to black...' : 'Already at black');
    } else {
      return successResult(needsToggle ? 'Restoring video from black' : 'Video already visible');
    }
  },
});

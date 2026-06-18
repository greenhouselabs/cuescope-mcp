/**
 * vmix_switch_stinger - Use a stinger (animated) transition
 */

import { z } from 'zod';
import { createTool, successResult } from '../base.js';
import { InputReferenceSchema, StingerNumberSchema } from '../../validation/index.js';

export const stingerTool = createTool({
  name: 'vmix_switch_stinger',
  description:
    'Switch to an input using a stinger transition - an animated overlay (like a logo wipe or swoosh) ' +
    'that plays during the transition. vMix supports 4 stinger slots. ' +
    'Stingers must be pre-configured in vMix settings.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'The input to switch to - can be a number (1, 2, 3), name ("Camera 1"), or GUID'
    ),
    stinger: StingerNumberSchema.describe(
      'Stinger slot number (1-4). Each slot can have a different animated transition configured in vMix.'
    ),
  }),
  handler: async ({ input, stinger }, ctx) => {
    await ctx.vmix.http.execute(`Stinger${stinger}`, {
      Input: ctx.vmix.normalizeInput(input),
    });
    return successResult(`Stinger ${stinger} transition to "${input}"`);
  },
});

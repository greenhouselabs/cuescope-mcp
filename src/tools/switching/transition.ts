/**
 * vmix_switch_transition - Use a specific transition effect
 */

import { z } from 'zod';
import { createTool, successResult } from '../base.js';
import {
  InputReferenceSchema,
  TransitionEffectSchema,
  DurationSchema,
} from '../../validation/index.js';

export const transitionTool = createTool({
  name: 'vmix_switch_transition',
  description:
    'Switch to an input using a specific transition effect like Zoom, Wipe, Slide, Fly, CrossZoom, ' +
    'FlyRotate, Cube, CubeZoom, VerticalWipe, VerticalSlide, Merge, or WipeReverse. ' +
    'Use this for more dynamic, stylized transitions.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'The input to transition to - can be a number (1, 2, 3), name ("Camera 1"), or GUID'
    ),
    effect: TransitionEffectSchema.describe(
      'Transition effect: Zoom, Wipe, Slide, Fly, CrossZoom, FlyRotate, Cube, CubeZoom, ' +
        'VerticalWipe, VerticalSlide, Merge, WipeReverse'
    ),
    duration: DurationSchema.describe(
      'Transition duration in milliseconds (e.g., 1000 = 1 second)'
    ),
  }),
  handler: async ({ input, effect, duration }, ctx) => {
    await ctx.vmix.http.execute(effect, {
      Input: ctx.vmix.normalizeInput(input),
      Duration: duration,
    });
    const durationSec = (duration / 1000).toFixed(1);
    return successResult(`${effect} transition to "${input}" over ${durationSec}s`);
  },
});

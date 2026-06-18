/**
 * vmix_switch_fade - Fade/dissolve transition to an input
 */

import { z } from 'zod';
import { createTool, successResult } from '../base.js';
import { InputReferenceSchema, MixSchema, DurationSchema } from '../../validation/index.js';
import { resolveInput, formatResolveError } from '../../utils/input-resolver.js';

export const fadeTool = createTool({
  name: 'vmix_switch_fade',
  description:
    'Smoothly transition to an input using a fade/dissolve effect. ' +
    'The current and new input will blend together over the specified duration. ' +
    'Great for softer transitions between shots.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'The input to fade to - can be a number (1, 2, 3), name ("Camera 1"), or GUID'
    ),
    duration: DurationSchema.describe(
      'Transition duration in milliseconds (e.g., 1000 = 1 second, 500 = half second)'
    ),
    mix: MixSchema.describe(
      'Mix bus number (0-3). Use 0 for main output. Optional - defaults to main mix.'
    ),
  }),
  handler: async ({ input, duration, mix }, ctx) => {
    // Pre-validate input with smart matching
    const state = await ctx.state.getState();
    const resolved = resolveInput(state, input);

    if (!resolved.success) {
      return formatResolveError(resolved);
    }

    // Use the resolved input's KEY for API calls (immutable, case-insensitive)
    await ctx.vmix.http.execute('Fade', {
      Input: resolved.key,
      Duration: duration,
      Mix: mix,
    });

    const durationSec = (duration / 1000).toFixed(1);
    const mixLabel = mix !== undefined && mix > 0 ? ` on Mix ${mix}` : '';
    const fuzzyNote = resolved.fuzzyMatch ? ' (matched case-insensitively)' : '';
    return successResult(`Fading to "${resolved.input!.title}" over ${durationSec}s${mixLabel}${fuzzyNote}`);
  },
});

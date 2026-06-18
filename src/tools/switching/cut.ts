/**
 * vmix_switch_cut - Immediately cut to an input
 */

import { z } from 'zod';
import { createTool, successResult } from '../base.js';
import { InputReferenceSchema, MixSchema } from '../../validation/index.js';
import { resolveInput, formatResolveError } from '../../utils/input-resolver.js';

export const cutTool = createTool({
  name: 'vmix_switch_cut',
  description:
    'Instantly switch the program output to a different input (hard cut, no transition effect). ' +
    'Use this for immediate switches like cutting between cameras during a live show.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'The input to switch to - can be a number (1, 2, 3), name ("Camera 1"), or GUID'
    ),
    mix: MixSchema.describe(
      'Mix bus number (0-3). Use 0 for main output. Optional - defaults to main mix.'
    ),
  }),
  handler: async ({ input, mix }, ctx) => {
    // Pre-validate input with smart matching
    const state = await ctx.state.getState();
    const resolved = resolveInput(state, input);

    if (!resolved.success) {
      return formatResolveError(resolved);
    }

    // Use the resolved input's KEY for API calls (immutable, case-insensitive)
    await ctx.vmix.http.execute('Cut', {
      Input: resolved.key,
      Mix: mix,
    });

    const mixLabel = mix !== undefined && mix > 0 ? ` on Mix ${mix}` : '';
    const fuzzyNote = resolved.fuzzyMatch ? ' (matched case-insensitively)' : '';
    return successResult(`Program switched to "${resolved.input!.title}"${mixLabel}${fuzzyNote}`);
  },
});

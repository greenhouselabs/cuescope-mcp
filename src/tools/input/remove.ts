/**
 * vmix_input_remove - Remove an input from vMix
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';
import { normalizeInput } from '../../utils/input-normalizer.js';

export const removeInputTool = createTool({
  name: 'vmix_input_remove',
  description:
    'Remove an input from vMix. Can reference by number, name (case-sensitive), or GUID. ' +
    'Warning: This permanently removes the input from the current session.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Input to remove: number (1, 2, 3), name ("Camera 1"), or GUID'
    ),
  }),
  handler: async ({ input }: { input: string | number }, ctx: ToolContext) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('RemoveInput', { Input: inputRef });

    return successResult(`Removed input: ${inputRef}`);
  },
});

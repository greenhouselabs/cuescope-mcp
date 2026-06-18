/**
 * vmix_input_reset - Reset an input to its default state
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';
import { normalizeInput } from '../../utils/input-normalizer.js';

export const resetInputTool = createTool({
  name: 'vmix_input_reset',
  description:
    'Reset an input to its default state. This resets zoom, pan, crop, colour correction, ' +
    'and other visual adjustments back to their defaults.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Input to reset: number (1, 2, 3), name ("Camera 1"), or GUID'
    ),
  }),
  handler: async ({ input }: { input: string | number }, ctx: ToolContext) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('ResetInput', { Input: inputRef });

    return successResult(`Reset input ${inputRef} to default state`);
  },
});

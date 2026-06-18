/**
 * vmix_input_rename - Rename an input in vMix
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';
import { normalizeInput } from '../../utils/input-normalizer.js';

export const renameInputTool = createTool({
  name: 'vmix_input_rename',
  description:
    'Rename an input in vMix. The name is used for display and can be referenced in other tools. ' +
    'Input names are case-sensitive when referenced.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Input to rename: number (1, 2, 3), current name ("Camera 1"), or GUID'
    ),
    name: z
      .string()
      .min(1, 'Name cannot be empty')
      .describe('New name for the input'),
  }),
  handler: async (
    { input, name }: { input: string | number; name: string },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('SetInputName', { Input: inputRef, Value: name });

    return successResult(`Renamed input ${inputRef} to "${name}"`);
  },
});

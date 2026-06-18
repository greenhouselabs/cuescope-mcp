/**
 * vmix_input_move - Move an input to a new position in the input list
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';
import { normalizeInput } from '../../utils/input-normalizer.js';

export const moveInputTool = createTool({
  name: 'vmix_input_move',
  description:
    'Move an input to a different position in the input list. ' +
    'Position 1 is the first slot. Moving to position 3 places the input third in the list.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Input to move: number (1, 2, 3), name ("Camera 1"), or GUID'
    ),
    position: z
      .number()
      .int()
      .positive()
      .describe('New position for the input (1-based index)'),
  }),
  handler: async (
    { input, position }: { input: string | number; position: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('MoveInput', { Input: inputRef, Value: position.toString() });

    return successResult(`Moved input ${inputRef} to position ${position}`);
  },
});

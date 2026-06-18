/**
 * Title preset controls - switch between title presets
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';
import { normalizeInput } from '../../utils/input-normalizer.js';

/**
 * vmix_title_preset - Select a specific title preset by index
 */
export const titlePresetTool = createTool({
  name: 'vmix_title_preset',
  description:
    'Select a specific title preset by index. Title inputs can have multiple presets ' +
    '(variations of the design). Index starts at 0.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Title input: number (1, 2), name ("Lower Third"), or GUID'
    ),
    index: z
      .number()
      .int()
      .min(0)
      .describe('Preset index to select (0-based)'),
  }),
  handler: async (
    { input, index }: { input: string | number; index: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('SelectTitlePreset', {
      Input: inputRef,
      Value: index.toString(),
    });

    return successResult(`Selected preset ${index} on ${inputRef}`);
  },
});

/**
 * vmix_title_preset_next - Cycle to next title preset
 */
export const titlePresetNextTool = createTool({
  name: 'vmix_title_preset_next',
  description:
    'Cycle to the next title preset. Useful for cycling through variations without knowing the count.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Title input: number (1, 2), name ("Lower Third"), or GUID'
    ),
  }),
  handler: async ({ input }: { input: string | number }, ctx: ToolContext) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('NextTitlePreset', { Input: inputRef });

    return successResult(`Cycled to next preset on ${inputRef}`);
  },
});

/**
 * vmix_title_preset_prev - Cycle to previous title preset
 */
export const titlePresetPrevTool = createTool({
  name: 'vmix_title_preset_prev',
  description:
    'Cycle to the previous title preset. Useful for cycling through variations backwards.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Title input: number (1, 2), name ("Lower Third"), or GUID'
    ),
  }),
  handler: async ({ input }: { input: string | number }, ctx: ToolContext) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('PreviousTitlePreset', { Input: inputRef });

    return successResult(`Cycled to previous preset on ${inputRef}`);
  },
});

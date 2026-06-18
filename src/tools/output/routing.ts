/**
 * Output routing controls - configure vMix outputs
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';
import { normalizeInput } from '../../utils/input-normalizer.js';

const OutputNumberSchema = z
  .number()
  .int()
  .min(2)
  .max(4)
  .describe('Output number (2-4). Output 1 is always Program.');

const OutputSourceSchema = z.enum([
  'Preview',
  'Program',
  'MultiView',
  'Input',
]);

/**
 * vmix_output_set - Configure an auxiliary output
 */
export const outputSetTool = createTool({
  name: 'vmix_output_set',
  description:
    'Configure what is sent to auxiliary outputs 2-4. ' +
    'Can be set to Preview, Program, MultiView, or a specific Input.',
  schema: z.object({
    output: OutputNumberSchema,
    source: OutputSourceSchema.describe('Source type for the output'),
    input: InputReferenceSchema.optional().describe(
      'Input reference (required when source is "Input")'
    ),
  }),
  handler: async (
    {
      output,
      source,
      input,
    }: { output: number; source: z.infer<typeof OutputSourceSchema>; input?: string | number },
    ctx: ToolContext
  ) => {
    if (source === 'Input') {
      if (!input) {
        return {
          content: [{ type: 'text' as const, text: 'Input is required when source is "Input"' }],
          isError: true,
        };
      }
      const inputRef = normalizeInput(input);
      await ctx.vmix.http.execute(`SetOutput${output}`, { Value: `Input`, Input: inputRef });
      return successResult(`Set Output ${output} to input ${inputRef}`);
    }

    await ctx.vmix.http.execute(`SetOutput${output}`, { Value: source });
    return successResult(`Set Output ${output} to ${source}`);
  },
});

/**
 * vmix_output_fullscreen - Control fullscreen output
 */
export const outputFullscreenTool = createTool({
  name: 'vmix_output_fullscreen',
  description:
    'Enable or disable fullscreen output. Fullscreen displays vMix output on a connected display.',
  schema: z.object({
    enabled: z.boolean().describe('true to enable fullscreen, false to disable'),
  }),
  handler: async ({ enabled }: { enabled: boolean }, ctx: ToolContext) => {
    const func = enabled ? 'FullscreenOn' : 'FullscreenOff';
    await ctx.vmix.http.execute(func);

    return successResult(`${enabled ? 'Enabled' : 'Disabled'} fullscreen output`);
  },
});

/**
 * vmix_output_external - Control external output
 */
export const outputExternalTool = createTool({
  name: 'vmix_output_external',
  description:
    'Enable or disable external output (e.g., for capture cards, NDI output).',
  schema: z.object({
    enabled: z.boolean().describe('true to enable external output, false to disable'),
  }),
  handler: async ({ enabled }: { enabled: boolean }, ctx: ToolContext) => {
    // vMix API: StartExternal / StopExternal control the external output.
    const func = enabled ? 'StartExternal' : 'StopExternal';
    await ctx.vmix.http.execute(func);

    return successResult(`${enabled ? 'Enabled' : 'Disabled'} external output`);
  },
});

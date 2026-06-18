/**
 * Color correction controls - adjust input colors
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';
import { normalizeInput } from '../../utils/input-normalizer.js';

const ColorValueSchema = z
  .number()
  .min(-1)
  .max(1)
  .describe('Color adjustment value (-1 to 1, 0 = no change)');

/**
 * vmix_cc_hue - Adjust hue
 */
export const ccHueTool = createTool({
  name: 'vmix_cc_hue',
  description: 'Adjust the hue (color rotation) of an input.',
  schema: z.object({
    input: InputReferenceSchema.describe('Input to adjust'),
    value: ColorValueSchema.describe('Hue adjustment (-1 to 1)'),
  }),
  handler: async (
    { input, value }: { input: string | number; value: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('SetCCHue', {
      Input: inputRef,
      Value: value.toString(),
    });
    return successResult(`Set hue to ${value} on ${inputRef}`);
  },
});

/**
 * vmix_cc_saturation - Adjust saturation
 */
export const ccSaturationTool = createTool({
  name: 'vmix_cc_saturation',
  description: 'Adjust the saturation (color intensity) of an input.',
  schema: z.object({
    input: InputReferenceSchema.describe('Input to adjust'),
    value: ColorValueSchema.describe('Saturation adjustment (-1 to 1)'),
  }),
  handler: async (
    { input, value }: { input: string | number; value: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('SetCCSaturation', {
      Input: inputRef,
      Value: value.toString(),
    });
    return successResult(`Set saturation to ${value} on ${inputRef}`);
  },
});

/**
 * vmix_cc_lift - Adjust lift (shadows)
 */
export const ccLiftTool = createTool({
  name: 'vmix_cc_lift',
  description:
    'Adjust lift (shadow tones) for an input. Can adjust R, G, B individually or all together.',
  schema: z.object({
    input: InputReferenceSchema.describe('Input to adjust'),
    r: ColorValueSchema.optional().describe('Red lift'),
    g: ColorValueSchema.optional().describe('Green lift'),
    b: ColorValueSchema.optional().describe('Blue lift'),
    all: ColorValueSchema.optional().describe('All channels lift (overrides individual)'),
  }),
  handler: async (
    { input, r, g, b, all }: { input: string | number; r?: number; g?: number; b?: number; all?: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    const changes: string[] = [];

    if (all !== undefined) {
      await ctx.vmix.http.execute('SetCCLiftR', { Input: inputRef, Value: all.toString() });
      await ctx.vmix.http.execute('SetCCLiftG', { Input: inputRef, Value: all.toString() });
      await ctx.vmix.http.execute('SetCCLiftB', { Input: inputRef, Value: all.toString() });
      changes.push(`all: ${all}`);
    } else {
      if (r !== undefined) {
        await ctx.vmix.http.execute('SetCCLiftR', { Input: inputRef, Value: r.toString() });
        changes.push(`R: ${r}`);
      }
      if (g !== undefined) {
        await ctx.vmix.http.execute('SetCCLiftG', { Input: inputRef, Value: g.toString() });
        changes.push(`G: ${g}`);
      }
      if (b !== undefined) {
        await ctx.vmix.http.execute('SetCCLiftB', { Input: inputRef, Value: b.toString() });
        changes.push(`B: ${b}`);
      }
    }

    if (changes.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No lift values specified.' }], isError: true };
    }
    return successResult(`Set lift (${changes.join(', ')}) on ${inputRef}`);
  },
});

/**
 * vmix_cc_gamma - Adjust gamma (midtones)
 */
export const ccGammaTool = createTool({
  name: 'vmix_cc_gamma',
  description:
    'Adjust gamma (midtones) for an input. Can adjust R, G, B individually or all together.',
  schema: z.object({
    input: InputReferenceSchema.describe('Input to adjust'),
    r: ColorValueSchema.optional().describe('Red gamma'),
    g: ColorValueSchema.optional().describe('Green gamma'),
    b: ColorValueSchema.optional().describe('Blue gamma'),
    all: ColorValueSchema.optional().describe('All channels gamma (overrides individual)'),
  }),
  handler: async (
    { input, r, g, b, all }: { input: string | number; r?: number; g?: number; b?: number; all?: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    const changes: string[] = [];

    if (all !== undefined) {
      await ctx.vmix.http.execute('SetCCGammaR', { Input: inputRef, Value: all.toString() });
      await ctx.vmix.http.execute('SetCCGammaG', { Input: inputRef, Value: all.toString() });
      await ctx.vmix.http.execute('SetCCGammaB', { Input: inputRef, Value: all.toString() });
      changes.push(`all: ${all}`);
    } else {
      if (r !== undefined) {
        await ctx.vmix.http.execute('SetCCGammaR', { Input: inputRef, Value: r.toString() });
        changes.push(`R: ${r}`);
      }
      if (g !== undefined) {
        await ctx.vmix.http.execute('SetCCGammaG', { Input: inputRef, Value: g.toString() });
        changes.push(`G: ${g}`);
      }
      if (b !== undefined) {
        await ctx.vmix.http.execute('SetCCGammaB', { Input: inputRef, Value: b.toString() });
        changes.push(`B: ${b}`);
      }
    }

    if (changes.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No gamma values specified.' }], isError: true };
    }
    return successResult(`Set gamma (${changes.join(', ')}) on ${inputRef}`);
  },
});

/**
 * vmix_cc_gain - Adjust gain (highlights)
 */
export const ccGainTool = createTool({
  name: 'vmix_cc_gain',
  description:
    'Adjust gain (highlights) for an input. Can adjust R, G, B individually or all together.',
  schema: z.object({
    input: InputReferenceSchema.describe('Input to adjust'),
    r: ColorValueSchema.optional().describe('Red gain'),
    g: ColorValueSchema.optional().describe('Green gain'),
    b: ColorValueSchema.optional().describe('Blue gain'),
    all: ColorValueSchema.optional().describe('All channels gain (overrides individual)'),
  }),
  handler: async (
    { input, r, g, b, all }: { input: string | number; r?: number; g?: number; b?: number; all?: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    const changes: string[] = [];

    if (all !== undefined) {
      await ctx.vmix.http.execute('SetCCGainR', { Input: inputRef, Value: all.toString() });
      await ctx.vmix.http.execute('SetCCGainG', { Input: inputRef, Value: all.toString() });
      await ctx.vmix.http.execute('SetCCGainB', { Input: inputRef, Value: all.toString() });
      changes.push(`all: ${all}`);
    } else {
      if (r !== undefined) {
        await ctx.vmix.http.execute('SetCCGainR', { Input: inputRef, Value: r.toString() });
        changes.push(`R: ${r}`);
      }
      if (g !== undefined) {
        await ctx.vmix.http.execute('SetCCGainG', { Input: inputRef, Value: g.toString() });
        changes.push(`G: ${g}`);
      }
      if (b !== undefined) {
        await ctx.vmix.http.execute('SetCCGainB', { Input: inputRef, Value: b.toString() });
        changes.push(`B: ${b}`);
      }
    }

    if (changes.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No gain values specified.' }], isError: true };
    }
    return successResult(`Set gain (${changes.join(', ')}) on ${inputRef}`);
  },
});

/**
 * vmix_cc_auto - Auto color correction
 */
export const ccAutoTool = createTool({
  name: 'vmix_cc_auto',
  description: 'Automatically adjust color correction based on the current frame.',
  schema: z.object({
    input: InputReferenceSchema.describe('Input to auto-correct'),
  }),
  handler: async ({ input }: { input: string | number }, ctx: ToolContext) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('ColourCorrectionAuto', { Input: inputRef });
    return successResult(`Applied auto color correction to ${inputRef}`);
  },
});

/**
 * vmix_cc_reset - Reset color correction
 */
export const ccResetTool = createTool({
  name: 'vmix_cc_reset',
  description: 'Reset all color correction settings to default.',
  schema: z.object({
    input: InputReferenceSchema.describe('Input to reset'),
  }),
  handler: async ({ input }: { input: string | number }, ctx: ToolContext) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('ColourCorrectionReset', { Input: inputRef });
    return successResult(`Reset color correction on ${inputRef}`);
  },
});

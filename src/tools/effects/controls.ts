/**
 * Effects controls - input effects 1-4
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';
import { normalizeInput } from '../../utils/input-normalizer.js';

const EffectNumberSchema = z
  .number()
  .int()
  .min(1)
  .max(4)
  .describe('Effect slot number (1-4)');

/**
 * vmix_effect_toggle - Toggle an effect on/off
 */
export const effectToggleTool = createTool({
  name: 'vmix_effect_toggle',
  description: 'Toggle an effect slot (1-4) on or off for an input.',
  schema: z.object({
    input: InputReferenceSchema.describe('Input to control'),
    effect: EffectNumberSchema,
  }),
  handler: async (
    { input, effect }: { input: string | number; effect: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute(`Effect${effect}`, { Input: inputRef });
    return successResult(`Toggled effect ${effect} on ${inputRef}`);
  },
});

/**
 * vmix_effect_on - Enable an effect
 */
export const effectOnTool = createTool({
  name: 'vmix_effect_on',
  description: 'Enable an effect slot (1-4) for an input.',
  schema: z.object({
    input: InputReferenceSchema.describe('Input to control'),
    effect: EffectNumberSchema,
  }),
  handler: async (
    { input, effect }: { input: string | number; effect: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute(`Effect${effect}On`, { Input: inputRef });
    return successResult(`Enabled effect ${effect} on ${inputRef}`);
  },
});

/**
 * vmix_effect_off - Disable an effect
 */
export const effectOffTool = createTool({
  name: 'vmix_effect_off',
  description: 'Disable an effect slot (1-4) for an input.',
  schema: z.object({
    input: InputReferenceSchema.describe('Input to control'),
    effect: EffectNumberSchema,
  }),
  handler: async (
    { input, effect }: { input: string | number; effect: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute(`Effect${effect}Off`, { Input: inputRef });
    return successResult(`Disabled effect ${effect} on ${inputRef}`);
  },
});

/**
 * vmix_effect_strength - Set effect intensity
 */
export const effectStrengthTool = createTool({
  name: 'vmix_effect_strength',
  description: 'Set the strength/intensity of an effect (0-1).',
  schema: z.object({
    input: InputReferenceSchema.describe('Input to control'),
    effect: EffectNumberSchema,
    strength: z
      .number()
      .min(0)
      .max(1)
      .describe('Effect strength (0 = none, 1 = full)'),
  }),
  handler: async (
    { input, effect, strength }: { input: string | number; effect: number; strength: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute(`SetEffect${effect}Strength`, {
      Input: inputRef,
      Value: strength.toString(),
    });
    return successResult(`Set effect ${effect} strength to ${strength} on ${inputRef}`);
  },
});

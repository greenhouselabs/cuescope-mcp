/**
 * Layer visibility controls - show/hide layers on inputs
 * Layers allow compositing multiple sources on a single input
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';
import { normalizeInput } from '../../utils/input-normalizer.js';

const LayerSchema = z
  .number()
  .int()
  .min(1)
  .max(10)
  .describe('Layer number (1-10)');

/**
 * vmix_layer_on - Show a layer
 */
export const layerOnTool = createTool({
  name: 'vmix_layer_on',
  description:
    'Show/enable a layer on an input. Layers (1-10) allow compositing multiple sources. ' +
    'The layer must first be configured with vmix_layer_set.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Input to control: number (1, 2), name ("Camera 1"), or GUID'
    ),
    layer: LayerSchema,
  }),
  handler: async (
    { input, layer }: { input: string | number; layer: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    // Correct API: LayerOn with Input and Value (layer number)
    await ctx.vmix.http.execute('LayerOn', { Input: inputRef, Value: layer.toString() });

    return successResult(`Enabled layer ${layer} on ${inputRef}`);
  },
});

/**
 * vmix_layer_off - Hide a layer
 */
export const layerOffTool = createTool({
  name: 'vmix_layer_off',
  description: 'Hide/disable a layer on an input.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Input to control: number (1, 2), name ("Camera 1"), or GUID'
    ),
    layer: LayerSchema,
  }),
  handler: async (
    { input, layer }: { input: string | number; layer: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    // Correct API: LayerOff with Input and Value (layer number)
    await ctx.vmix.http.execute('LayerOff', { Input: inputRef, Value: layer.toString() });

    return successResult(`Disabled layer ${layer} on ${inputRef}`);
  },
});

/**
 * vmix_layer_toggle - Toggle a layer on/off
 */
export const layerToggleTool = createTool({
  name: 'vmix_layer_toggle',
  description: 'Toggle a layer visibility on an input.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Input to control: number (1, 2), name ("Camera 1"), or GUID'
    ),
    layer: LayerSchema,
  }),
  handler: async (
    { input, layer }: { input: string | number; layer: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    // Correct API: LayerOnOff with Input and Value (layer number)
    await ctx.vmix.http.execute('LayerOnOff', { Input: inputRef, Value: layer.toString() });

    return successResult(`Toggled layer ${layer} on ${inputRef}`);
  },
});

/**
 * Layer properties - configure what source appears in each layer
 * and layer position/size
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
 * vmix_layer_set - Set the source input for a layer
 */
export const layerSetTool = createTool({
  name: 'vmix_layer_set',
  description:
    'Set which input appears in a layer. This configures the layer source. ' +
    'Use vmix_layer_on to make it visible.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Target input containing the layer: number (1, 2), name ("Picture in Picture"), or GUID'
    ),
    layer: LayerSchema,
    source: InputReferenceSchema.describe(
      'Source input to put in the layer: number, name, or GUID'
    ),
  }),
  handler: async (
    { input, layer, source }: { input: string | number; layer: number; source: string | number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    const sourceRef = normalizeInput(source);

    // SetLayer composes Value as "LayerIndex,SourceInput" - a "," inside the
    // source reference would corrupt the composite value.
    if (sourceRef.includes(',')) {
      return {
        content: [
          {
            type: 'text' as const,
            text:
              `Source input name "${sourceRef}" contains "," which is the SetLayer value separator. ` +
              'Reference the source input by number or GUID instead.',
          },
        ],
        isError: true,
      };
    }

    // Correct API: SetLayer with Value format "LayerIndex,SourceInput"
    await ctx.vmix.http.execute('SetLayer', {
      Input: inputRef,
      Value: `${layer},${sourceRef}`,
    });

    return successResult(`Set layer ${layer} source to ${sourceRef} on ${inputRef}`);
  },
});

/**
 * vmix_layer_position - Set layer position
 */
export const layerPositionTool = createTool({
  name: 'vmix_layer_position',
  description:
    'Set the X/Y position of a layer. Coordinates are relative to the input frame ' +
    '(-2 to 2 range, 0,0 = center).',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Input containing the layer: number (1, 2), name, or GUID'
    ),
    layer: LayerSchema,
    x: z
      .number()
      .min(-2)
      .max(2)
      .optional()
      .describe('Horizontal position (-2 to 2, 0 = center)'),
    y: z
      .number()
      .min(-2)
      .max(2)
      .optional()
      .describe('Vertical position (-2 to 2, 0 = center)'),
  }),
  handler: async (
    { input, layer, x, y }: { input: string | number; layer: number; x?: number; y?: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    const changes: string[] = [];

    if (x !== undefined) {
      await ctx.vmix.http.execute(`SetLayer${layer}PanX`, {
        Input: inputRef,
        Value: x.toString(),
      });
      changes.push(`X: ${x}`);
    }

    if (y !== undefined) {
      await ctx.vmix.http.execute(`SetLayer${layer}PanY`, {
        Input: inputRef,
        Value: y.toString(),
      });
      changes.push(`Y: ${y}`);
    }

    if (changes.length === 0) {
      return {
        content: [{ type: 'text' as const, text: 'No position values specified.' }],
        isError: true,
      };
    }

    return successResult(`Set layer ${layer} position (${changes.join(', ')}) on ${inputRef}`);
  },
});

/**
 * vmix_layer_size - Set layer size/zoom
 */
export const layerSizeTool = createTool({
  name: 'vmix_layer_size',
  description:
    'Set the width, height, or zoom of a layer. ' +
    'Values are relative (1.0 = 100%, 0.5 = 50%, 2.0 = 200%).',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Input containing the layer: number (1, 2), name, or GUID'
    ),
    layer: LayerSchema,
    width: z
      .number()
      .min(0)
      .max(5)
      .optional()
      .describe('Width scale (1.0 = 100%)'),
    height: z
      .number()
      .min(0)
      .max(5)
      .optional()
      .describe('Height scale (1.0 = 100%)'),
    zoom: z
      .number()
      .min(0)
      .max(5)
      .optional()
      .describe('Uniform zoom (1.0 = 100%), sets both width and height'),
  }),
  handler: async (
    {
      input,
      layer,
      width,
      height,
      zoom,
    }: { input: string | number; layer: number; width?: number; height?: number; zoom?: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    const changes: string[] = [];

    // If zoom is set, use it for both dimensions
    if (zoom !== undefined) {
      await ctx.vmix.http.execute(`SetLayer${layer}Zoom`, {
        Input: inputRef,
        Value: zoom.toString(),
      });
      changes.push(`zoom: ${zoom}`);
    } else {
      if (width !== undefined) {
        await ctx.vmix.http.execute(`SetLayer${layer}Width`, {
          Input: inputRef,
          Value: width.toString(),
        });
        changes.push(`width: ${width}`);
      }

      if (height !== undefined) {
        await ctx.vmix.http.execute(`SetLayer${layer}Height`, {
          Input: inputRef,
          Value: height.toString(),
        });
        changes.push(`height: ${height}`);
      }
    }

    if (changes.length === 0) {
      return {
        content: [{ type: 'text' as const, text: 'No size values specified.' }],
        isError: true,
      };
    }

    return successResult(`Set layer ${layer} size (${changes.join(', ')}) on ${inputRef}`);
  },
});

/**
 * vmix_layer_crop - Set layer crop
 */
export const layerCropTool = createTool({
  name: 'vmix_layer_crop',
  description:
    'Set cropping for a layer. Values are 0-1 representing percentage of the frame to crop.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Input containing the layer: number (1, 2), name, or GUID'
    ),
    layer: LayerSchema,
    x1: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Left crop (0 = no crop)'),
    y1: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Top crop (0 = no crop)'),
    x2: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Right crop (1 = no crop)'),
    y2: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Bottom crop (1 = no crop)'),
  }),
  handler: async (
    {
      input,
      layer,
      x1,
      y1,
      x2,
      y2,
    }: {
      input: string | number;
      layer: number;
      x1?: number;
      y1?: number;
      x2?: number;
      y2?: number;
    },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);

    // Apply all crop values
    const cropX1 = x1 ?? 0;
    const cropY1 = y1 ?? 0;
    const cropX2 = x2 ?? 1;
    const cropY2 = y2 ?? 1;

    await ctx.vmix.http.execute(`SetLayer${layer}CropX1`, {
      Input: inputRef,
      Value: cropX1.toString(),
    });
    await ctx.vmix.http.execute(`SetLayer${layer}CropY1`, {
      Input: inputRef,
      Value: cropY1.toString(),
    });
    await ctx.vmix.http.execute(`SetLayer${layer}CropX2`, {
      Input: inputRef,
      Value: cropX2.toString(),
    });
    await ctx.vmix.http.execute(`SetLayer${layer}CropY2`, {
      Input: inputRef,
      Value: cropY2.toString(),
    });

    return successResult(
      `Set layer ${layer} crop (${cropX1}, ${cropY1}) to (${cropX2}, ${cropY2}) on ${inputRef}`
    );
  },
});

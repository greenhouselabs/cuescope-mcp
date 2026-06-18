/**
 * vmix_input_properties - Set visual properties of an input
 * Controls zoom, pan, alpha, and crop
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';
import { normalizeInput } from '../../utils/input-normalizer.js';

export const inputPropertiesTool = createTool({
  name: 'vmix_input_properties',
  description:
    'Set visual properties of an input including zoom, pan position, alpha (transparency), and crop. ' +
    'All parameters are optional - only specified values will be changed.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Input to modify: number (1, 2, 3), name ("Camera 1"), or GUID'
    ),
    zoom: z
      .number()
      .min(0)
      .max(5)
      .optional()
      .describe('Zoom level (1.0 = 100%, 2.0 = 200%, etc.)'),
    panX: z
      .number()
      .min(-2)
      .max(2)
      .optional()
      .describe('Horizontal pan position (-2 to 2, 0 = center)'),
    panY: z
      .number()
      .min(-2)
      .max(2)
      .optional()
      .describe('Vertical pan position (-2 to 2, 0 = center)'),
    alpha: z
      .number()
      .int()
      .min(0)
      .max(255)
      .optional()
      .describe('Alpha/transparency (0 = fully transparent, 255 = fully opaque)'),
    cropX1: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Left crop position (0-1, 0 = no crop)'),
    cropY1: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Top crop position (0-1, 0 = no crop)'),
    cropX2: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Right crop position (0-1, 1 = no crop)'),
    cropY2: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Bottom crop position (0-1, 1 = no crop)'),
  }),
  handler: async (
    {
      input,
      zoom,
      panX,
      panY,
      alpha,
      cropX1,
      cropY1,
      cropX2,
      cropY2,
    }: {
      input: string | number;
      zoom?: number;
      panX?: number;
      panY?: number;
      alpha?: number;
      cropX1?: number;
      cropY1?: number;
      cropX2?: number;
      cropY2?: number;
    },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    const changes: string[] = [];

    // Apply each property if specified
    if (zoom !== undefined) {
      await ctx.vmix.http.execute('SetZoom', { Input: inputRef, Value: zoom.toString() });
      changes.push(`zoom: ${zoom}`);
    }

    if (panX !== undefined) {
      await ctx.vmix.http.execute('SetPanX', { Input: inputRef, Value: panX.toString() });
      changes.push(`panX: ${panX}`);
    }

    if (panY !== undefined) {
      await ctx.vmix.http.execute('SetPanY', { Input: inputRef, Value: panY.toString() });
      changes.push(`panY: ${panY}`);
    }

    if (alpha !== undefined) {
      await ctx.vmix.http.execute('SetAlpha', { Input: inputRef, Value: alpha.toString() });
      changes.push(`alpha: ${alpha}`);
    }

    // Crop requires all 4 values set together
    if (
      cropX1 !== undefined ||
      cropY1 !== undefined ||
      cropX2 !== undefined ||
      cropY2 !== undefined
    ) {
      const x1 = cropX1 ?? 0;
      const y1 = cropY1 ?? 0;
      const x2 = cropX2 ?? 1;
      const y2 = cropY2 ?? 1;

      await ctx.vmix.http.execute('SetCropX1', { Input: inputRef, Value: x1.toString() });
      await ctx.vmix.http.execute('SetCropY1', { Input: inputRef, Value: y1.toString() });
      await ctx.vmix.http.execute('SetCropX2', { Input: inputRef, Value: x2.toString() });
      await ctx.vmix.http.execute('SetCropY2', { Input: inputRef, Value: y2.toString() });
      changes.push(`crop: (${x1}, ${y1}) to (${x2}, ${y2})`);
    }

    if (changes.length === 0) {
      return {
        content: [{ type: 'text' as const, text: 'No properties specified to change.' }],
        isError: true,
      };
    }

    return successResult(`Updated input ${inputRef}: ${changes.join(', ')}`);
  },
});

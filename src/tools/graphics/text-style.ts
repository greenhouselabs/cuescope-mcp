/**
 * Title text styling controls - color and visibility
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';
import { normalizeInput } from '../../utils/input-normalizer.js';

/**
 * vmix_title_text_color - Set text color
 */
export const textColorTool = createTool({
  name: 'vmix_title_text_color',
  description:
    'Set the color of a text field in a title. Color should be in HTML format (#RRGGBB or #AARRGGBB). ' +
    'The field name should match a text element in the title template (e.g., "Headline.Text").',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Title input: number (1, 2), name ("Lower Third"), or GUID'
    ),
    field: z
      .string()
      .describe('Text field name (e.g., "Headline.Text", "Name.Text")'),
    color: z
      .string()
      .regex(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, 'Invalid color format. Use #RRGGBB or #AARRGGBB')
      .describe('Color in HTML format (#RRGGBB or #AARRGGBB for transparency)'),
  }),
  handler: async (
    { input, field, color }: { input: string | number; field: string; color: string },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('SetTextColour', {
      Input: inputRef,
      SelectedName: field,
      Value: color,
    });

    return successResult(`Set color of "${field}" to ${color} on ${inputRef}`);
  },
});

/**
 * vmix_title_text_visible - Show/hide text field
 */
export const textVisibleTool = createTool({
  name: 'vmix_title_text_visible',
  description:
    'Show or hide a text field in a title. Useful for conditional display of elements ' +
    'like sponsors, subtitles, or optional info.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Title input: number (1, 2), name ("Lower Third"), or GUID'
    ),
    field: z
      .string()
      .describe('Text field name (e.g., "Headline.Text", "Subtitle.Text")'),
    visible: z
      .boolean()
      .describe('true to show, false to hide'),
  }),
  handler: async (
    { input, field, visible }: { input: string | number; field: string; visible: boolean },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    // vMix uses SetTextVisibleOn/SetTextVisibleOff
    const func = visible ? 'SetTextVisibleOn' : 'SetTextVisibleOff';
    await ctx.vmix.http.execute(func, {
      Input: inputRef,
      SelectedName: field,
    });

    return successResult(`${visible ? 'Showed' : 'Hid'} "${field}" on ${inputRef}`);
  },
});

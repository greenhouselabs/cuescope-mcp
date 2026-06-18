/**
 * vmix_title_set_text - Update text field in a title/GT input
 * Works with standard titles and GT Designer titles
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';

export const setTextTool = createTool({
  name: 'vmix_title_set_text',
  description:
    'Update a text field in a Title or GT (Graphics Template) input. ' +
    'Use this to change lower thirds, scoreboards, name straps, tickers, or any text-based graphic. ' +
    "For GT templates, field names use dot notation like 'Headline.Text' or 'Name.Text'.",
  schema: z.object({
    input: InputReferenceSchema.describe(
      'The title/GT input to update - can be a number (1, 2, 3), name ("Lower Third"), or GUID'
    ),
    field: z.string().describe(
      "The text field to update. Standard titles use simple names. GT templates use dot notation: " +
        "'Headline.Text', 'Name.Text', 'Score1.Text', etc."
    ),
    value: z.string().describe('The new text to display in the field'),
  }),
  handler: async (
    { input, field, value }: { input: string | number; field: string; value: string },
    ctx: ToolContext
  ) => {
    await ctx.vmix.http.execute('SetText', {
      Input: ctx.vmix.normalizeInput(input),
      SelectedName: field,
      Value: value,
    });

    const shortValue = value.length > 30 ? value.substring(0, 30) + '...' : value;
    return successResult(`Updated "${field}" on "${input}" to "${shortValue}"`);
  },
});

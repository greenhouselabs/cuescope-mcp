/**
 * vmix_title_set_image - Update image field in a title/GT input
 * Works with standard titles and GT Designer titles
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';

export const setImageTool = createTool({
  name: 'vmix_title_set_image',
  description:
    'Update an image field in a Title or GT (Graphics Template) input. ' +
    'Use this to change logos, photos, team emblems, or any image placeholder in your graphics. ' +
    "For GT templates, field names use dot notation like 'Logo.Source' or 'Photo.Source'.",
  schema: z.object({
    input: InputReferenceSchema.describe(
      'The title/GT input to update - can be a number (1, 2, 3), name ("Lower Third"), or GUID'
    ),
    field: z.string().describe(
      "The image field to update. GT templates use dot notation: 'Logo.Source', 'Photo.Source', 'TeamLogo.Source'"
    ),
    path: z.string().describe(
      'Full file path to the image (e.g., "C:\\Graphics\\logo.png"), or empty string to clear the image'
    ),
  }),
  handler: async (
    { input, field, path }: { input: string | number; field: string; path: string },
    ctx: ToolContext
  ) => {
    await ctx.vmix.http.execute('SetImage', {
      Input: ctx.vmix.normalizeInput(input),
      SelectedName: field,
      Value: path,
    });

    const action = path ? 'updated' : 'cleared';
    return successResult(`Image "${field}" on "${input}" ${action}`);
  },
});

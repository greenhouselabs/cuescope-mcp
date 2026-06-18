/**
 * PTZ virtual input controls - create virtual PTZ from static cameras
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';
import { normalizeInput } from '../../utils/input-normalizer.js';

/**
 * vmix_ptz_virtual_create - Create a virtual PTZ input
 */
export const ptzVirtualCreateTool = createTool({
  name: 'vmix_ptz_virtual_create',
  description:
    'Create a virtual PTZ input from a high-resolution source. ' +
    'Virtual PTZ allows digital pan/tilt/zoom on static cameras.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Source input to create virtual PTZ from: number (1, 2), name, or GUID'
    ),
  }),
  handler: async ({ input }: { input: string | number }, ctx: ToolContext) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('PTZCreateVirtualInput', { Input: inputRef });

    return successResult(`Created virtual PTZ input from ${inputRef}`);
  },
});

/**
 * vmix_ptz_virtual_update - Update virtual PTZ position
 */
export const ptzVirtualUpdateTool = createTool({
  name: 'vmix_ptz_virtual_update',
  description:
    'Update the virtual PTZ input to match current pan/zoom settings. ' +
    'Call after adjusting zoom/pan to apply changes to the virtual input.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Virtual PTZ input: number (1, 2), name, or GUID'
    ),
  }),
  handler: async ({ input }: { input: string | number }, ctx: ToolContext) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('PTZUpdateVirtualInput', { Input: inputRef });

    return successResult(`Updated virtual PTZ input ${inputRef}`);
  },
});

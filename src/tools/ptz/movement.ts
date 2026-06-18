/**
 * PTZ movement controls - pan, tilt, zoom for PTZ cameras
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';
import { normalizeInput } from '../../utils/input-normalizer.js';

const DirectionSchema = z.enum([
  'Up',
  'Down',
  'Left',
  'Right',
  'UpLeft',
  'UpRight',
  'DownLeft',
  'DownRight',
]);

const SpeedSchema = z
  .number()
  .min(0)
  .max(1)
  .default(0.5)
  .describe('Movement speed (0-1, where 1 is fastest)');

/**
 * vmix_ptz_move - Move PTZ camera in a direction
 */
export const ptzMoveTool = createTool({
  name: 'vmix_ptz_move',
  description:
    'Move a PTZ camera in the specified direction. Movement continues until stopped.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'PTZ camera input: number (1, 2), name ("PTZ Camera"), or GUID'
    ),
    direction: DirectionSchema.describe('Direction to move'),
    speed: SpeedSchema,
  }),
  handler: async (
    { input, direction, speed }: { input: string | number; direction: string; speed: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute(`PTZMove${direction}`, {
      Input: inputRef,
      Value: speed.toString(),
    });

    return successResult(`Moving ${inputRef} ${direction} at speed ${speed}`);
  },
});

/**
 * vmix_ptz_stop - Stop PTZ movement
 */
export const ptzStopTool = createTool({
  name: 'vmix_ptz_stop',
  description: 'Stop all PTZ camera movement.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'PTZ camera input: number (1, 2), name ("PTZ Camera"), or GUID'
    ),
  }),
  handler: async ({ input }: { input: string | number }, ctx: ToolContext) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('PTZMoveStop', { Input: inputRef });

    return successResult(`Stopped PTZ movement on ${inputRef}`);
  },
});

/**
 * vmix_ptz_home - Return PTZ to home position
 */
export const ptzHomeTool = createTool({
  name: 'vmix_ptz_home',
  description: 'Return PTZ camera to its home/default position.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'PTZ camera input: number (1, 2), name ("PTZ Camera"), or GUID'
    ),
  }),
  handler: async ({ input }: { input: string | number }, ctx: ToolContext) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('PTZHome', { Input: inputRef });

    return successResult(`Returned ${inputRef} to home position`);
  },
});

/**
 * vmix_ptz_zoom - Zoom PTZ camera in or out
 */
export const ptzZoomTool = createTool({
  name: 'vmix_ptz_zoom',
  description: 'Zoom a PTZ camera in or out. Zoom continues until stopped.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'PTZ camera input: number (1, 2), name ("PTZ Camera"), or GUID'
    ),
    direction: z.enum(['in', 'out']).describe('Zoom direction'),
    speed: SpeedSchema,
  }),
  handler: async (
    { input, direction, speed }: { input: string | number; direction: 'in' | 'out'; speed: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    const func = direction === 'in' ? 'PTZZoomIn' : 'PTZZoomOut';
    await ctx.vmix.http.execute(func, {
      Input: inputRef,
      Value: speed.toString(),
    });

    return successResult(`Zooming ${inputRef} ${direction} at speed ${speed}`);
  },
});

/**
 * vmix_ptz_zoom_stop - Stop PTZ zoom
 */
export const ptzZoomStopTool = createTool({
  name: 'vmix_ptz_zoom_stop',
  description: 'Stop PTZ camera zoom.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'PTZ camera input: number (1, 2), name ("PTZ Camera"), or GUID'
    ),
  }),
  handler: async ({ input }: { input: string | number }, ctx: ToolContext) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('PTZZoomStop', { Input: inputRef });

    return successResult(`Stopped zoom on ${inputRef}`);
  },
});

/**
 * PTZ focus controls
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';
import { normalizeInput } from '../../utils/input-normalizer.js';

const SpeedSchema = z
  .number()
  .min(0)
  .max(1)
  .default(0.5)
  .describe('Focus speed (0-1)');

/**
 * vmix_ptz_focus - Adjust PTZ focus
 */
export const ptzFocusTool = createTool({
  name: 'vmix_ptz_focus',
  description: 'Adjust PTZ camera focus near or far.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'PTZ camera input: number (1, 2), name ("PTZ Camera"), or GUID'
    ),
    direction: z.enum(['near', 'far']).describe('Focus direction'),
    speed: SpeedSchema,
  }),
  handler: async (
    { input, direction, speed }: { input: string | number; direction: 'near' | 'far'; speed: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    const func = direction === 'near' ? 'PTZFocusNear' : 'PTZFocusFar';
    await ctx.vmix.http.execute(func, {
      Input: inputRef,
      Value: speed.toString(),
    });

    return successResult(`Focusing ${inputRef} ${direction} at speed ${speed}`);
  },
});

/**
 * vmix_ptz_focus_stop - Stop PTZ focus adjustment
 */
export const ptzFocusStopTool = createTool({
  name: 'vmix_ptz_focus_stop',
  description: 'Stop PTZ camera focus adjustment.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'PTZ camera input: number (1, 2), name ("PTZ Camera"), or GUID'
    ),
  }),
  handler: async ({ input }: { input: string | number }, ctx: ToolContext) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('PTZFocusStop', { Input: inputRef });

    return successResult(`Stopped focus on ${inputRef}`);
  },
});

/**
 * vmix_ptz_focus_auto - Set PTZ auto focus mode
 */
export const ptzFocusAutoTool = createTool({
  name: 'vmix_ptz_focus_auto',
  description: 'Enable or disable auto focus on a PTZ camera.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'PTZ camera input: number (1, 2), name ("PTZ Camera"), or GUID'
    ),
    enabled: z.boolean().describe('true for auto focus, false for manual'),
  }),
  handler: async (
    { input, enabled }: { input: string | number; enabled: boolean },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    const func = enabled ? 'PTZFocusAuto' : 'PTZFocusManual';
    await ctx.vmix.http.execute(func, { Input: inputRef });

    return successResult(`Set ${inputRef} to ${enabled ? 'auto' : 'manual'} focus`);
  },
});

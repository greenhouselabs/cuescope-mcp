/**
 * Replay camera/channel selection
 * Note: Replay features require vMix Pro edition
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';

const CameraSchema = z
  .number()
  .int()
  .min(1)
  .max(8)
  .describe('Camera number (1-8)');

const ChannelSchema = z.enum(['A', 'B']).describe('Replay channel (A or B)');

/**
 * vmix_replay_camera - Select replay camera angle
 */
export const replayCameraTool = createTool({
  name: 'vmix_replay_camera',
  description:
    'Select which camera angle to show in replay (1-8). Requires vMix Pro edition.',
  schema: z.object({
    camera: CameraSchema,
  }),
  handler: async ({ camera }: { camera: number }, ctx: ToolContext) => {
    await ctx.vmix.http.execute(`ReplayCamera${camera}`);
    return successResult(`Selected replay camera ${camera}`);
  },
});

/**
 * vmix_replay_channel - Select replay channel
 */
export const replayChannelTool = createTool({
  name: 'vmix_replay_channel',
  description:
    'Select replay channel A or B. Each channel can play different events. ' +
    'Requires vMix Pro edition.',
  schema: z.object({
    channel: ChannelSchema,
  }),
  handler: async ({ channel }: { channel: 'A' | 'B' }, ctx: ToolContext) => {
    await ctx.vmix.http.execute(`ReplaySelectChannel${channel}`);
    return successResult(`Selected replay channel ${channel}`);
  },
});

/**
 * vmix_replay_toggle_event_camera - Toggle camera visibility for a replay event
 */
export const replayToggleEventCameraTool = createTool({
  name: 'vmix_replay_toggle_event_camera',
  description:
    'Toggle whether a camera angle is visible for a replay event. ' +
    'Can toggle for the last event or selected event. Requires vMix Pro edition.',
  schema: z.object({
    camera: CameraSchema,
    event: z.enum(['last', 'selected']).default('last').describe('Which event to toggle'),
  }),
  handler: async (
    { camera, event }: { camera: number; event: 'last' | 'selected' },
    ctx: ToolContext
  ) => {
    // Build function name: ReplayToggleLastEventCamera1-8 or ReplayToggleSelectedEventCamera1-8
    const funcName = (event === 'last' ? 'ReplayToggleLastEventCamera' : 'ReplayToggleSelectedEventCamera') + camera;
    await ctx.vmix.http.execute(funcName);
    return successResult(`Toggled camera ${camera} for ${event} event`);
  },
});

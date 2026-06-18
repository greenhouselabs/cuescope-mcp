/**
 * Replay playback controls
 * Note: Replay features require vMix Pro edition
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';

/**
 * vmix_replay_play - Play replay
 */
export const replayPlayTool = createTool({
  name: 'vmix_replay_play',
  description: 'Play the current replay event. Requires vMix Pro edition.',
  schema: z.object({}),
  handler: async (_params: Record<string, never>, ctx: ToolContext) => {
    await ctx.vmix.http.execute('ReplayPlay');
    return successResult('Playing replay');
  },
});

/**
 * vmix_replay_pause - Pause replay
 */
export const replayPauseTool = createTool({
  name: 'vmix_replay_pause',
  description: 'Pause replay playback. Requires vMix Pro edition.',
  schema: z.object({}),
  handler: async (_params: Record<string, never>, ctx: ToolContext) => {
    await ctx.vmix.http.execute('ReplayPause');
    return successResult('Paused replay');
  },
});

/**
 * vmix_replay_speed - Set replay playback speed
 */
export const replaySpeedTool = createTool({
  name: 'vmix_replay_speed',
  description:
    'Set replay playback speed. 1 = normal, 0.5 = half speed, 2 = double speed. ' +
    'Requires vMix Pro edition.',
  schema: z.object({
    speed: z
      .number()
      .min(0.1)
      .max(4)
      .describe('Playback speed (0.1 to 4, 1 = normal)'),
  }),
  handler: async ({ speed }: { speed: number }, ctx: ToolContext) => {
    await ctx.vmix.http.execute('ReplaySetSpeed', { Value: speed.toString() });
    return successResult(`Set replay speed to ${speed}x`);
  },
});

/**
 * vmix_replay_jump - Jump forward/backward in replay
 */
export const replayJumpTool = createTool({
  name: 'vmix_replay_jump',
  description: 'Jump forward or backward in replay by specified frames. Requires vMix Pro edition.',
  schema: z.object({
    frames: z
      .number()
      .int()
      .describe('Frames to jump (positive = forward, negative = backward)'),
  }),
  handler: async ({ frames }: { frames: number }, ctx: ToolContext) => {
    const func = frames >= 0 ? 'ReplayJumpFrames' : 'ReplayJumpFrames';
    await ctx.vmix.http.execute(func, { Value: frames.toString() });
    return successResult(`Jumped ${frames} frames in replay`);
  },
});

/**
 * vmix_replay_play_event - Play a specific event
 */
export const replayPlayEventTool = createTool({
  name: 'vmix_replay_play_event',
  description: 'Play a specific replay event by index. Requires vMix Pro edition.',
  schema: z.object({
    event: z
      .number()
      .int()
      .min(0)
      .describe('Event index (0-based)'),
  }),
  handler: async ({ event }: { event: number }, ctx: ToolContext) => {
    await ctx.vmix.http.execute('ReplayPlayEvent', { Value: event.toString() });
    return successResult(`Playing replay event ${event}`);
  },
});

/**
 * vmix_replay_play_last - Play most recent event
 */
export const replayPlayLastTool = createTool({
  name: 'vmix_replay_play_last',
  description: 'Play the most recently created replay event. Requires vMix Pro edition.',
  schema: z.object({}),
  handler: async (_params: Record<string, never>, ctx: ToolContext) => {
    await ctx.vmix.http.execute('ReplayPlayLastEvent');
    return successResult('Playing last replay event');
  },
});

/**
 * vmix_stream - Control vMix streaming
 * Start, stop, or toggle streaming. Supports streams 0, 1, and 2.
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { StreamNumberSchema } from '../../validation/schemas.js';

const ACTIONS = ['start', 'stop', 'toggle'] as const;

const ACTION_TO_FUNCTION: Record<(typeof ACTIONS)[number], string> = {
  start: 'StartStreaming',
  stop: 'StopStreaming',
  toggle: 'StartStopStreaming',
};

export const streamTool = createTool({
  name: 'vmix_stream',
  description:
    'Control vMix live streaming. Stream to platforms like YouTube, Twitch, Facebook, or custom RTMP servers. ' +
    'vMix supports up to 3 simultaneous streams (0, 1, 2) to different destinations. ' +
    'Stream destinations and quality are configured in vMix Streaming settings.',
  schema: z.object({
    action: z
      .enum(ACTIONS)
      .default('toggle')
      .describe(
        "'start' = go live, 'stop' = end stream, 'toggle' = switch between live/offline"
      ),
    stream: StreamNumberSchema.describe(
      'Stream slot (0, 1, or 2). Each slot can stream to a different destination. Default is stream 0.'
    ),
  }),
  handler: async (
    { action, stream }: { action: (typeof ACTIONS)[number]; stream: number },
    ctx: ToolContext
  ) => {
    const func = ACTION_TO_FUNCTION[action];
    await ctx.vmix.http.execute(func, { Value: stream });

    const messages: Record<(typeof ACTIONS)[number], string> = {
      start: `Stream ${stream} is now LIVE`,
      stop: `Stream ${stream} ended`,
      toggle: `Stream ${stream} toggled`,
    };

    return successResult(messages[action]);
  },
});

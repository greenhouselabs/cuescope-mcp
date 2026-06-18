/**
 * vmix_playback - Control video playback
 * Play, pause, restart, and position control for video inputs
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';

const ACTIONS = ['play', 'pause', 'restart', 'play_pause'] as const;

const ACTION_TO_FUNCTION: Record<(typeof ACTIONS)[number], string> = {
  play: 'Play',
  pause: 'Pause',
  restart: 'Restart',
  play_pause: 'PlayPause',
};

export const playbackTool = createTool({
  name: 'vmix_playback',
  description:
    'Control playback of video and audio file inputs. ' +
    "Play, pause, restart from beginning, or toggle play/pause state. " +
    'Optionally jump to a specific position before executing the action.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'The video/audio input to control - can be a number (1, 2, 3), name ("Intro Video"), or GUID'
    ),
    action: z.enum(ACTIONS).describe(
      "'play' = start/resume playback, 'pause' = freeze, 'restart' = jump to beginning and play, " +
        "'play_pause' = toggle between play and pause"
    ),
    position_ms: z.number().optional().describe(
      'Jump to this position (in milliseconds) before executing the action. ' +
        'Example: 30000 = 30 seconds into the video.'
    ),
  }),
  handler: async (
    {
      input,
      action,
      position_ms,
    }: { input: string | number; action: (typeof ACTIONS)[number]; position_ms?: number },
    ctx: ToolContext
  ) => {
    const normalizedInput = ctx.vmix.normalizeInput(input);

    // Set position first if specified
    if (position_ms !== undefined) {
      await ctx.vmix.http.execute('SetPosition', {
        Input: normalizedInput,
        Value: position_ms,
      });
    }

    // Execute playback action
    const func = ACTION_TO_FUNCTION[action];
    await ctx.vmix.http.execute(func, { Input: normalizedInput });

    const actionLabels: Record<string, string> = {
      play: 'playing',
      pause: 'paused',
      restart: 'restarted from beginning',
      play_pause: 'play/pause toggled',
    };

    const positionInfo = position_ms !== undefined ? ` at ${(position_ms / 1000).toFixed(1)}s` : '';
    return successResult(`"${input}" ${actionLabels[action]}${positionInfo}`);
  },
});

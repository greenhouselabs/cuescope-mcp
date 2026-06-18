/**
 * vmix_record - Control vMix recording
 * Start, stop, or toggle recording to disk
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';

const ACTIONS = ['start', 'stop', 'toggle'] as const;

const ACTION_TO_FUNCTION: Record<(typeof ACTIONS)[number], string> = {
  start: 'StartRecording',
  stop: 'StopRecording',
  toggle: 'StartStopRecording',
};

export const recordTool = createTool({
  name: 'vmix_record',
  description:
    'Control vMix recording to disk. Records the program output to a video file. ' +
    'File format, quality, and save location are configured in vMix Recording settings. ' +
    "Use 'start' to begin, 'stop' to end, or 'toggle' to switch state.",
  schema: z.object({
    action: z
      .enum(ACTIONS)
      .default('toggle')
      .describe(
        "'start' = begin recording, 'stop' = end recording and save file, 'toggle' = switch between recording/stopped"
      ),
  }),
  handler: async ({ action }: { action: (typeof ACTIONS)[number] }, ctx: ToolContext) => {
    const func = ACTION_TO_FUNCTION[action];
    await ctx.vmix.http.execute(func, {});

    const messages: Record<(typeof ACTIONS)[number], string> = {
      start: 'Recording started - saving to configured location',
      stop: 'Recording stopped - file saved',
      toggle: 'Recording toggled',
    };

    return successResult(messages[action]);
  },
});

/**
 * Replay recording controls - capture replay footage
 * Note: Replay features require vMix Pro edition
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';

/**
 * vmix_replay_record - Start/stop replay recording
 */
export const replayRecordTool = createTool({
  name: 'vmix_replay_record',
  description:
    'Start or stop replay recording. Requires vMix Pro edition. ' +
    'Recording captures footage for instant replay.',
  schema: z.object({
    action: z.enum(['start', 'stop']).describe('Recording action'),
  }),
  handler: async ({ action }: { action: 'start' | 'stop' }, ctx: ToolContext) => {
    const func = action === 'start' ? 'ReplayStartRecording' : 'ReplayStopRecording';
    await ctx.vmix.http.execute(func);
    return successResult(`${action === 'start' ? 'Started' : 'Stopped'} replay recording`);
  },
});

/**
 * vmix_replay_live - Switch to live output
 */
export const replayLiveTool = createTool({
  name: 'vmix_replay_live',
  description: 'Switch replay output back to live. Requires vMix Pro edition.',
  schema: z.object({}),
  handler: async (_params: Record<string, never>, ctx: ToolContext) => {
    await ctx.vmix.http.execute('ReplayLive');
    return successResult('Switched replay to live');
  },
});

/**
 * vmix_replay_mark_in - Set replay in point
 */
export const replayMarkInTool = createTool({
  name: 'vmix_replay_mark_in',
  description: 'Mark the in point for a replay event. Requires vMix Pro edition.',
  schema: z.object({}),
  handler: async (_params: Record<string, never>, ctx: ToolContext) => {
    await ctx.vmix.http.execute('ReplayMarkIn');
    return successResult('Marked replay in point');
  },
});

/**
 * vmix_replay_mark_out - Set replay out point
 */
export const replayMarkOutTool = createTool({
  name: 'vmix_replay_mark_out',
  description:
    'Mark the out point for a replay event and create the event. Requires vMix Pro edition.',
  schema: z.object({}),
  handler: async (_params: Record<string, never>, ctx: ToolContext) => {
    await ctx.vmix.http.execute('ReplayMarkOut');
    return successResult('Marked replay out point and created event');
  },
});

/**
 * vmix_replay_mark_cancel - Cancel current in/out marking
 */
export const replayMarkCancelTool = createTool({
  name: 'vmix_replay_mark_cancel',
  description: 'Cancel the current replay in point marking. Requires vMix Pro edition.',
  schema: z.object({}),
  handler: async (_params: Record<string, never>, ctx: ToolContext) => {
    // ReplayMarkCancel cancels the pending mark. (ReplayMarkInOut would CREATE an event.)
    await ctx.vmix.http.execute('ReplayMarkCancel');
    return successResult('Cancelled replay marking');
  },
});

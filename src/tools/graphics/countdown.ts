/**
 * vmix_title_countdown - Control countdown timer in a title
 * Supports start, stop, pause, set, and adjust actions
 */

import { z } from 'zod';
import { createTool, successResult, errorResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';

const COUNTDOWN_ACTIONS = ['start', 'stop', 'pause', 'set', 'adjust'] as const;

const ACTION_TO_FUNCTION: Record<(typeof COUNTDOWN_ACTIONS)[number], string> = {
  start: 'StartCountdown',
  stop: 'StopCountdown',
  pause: 'PauseCountdown',
  set: 'SetCountdown',
  adjust: 'ChangeCountdown',
};

export const countdownTool = createTool({
  name: 'vmix_title_countdown',
  description:
    'Control a countdown timer in a Title input. ' +
    'Countdowns are useful for show segments, breaks, and live events. ' +
    "Actions: 'start' begins counting, 'stop' resets, 'pause' holds, 'set' changes time, 'adjust' adds/subtracts seconds.",
  schema: z.object({
    input: InputReferenceSchema.describe(
      'The title input containing the countdown - can be a number, name, or GUID'
    ),
    action: z.enum(COUNTDOWN_ACTIONS).describe(
      "'start' = begin countdown, 'stop' = reset to original, 'pause' = freeze, " +
        "'set' = change time (needs value), 'adjust' = add/subtract seconds (needs value)"
    ),
    value: z
      .string()
      .optional()
      .describe(
        "Required for 'set' and 'adjust'. For 'set': time in HH:MM:SS format (e.g., '00:05:00' for 5 minutes). " +
          "For 'adjust': seconds to add/subtract (e.g., '-30' to subtract 30 seconds, '60' to add 1 minute)"
      ),
  }),
  handler: async (
    {
      input,
      action,
      value,
    }: { input: string | number; action: (typeof COUNTDOWN_ACTIONS)[number]; value?: string },
    ctx: ToolContext
  ) => {
    // 'set' and 'adjust' are meaningless without a value - never send
    // SetCountdown/ChangeCountdown without Value.
    // (Enforced here rather than via .refine() because the tool framework
    // registers schema.shape, which a ZodEffects wrapper does not expose.)
    if ((action === 'set' || action === 'adjust') && (value === undefined || value.trim() === '')) {
      return errorResult(
        `'value' is required for the '${action}' action. ` +
          (action === 'set'
            ? "Provide a time in HH:MM:SS format, e.g., '00:05:00'."
            : "Provide seconds to add/subtract, e.g., '60' or '-30'.")
      );
    }

    const func = ACTION_TO_FUNCTION[action];
    const params: Record<string, string | number | undefined> = {
      Input: ctx.vmix.normalizeInput(input),
    };

    if (value !== undefined) {
      params.Value = value;
    }

    await ctx.vmix.http.execute(func, params);

    const actionLabels: Record<string, string> = {
      start: 'started',
      stop: 'stopped and reset',
      pause: 'paused',
      set: `set to ${value}`,
      adjust: `adjusted by ${value} seconds`,
    };

    return successResult(`Countdown on "${input}" ${actionLabels[action]}`);
  },
});

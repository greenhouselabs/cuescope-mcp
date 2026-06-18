/**
 * vmix_batch - Execute multiple vMix commands in sequence
 * Useful for complex operations that require multiple API calls
 */

import { z } from 'zod';
import { createTool, successResult, errorResult, type ToolContext } from '../base.js';
import { delay } from '../../utils/delay.js';
import { isAllowlistedVmixFunction } from '../../validation/script-validator.js';

const CommandSchema = z.object({
  function: z.string().describe('vMix API function name (e.g., "Cut", "SetText", "Fade")'),
  params: z.record(z.unknown()).optional().describe('Parameters for the function (e.g., {Input: "Camera 1"})'),
  delay_after: z
    .number()
    .min(0)
    .max(60000)
    .optional()
    .describe('Milliseconds to wait after this command completes (0-60000)'),
});

export const batchTool = createTool({
  name: 'vmix_batch',
  description:
    'Execute multiple vMix API commands in sequence. ' +
    'Perfect for complex operations like: show lower third, wait 5 seconds, hide it. ' +
    'Each command can have an optional delay after execution. ' +
    'Commands execute in order. If one fails, you can choose to stop or continue.',
  schema: z.object({
    commands: z.array(CommandSchema).min(1).max(50).describe(
      'Array of 1-50 commands to execute in order. Each command has: ' +
        'function (vMix API function name), ' +
        'params (optional parameters object), ' +
        'delay_after (optional ms to wait, 0-60000)'
    ),
    stop_on_error: z.boolean().default(true).describe(
      'If true, stop executing remaining commands when one fails. ' +
        'If false, continue with remaining commands.'
    ),
  }),
  handler: async (
    {
      commands,
      stop_on_error,
    }: {
      commands: Array<{ function: string; params?: Record<string, unknown>; delay_after?: number }>;
      stop_on_error: boolean;
    },
    ctx: ToolContext
  ) => {
    // Validate every function name against the official vMix allowlist before
    // executing anything - reject the whole batch if any name is unknown.
    const unknownFunctions = [
      ...new Set(commands.map((cmd) => cmd.function).filter((fn) => !isAllowlistedVmixFunction(fn))),
    ];
    if (unknownFunctions.length > 0) {
      return errorResult(
        `Batch rejected - unknown vMix function name(s): ${unknownFunctions.join(', ')}.\n\n` +
          'No commands were executed. Function names must match the official vMix shortcut-function list ' +
          '(e.g., "Cut", "Fade", "SetText", "OverlayInput1In").'
      );
    }

    const results: string[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i]!;
      const stepNum = `[${i + 1}/${commands.length}]`;

      try {
        await ctx.vmix.http.execute(
          cmd.function,
          (cmd.params ?? {}) as Record<string, string | number | undefined>
        );
        results.push(`${stepNum} ✓ ${cmd.function}`);
        successCount++;

        if (cmd.delay_after) {
          results.push(`    ⏱ Waited ${cmd.delay_after}ms`);
          await delay(cmd.delay_after);
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
        results.push(`${stepNum} ✗ ${cmd.function}: ${errorMsg}`);
        failCount++;

        if (stop_on_error) {
          results.push(`    ⚠ Stopped - ${commands.length - i - 1} commands skipped`);
          break;
        }
      }
    }

    const status = failCount === 0 ? 'completed successfully' : `completed with ${failCount} error(s)`;
    const summary = `Batch ${status}: ${successCount}/${commands.length} commands executed`;

    return successResult(`${summary}\n\n${results.join('\n')}`);
  },
});

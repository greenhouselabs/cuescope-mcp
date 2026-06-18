/**
 * vmix_script_stop - Stop running scripts
 * Stop a specific script, all scripts, or dynamic scripts
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';

export const stopScriptTool = createTool({
  name: 'vmix_script_stop',
  description:
    'Stop running VB.NET scripts in vMix. ' +
    'Stop a specific script by name, or stop ALL running scripts at once. ' +
    'Use this to halt runaway scripts, end automation sequences, or clean up before running new scripts. ' +
    'By default also stops any inline/dynamic scripts that were started with vmix_script_run.',
  schema: z.object({
    name: z
      .string()
      .optional()
      .describe(
        'Name of a specific script to stop (as shown in vMix Scripting section). ' +
          'Omit to stop ALL running scripts - useful for emergency stop or cleanup.'
      ),
    stop_dynamic: z
      .boolean()
      .default(true)
      .describe(
        'Also stop inline scripts started via vmix_script_run with code parameter. ' +
          'Set to false if you only want to stop saved scripts.'
      ),
  }),
  handler: async (
    { name, stop_dynamic }: { name?: string; stop_dynamic: boolean },
    ctx: ToolContext
  ) => {
    // Stop specific script or all
    if (name) {
      await ctx.vmix.http.execute('ScriptStop', { Value: name });
    } else {
      await ctx.vmix.http.execute('ScriptStopAll', {});
    }

    // Optionally stop dynamic scripts too
    if (stop_dynamic) {
      await ctx.vmix.http.execute('ScriptStopDynamic', {});
    }

    // Build informative message
    const dynamicNote = stop_dynamic ? ' (including dynamic scripts)' : ' (saved scripts only)';
    const message = name
      ? `Script "${name}" stopped${stop_dynamic ? ' + dynamic scripts stopped' : ''}`
      : `All scripts stopped${dynamicNote}`;
    return successResult(message);
  },
});

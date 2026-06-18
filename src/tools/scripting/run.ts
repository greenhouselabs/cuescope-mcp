/**
 * vmix_script_run - Execute a vMix script
 * Run a named script or execute inline VB.NET code
 */

import { z } from 'zod';
import { createTool, successResult, errorResult, type ToolContext } from '../base.js';
import { validateVmixScript } from '../../validation/script-validator.js';

export const runScriptTool = createTool({
  name: 'vmix_script_run',
  description:
    'High-Impact Control only: execute a VB.NET script in vMix. Either run a pre-saved script by name, or execute inline code directly. ' +
    'Inline code is validated before execution to catch common VB.NET mistakes ' +
    '(like missing Sleep() in loops, which would freeze vMix). ' +
    'In default Review Mode, use vmix_generate_script to create reviewable scripts without execution.',
  schema: z.object({
    name: z.string().optional().describe(
      'Name of a script saved in vMix (Scripting section). If provided, runs this saved script.'
    ),
    code: z.string().optional().describe(
      'VB.NET code to execute in High-Impact Control. The code is validated before running. ' +
        'Provide either name or code, never both - the combination is rejected.'
    ),
  }),
  handler: async ({ name, code }: { name?: string; code?: string }, ctx: ToolContext) => {
    // Must provide at least one
    if (!name && !code) {
      return errorResult("Provide either 'name' (for saved scripts) or 'code' (for inline execution)");
    }

    // Providing both is ambiguous - reject instead of silently picking one
    if (name && code) {
      return errorResult(
        "Both 'name' and 'code' were provided - this is ambiguous, so nothing was executed. " +
          "Use 'name' to run a saved script, or 'code' to run inline VB.NET, not both."
      );
    }

    // Running a named script
    if (name) {
      await ctx.vmix.http.execute('ScriptStart', { Value: name });
      return successResult(`Script "${name}" started`);
    }

    // Running inline code - validate first
    const validation = validateVmixScript(code!);

    // Block on errors (like loops without Sleep)
    if (!validation.valid && validation.errors.length > 0) {
      const errorMessages = validation.errors.map((e) => `- ${e}`).join('\n');
      return errorResult(
        `Script validation failed - not executed:\n\n${errorMessages}\n\nFix these issues and try again.`
      );
    }

    // Execute the code (warnings don't block execution)
    await ctx.vmix.http.execute('ScriptStartDynamic', { Value: code });

    // Include warnings in success message
    if (validation.warnings.length > 0) {
      const warnings = validation.warnings.map((w) => `- ${w}`).join('\n');
      return successResult(`Script running.\n\nWarnings:\n${warnings}`);
    }

    return successResult('Script started and running');
  },
});

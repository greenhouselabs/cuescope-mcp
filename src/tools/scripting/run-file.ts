/**
 * vmix_script_run_file - Execute a VB.NET script from a file
 * Loads a script file and executes it dynamically via vMix API
 */

import { z } from 'zod';
import { createTool, successResult, errorResult, type ToolContext } from '../base.js';
import { validateVmixScript } from '../../validation/script-validator.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export const runScriptFileTool = createTool({
  name: 'vmix_script_run_file',
  description:
    'Execute a VB.NET script from a .txt file. ' +
    'Loads the script from the specified path (or from Documents/vmix-scripts if just a name), ' +
    'validates it, and runs it dynamically in vMix. ' +
    'Use vmix_script_save to create script files, or provide a full path to any .txt file.',
  schema: z.object({
    file: z
      .string()
      .describe(
        'Script file path or name. If just a name (e.g., "camera-cycle"), ' +
          'looks in Documents/vmix-scripts/camera-cycle.txt. ' +
          'Or provide a full path like "C:\\Scripts\\myscript.txt".'
      ),
  }),
  handler: async ({ file }: { file: string }, ctx: ToolContext) => {
    let filePath = file;

    // If it's just a name (no path separators), look in the default scripts folder
    if (!file.includes('/') && !file.includes('\\')) {
      const homeDir = process.env.USERPROFILE ?? process.env.HOME ?? '.';
      const scriptsDir = path.join(homeDir, 'Documents', 'vmix-scripts');

      // Add .txt extension if not present
      const fileName = file.endsWith('.txt') ? file : `${file}.txt`;
      filePath = path.join(scriptsDir, fileName);
    }

    // Read the file
    let code: string;
    try {
      code = await fs.readFile(filePath, 'utf-8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        return errorResult(
          `Script file not found: ${filePath}\n\n` +
            'Use vmix_script_save to create scripts, or provide a valid file path.'
        );
      }
      return errorResult(`Failed to read script file: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    // Strip header comments (lines starting with ')
    const codeLines = code.split('\n');
    const scriptLines: string[] = [];
    let inHeader = true;

    for (const line of codeLines) {
      const trimmed = line.trim();
      if (inHeader && (trimmed.startsWith("'") || trimmed === '')) {
        // Skip header comments
        continue;
      }
      inHeader = false;
      scriptLines.push(line);
    }

    const cleanCode = scriptLines.join('\n').trim();

    if (!cleanCode) {
      return errorResult('Script file is empty or contains only comments.');
    }

    // Validate the script
    const validation = validateVmixScript(cleanCode);
    if (!validation.valid && validation.errors.length > 0) {
      const errorMessages = validation.errors.map((e) => `• ${e}`).join('\n');
      return errorResult(
        `Script validation failed - not executed:\n\n${errorMessages}\n\nFix the script file and try again.`
      );
    }

    // Execute the script
    try {
      await ctx.vmix.http.execute('ScriptStartDynamic', { Value: cleanCode });
    } catch (e) {
      return errorResult(`Failed to execute script: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    // Build success message
    const fileName = path.basename(filePath);
    let message = `Script "${fileName}" loaded and running.`;

    if (validation.warnings.length > 0) {
      message += `\n\nWarnings:\n${validation.warnings.map((w) => `⚠ ${w}`).join('\n')}`;
    }

    return successResult(message);
  },
});

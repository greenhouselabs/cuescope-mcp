/**
 * vmix_snapshot - Capture a snapshot image
 * Captures program output or a specific input
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';

export const snapshotTool = createTool({
  name: 'vmix_snapshot',
  description:
    'Capture a still image snapshot. By default captures the program output. ' +
    'Optionally specify an input to capture that specific source instead. ' +
    'Images are saved as PNG files to the vMix recordings folder.',
  schema: z.object({
    input: InputReferenceSchema.optional().describe(
      'Specific input to capture. Omit to capture the program output (what viewers see).'
    ),
    filename: z
      .string()
      .optional()
      .describe(
        'Custom filename without extension (e.g., "hero-shot"). If omitted, vMix auto-generates a timestamped name.'
      ),
  }),
  handler: async (
    { input, filename }: { input?: string | number; filename?: string },
    ctx: ToolContext
  ) => {
    if (input !== undefined) {
      // Capture specific input
      const params: Record<string, string | number | undefined> = {
        Input: ctx.vmix.normalizeInput(input),
      };
      if (filename) {
        params.Value = filename;
      }
      await ctx.vmix.http.execute('SnapshotInput', params);

      const fileInfo = filename ? ` as "${filename}.png"` : '';
      return successResult(`Snapshot captured from "${input}"${fileInfo}`);
    } else {
      // Capture program output
      const params: Record<string, string | number | undefined> = {};
      if (filename) {
        params.Value = filename;
      }
      await ctx.vmix.http.execute('Snapshot', params);

      const fileInfo = filename ? ` as "${filename}.png"` : '';
      return successResult(`Snapshot captured from program output${fileInfo}`);
    }
  },
});

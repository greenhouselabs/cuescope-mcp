/**
 * Preset controls - save and load vMix presets
 */

import { z } from 'zod';
import { createTool, successResult, errorResult, type ToolContext } from '../base.js';

function isVmixPresetPath(path: string): boolean {
  return path.trim().toLowerCase().endsWith('.vmix');
}

/**
 * vmix_preset_open - Open/load a preset file
 */
export const presetOpenTool = createTool({
  name: 'vmix_preset_open',
  description:
    'Open a vMix preset file (.vmix). This loads all inputs, overlays, and settings from the preset.',
  schema: z.object({
    path: z
      .string()
      .describe('Full path to the .vmix preset file'),
  }),
  handler: async ({ path }: { path: string }, ctx: ToolContext) => {
    if (!isVmixPresetPath(path)) {
      return errorResult(
        `"${path}" is not a .vmix preset file. OpenPreset only accepts vMix preset files (e.g., "C:\\Presets\\show.vmix").`
      );
    }

    await ctx.vmix.http.execute('OpenPreset', { Value: path });
    return successResult(`Opened preset: ${path}`);
  },
});

/**
 * vmix_preset_save - Save current configuration as preset
 */
export const presetSaveTool = createTool({
  name: 'vmix_preset_save',
  description:
    'Save the current vMix configuration as a preset file (.vmix). ' +
    'Includes all inputs, overlays, and settings.',
  schema: z.object({
    path: z
      .string()
      .describe('Full path for the .vmix preset file to create'),
  }),
  handler: async ({ path }: { path: string }, ctx: ToolContext) => {
    if (!isVmixPresetPath(path)) {
      return errorResult(
        `"${path}" is not a .vmix preset file. Save presets with a .vmix extension (e.g., "C:\\Presets\\show.vmix").`
      );
    }

    await ctx.vmix.http.execute('SavePreset', { Value: path });
    return successResult(
      `Saved preset to: ${path}\n\n` +
        'Warning: if a file already existed at this path, vMix overwrote it without confirmation.'
    );
  },
});

/**
 * vmix_preset_last - Load the last used preset
 */
export const presetLastTool = createTool({
  name: 'vmix_preset_last',
  description: 'Load the most recently used preset file.',
  schema: z.object({}),
  handler: async (_params: Record<string, never>, ctx: ToolContext) => {
    await ctx.vmix.http.execute('LastPreset');
    return successResult('Loaded last preset');
  },
});

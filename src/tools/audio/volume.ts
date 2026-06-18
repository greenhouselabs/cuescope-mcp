/**
 * vmix_audio_volume - Set audio volume
 * Supports master, buses (A-G), and inputs
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';

const BUS_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

/**
 * Audio target schema - master, bus letter, or input reference
 */
const AudioTargetSchema = z.union([
  z.literal('master'),
  z.enum(BUS_LETTERS),
  z.string(),
  z.number(),
]);

export const volumeTool = createTool({
  name: 'vmix_audio_volume',
  description:
    'Set audio volume for master output, a bus (A-G), or any input. ' +
    'Volume range is 0-100 where 100 = unity gain (0dB). ' +
    'Optionally specify a fade duration for smooth volume transitions (inputs only - ' +
    'vMix has no fade function for master or bus volume).',
  schema: z.object({
    target: AudioTargetSchema.describe(
      "What to adjust: 'master' for main output, 'A'-'G' for aux buses, or an input name/number"
    ),
    volume: z
      .number()
      .min(0)
      .max(100)
      .describe(
        'Volume level from 0 (silent) to 100 (unity/0dB). ' +
          'vMix SetVolume accepts 0-100; amplification beyond unity is a separate gain setting in vMix.'
      ),
    fade_ms: z
      .number()
      .min(0)
      .max(60000)
      .optional()
      .describe(
        'Fade time in milliseconds for smooth transitions (e.g., 1000 for 1 second fade). ' +
          'Only supported for input targets - master and bus volume changes are applied immediately.'
      ),
  }),
  handler: async (
    { target, volume, fade_ms }: { target: string | number; volume: number; fade_ms?: number },
    ctx: ToolContext
  ) => {
    let func: string;
    let fadeApplied = false;
    const params: Record<string, string | number | undefined> = { Value: volume };

    if (target === 'master') {
      // Master volume - vMix has no SetMasterVolumeFade function
      func = 'SetMasterVolume';
    } else if (BUS_LETTERS.includes(target as (typeof BUS_LETTERS)[number])) {
      // Bus volume (A-G) - vMix has no SetBus{X}VolumeFade function
      func = `SetBus${target}Volume`;
    } else {
      // Input volume - SetVolumeFade supports "volume,milliseconds"
      func = fade_ms ? 'SetVolumeFade' : 'SetVolume';
      if (fade_ms) {
        params.Value = `${volume},${fade_ms}`;
        fadeApplied = true;
      }
      params.Input = ctx.vmix.normalizeInput(target);
    }

    await ctx.vmix.http.execute(func, params);

    const targetLabel = target === 'master' ? 'Master' : `"${target}"`;
    const fadeText = fadeApplied ? ` with ${fade_ms}ms fade` : '';
    const fadeNote =
      fade_ms && !fadeApplied
        ? '. Note: vMix does not support fading master/bus volume via the API - the change was applied immediately. Fades are available for individual inputs (use an input target with fade_ms).'
        : '';
    return successResult(`${targetLabel} volume set to ${volume}%${fadeText}${fadeNote}`);
  },
});

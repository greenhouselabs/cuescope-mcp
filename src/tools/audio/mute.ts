/**
 * vmix_audio_mute - Mute/unmute audio
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

export const muteTool = createTool({
  name: 'vmix_audio_mute',
  description:
    'Mute or unmute audio for master output, a bus, or any input. ' +
    "Use 'on' to mute (silence), 'off' to unmute (restore audio), or 'toggle' to switch states. " +
    'Useful for quickly silencing inputs or managing audio during transitions.',
  schema: z.object({
    target: AudioTargetSchema.describe(
      "What to mute: 'master' for main output, 'A'-'G' for aux buses, or an input name/number"
    ),
    state: z
      .enum(['on', 'off', 'toggle'])
      .default('toggle')
      .describe("'on' = mute (silence), 'off' = unmute (restore), 'toggle' = switch state"),
  }),
  handler: async (
    { target, state }: { target: string | number; state: 'on' | 'off' | 'toggle' },
    ctx: ToolContext
  ) => {
    let func: string;
    const params: Record<string, string | number | undefined> = {};

    if (target === 'master') {
      // Master mute
      // Note: vMix uses AudioOn/AudioOff inversely - "on" means audio is on (not muted)
      // So to mute (state: 'on'), we call MasterAudioOff
      func =
        state === 'toggle' ? 'MasterAudio' : state === 'on' ? 'MasterAudioOff' : 'MasterAudioOn';
    } else if (BUS_LETTERS.includes(target as (typeof BUS_LETTERS)[number])) {
      // Bus mute (A-G)
      func =
        state === 'toggle'
          ? `Bus${target}Audio`
          : state === 'on'
            ? `Bus${target}AudioOff`
            : `Bus${target}AudioOn`;
    } else {
      // Input mute
      func = state === 'toggle' ? 'Audio' : state === 'on' ? 'AudioOff' : 'AudioOn';
      params.Input = ctx.vmix.normalizeInput(target);
    }

    await ctx.vmix.http.execute(func, params);

    const targetLabel = target === 'master' ? 'Master' : `"${target}"`;
    const stateLabel =
      state === 'on' ? 'muted' : state === 'off' ? 'unmuted' : 'mute toggled';
    return successResult(`${targetLabel} audio ${stateLabel}`);
  },
});

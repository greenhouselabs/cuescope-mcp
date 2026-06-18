/**
 * Video Call routing controls - audio and video source configuration
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';
import { normalizeInput } from '../../utils/input-normalizer.js';

const AudioSourceSchema = z.enum([
  'Master',
  'Headphones',
  'BusA',
  'BusB',
  'BusC',
  'BusD',
  'BusE',
  'BusF',
  'BusG',
]);

const VideoSourceSchema = z.enum(['Output1', 'Output2', 'Output3', 'Output4']);

/**
 * vmix_call_audio_source - Set audio routing for a vMix Call
 */
export const callAudioSourceTool = createTool({
  name: 'vmix_call_audio_source',
  description:
    'Set which audio bus/output is sent to vMix Call participants. ' +
    'This controls what audio the remote caller hears.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'vMix Call input: number (1, 2), name ("Guest 1"), or GUID'
    ),
    source: AudioSourceSchema.describe(
      'Audio source to send: Master, Headphones, or BusA-G'
    ),
  }),
  handler: async (
    { input, source }: { input: string | number; source: z.infer<typeof AudioSourceSchema> },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('VideoCallAudioSource', {
      Input: inputRef,
      Value: source,
    });

    return successResult(`Set Call ${inputRef} audio source to ${source}`);
  },
});

/**
 * vmix_call_video_source - Set video source for a vMix Call
 */
export const callVideoSourceTool = createTool({
  name: 'vmix_call_video_source',
  description:
    'Set which video output is sent to vMix Call participants. ' +
    'This controls what video the remote caller sees.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'vMix Call input: number (1, 2), name ("Guest 1"), or GUID'
    ),
    source: VideoSourceSchema.describe('Video output to send: Output1, Output2, Output3, or Output4'),
  }),
  handler: async (
    { input, source }: { input: string | number; source: z.infer<typeof VideoSourceSchema> },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('VideoCallVideoSource', {
      Input: inputRef,
      Value: source,
    });

    return successResult(`Set Call ${inputRef} video source to ${source}`);
  },
});

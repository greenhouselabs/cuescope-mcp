/**
 * NDI controls - Network Device Interface source selection and recording
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';
import { normalizeInput } from '../../utils/input-normalizer.js';

/**
 * vmix_ndi_select_source - Select NDI source by name
 */
export const ndiSelectSourceTool = createTool({
  name: 'vmix_ndi_select_source',
  description:
    'Select an NDI source by name for an NDI input. ' +
    'The source name format is typically "HOSTNAME (Source Name)".',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'NDI input: number (1, 2), name ("NDI Camera"), or GUID'
    ),
    source: z
      .string()
      .describe('NDI source name, e.g., "COMPUTER (OBS)" or "NDI-CAM1 (Camera 1)"'),
  }),
  handler: async (
    { input, source }: { input: string | number; source: string },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('NDISelectSourceByName', {
      Input: inputRef,
      Value: source,
    });

    return successResult(`Selected NDI source "${source}" on ${inputRef}`);
  },
});

/**
 * vmix_ndi_select_index - Select NDI source by index
 */
export const ndiSelectIndexTool = createTool({
  name: 'vmix_ndi_select_index',
  description:
    'Select an NDI source by index for an NDI input. ' +
    'Index starts at 0. Use when you know the position but not the exact name.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'NDI input: number (1, 2), name ("NDI Camera"), or GUID'
    ),
    index: z
      .number()
      .int()
      .min(0)
      .describe('NDI source index (0-based)'),
  }),
  handler: async (
    { input, index }: { input: string | number; index: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('NDISelectSourceByIndex', {
      Input: inputRef,
      Value: index.toString(),
    });

    return successResult(`Selected NDI source index ${index} on ${inputRef}`);
  },
});

/**
 * vmix_ndi_command - Send NDI command to source
 */
export const ndiCommandTool = createTool({
  name: 'vmix_ndi_command',
  description:
    'Send an NDI command to a source. Commands depend on the NDI source capabilities. ' +
    'Common commands include PTZ controls for NDI cameras.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'NDI input: number (1, 2), name ("NDI Camera"), or GUID'
    ),
    command: z
      .string()
      .describe('NDI command string to send'),
  }),
  handler: async (
    { input, command }: { input: string | number; command: string },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('NDICommand', {
      Input: inputRef,
      Value: command,
    });

    return successResult(`Sent NDI command to ${inputRef}`);
  },
});

/**
 * vmix_ndi_recording - Control NDI recording
 */
export const ndiRecordingTool = createTool({
  name: 'vmix_ndi_recording',
  description:
    'Start or stop recording of an NDI source. Records the NDI stream directly.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'NDI input: number (1, 2), name ("NDI Camera"), or GUID'
    ),
    action: z
      .enum(['start', 'stop'])
      .describe('Recording action: start or stop'),
  }),
  handler: async (
    { input, action }: { input: string | number; action: 'start' | 'stop' },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    const func = action === 'start' ? 'NDIStartRecording' : 'NDIStopRecording';
    await ctx.vmix.http.execute(func, { Input: inputRef });

    return successResult(`${action === 'start' ? 'Started' : 'Stopped'} NDI recording on ${inputRef}`);
  },
});

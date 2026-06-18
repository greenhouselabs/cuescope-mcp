/**
 * vmix_audio_bus - Route input audio to a bus
 * Assigns or removes inputs from audio buses (M=master, A-G)
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';

const BUS_LETTERS = ['M', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

export const busTool = createTool({
  name: 'vmix_audio_bus',
  description:
    'Route an input\'s audio to a specific bus. ' +
    'M = Master (main output), A-G = auxiliary buses for separate mixes (monitors, recording, streaming). ' +
    'Each input can be assigned to multiple buses simultaneously.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'The input to route - can be a number (1, 2, 3), name ("Camera 1"), or GUID'
    ),
    bus: z.enum(BUS_LETTERS).describe(
      'Target bus: M = Master output, A-G = auxiliary buses for separate mixes'
    ),
    enabled: z.boolean().describe(
      'true = send audio to this bus, false = remove from this bus'
    ),
  }),
  handler: async (
    {
      input,
      bus,
      enabled,
    }: { input: string | number; bus: (typeof BUS_LETTERS)[number]; enabled: boolean },
    ctx: ToolContext
  ) => {
    // vMix API: AudioBusOn/AudioBusOff with Value = bus letter (M, A-G).
    // (There are no per-bus AudioBus<letter>On functions.)
    const func = enabled ? 'AudioBusOn' : 'AudioBusOff';
    await ctx.vmix.http.execute(func, {
      Input: ctx.vmix.normalizeInput(input),
      Value: bus,
    });

    const busLabel = bus === 'M' ? 'Master' : `Bus ${bus}`;
    const action = enabled ? 'routed to' : 'removed from';
    return successResult(`"${input}" audio ${action} ${busLabel}`);
  },
});

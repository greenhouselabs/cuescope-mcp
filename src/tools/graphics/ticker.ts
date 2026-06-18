/**
 * Ticker control - scrolling text speed
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';
import { normalizeInput } from '../../utils/input-normalizer.js';

/**
 * vmix_ticker_speed - Set ticker scroll speed
 */
export const tickerSpeedTool = createTool({
  name: 'vmix_ticker_speed',
  description:
    'Set the scroll speed of a ticker (scrolling text) in a title. ' +
    'Speed ranges from 0 (stopped) to 1000 (very fast). ' +
    'Default speed is typically around 100.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Title input with ticker: number (1, 2), name ("News Ticker"), or GUID'
    ),
    field: z
      .string()
      .optional()
      .describe('Ticker field name if multiple tickers exist (e.g., "Ticker.Text")'),
    speed: z
      .number()
      .int()
      .min(0)
      .max(1000)
      .describe('Scroll speed (0 = stopped, 100 = default, 1000 = very fast)'),
  }),
  handler: async (
    { input, field, speed }: { input: string | number; field?: string; speed: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    const params: Record<string, string> = {
      Input: inputRef,
      Value: speed.toString(),
    };

    if (field) {
      params.SelectedName = field;
    }

    await ctx.vmix.http.execute('SetTickerSpeed', params);

    const fieldInfo = field ? ` for "${field}"` : '';
    return successResult(`Set ticker speed to ${speed}${fieldInfo} on ${inputRef}`);
  },
});

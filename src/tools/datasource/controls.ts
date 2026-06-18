/**
 * DataSource controls - navigate and control data-driven titles
 */

import { z } from 'zod';
import { createTool, successResult, errorResult, type ToolContext, type ToolResult } from '../base.js';

/**
 * Data source commands compose Value as "name|table[|row]". A "|" inside a
 * component would corrupt the composite value, so reject it up front.
 */
function validateNoSeparator(name: string, table: string): ToolResult | null {
  if (name.includes('|')) {
    return errorResult(
      `Data source name "${name}" contains "|", which is the vMix value separator and cannot be used. Rename the data source in vMix.`
    );
  }
  if (table.includes('|')) {
    return errorResult(
      `Table name "${table}" contains "|", which is the vMix value separator and cannot be used. Rename the table in vMix.`
    );
  }
  return null;
}

/**
 * vmix_data_next - Go to next row in data source
 */
export const dataNextTool = createTool({
  name: 'vmix_data_next',
  description: 'Move to the next row in a data source table.',
  schema: z.object({
    name: z
      .string()
      .describe('Data source name'),
    table: z
      .string()
      .describe('Table name within the data source'),
  }),
  handler: async (
    { name, table }: { name: string; table: string },
    ctx: ToolContext
  ) => {
    const invalid = validateNoSeparator(name, table);
    if (invalid) return invalid;

    await ctx.vmix.http.execute('DataSourceNextRow', {
      Value: `${name}|${table}`,
    });
    return successResult(`Advanced to next row in ${name}/${table}`);
  },
});

/**
 * vmix_data_previous - Go to previous row in data source
 */
export const dataPreviousTool = createTool({
  name: 'vmix_data_previous',
  description: 'Move to the previous row in a data source table.',
  schema: z.object({
    name: z
      .string()
      .describe('Data source name'),
    table: z
      .string()
      .describe('Table name within the data source'),
  }),
  handler: async (
    { name, table }: { name: string; table: string },
    ctx: ToolContext
  ) => {
    const invalid = validateNoSeparator(name, table);
    if (invalid) return invalid;

    await ctx.vmix.http.execute('DataSourcePreviousRow', {
      Value: `${name}|${table}`,
    });
    return successResult(`Went to previous row in ${name}/${table}`);
  },
});

/**
 * vmix_data_select - Select specific row by index
 */
export const dataSelectTool = createTool({
  name: 'vmix_data_select',
  description: 'Select a specific row in a data source table by index.',
  schema: z.object({
    name: z
      .string()
      .describe('Data source name'),
    table: z
      .string()
      .describe('Table name within the data source'),
    row: z
      .number()
      .int()
      .min(0)
      .describe('Row index (0-based)'),
  }),
  handler: async (
    { name, table, row }: { name: string; table: string; row: number },
    ctx: ToolContext
  ) => {
    const invalid = validateNoSeparator(name, table);
    if (invalid) return invalid;

    await ctx.vmix.http.execute('DataSourceSelectRow', {
      Value: `${name}|${table}|${row}`,
    });
    return successResult(`Selected row ${row} in ${name}/${table}`);
  },
});

/**
 * vmix_data_auto_next - Enable/disable auto-advance
 */
export const dataAutoNextTool = createTool({
  name: 'vmix_data_auto_next',
  description:
    'Enable or disable automatic row advancement for a data source. ' +
    'When enabled, rows advance automatically based on timing settings.',
  schema: z.object({
    name: z
      .string()
      .describe('Data source name'),
    table: z
      .string()
      .describe('Table name within the data source'),
    enabled: z.boolean().describe('true to enable auto-next, false to disable'),
  }),
  handler: async (
    { name, table, enabled }: { name: string; table: string; enabled: boolean },
    ctx: ToolContext
  ) => {
    const invalid = validateNoSeparator(name, table);
    if (invalid) return invalid;

    const func = enabled ? 'DataSourceAutoNextOn' : 'DataSourceAutoNextOff';
    await ctx.vmix.http.execute(func, {
      Value: `${name}|${table}`,
    });
    return successResult(`${enabled ? 'Enabled' : 'Disabled'} auto-next for ${name}/${table}`);
  },
});

/**
 * vmix_data_play_pause - Play/pause data source auto-advance
 */
export const dataPlayPauseTool = createTool({
  name: 'vmix_data_play_pause',
  description: 'Play or pause data source auto-advance timing.',
  schema: z.object({
    name: z
      .string()
      .describe('Data source name'),
    table: z
      .string()
      .describe('Table name within the data source'),
    action: z.enum(['play', 'pause']).describe('Action to take'),
  }),
  handler: async (
    { name, table, action }: { name: string; table: string; action: 'play' | 'pause' },
    ctx: ToolContext
  ) => {
    const invalid = validateNoSeparator(name, table);
    if (invalid) return invalid;

    // Official vMix functions are DataSourcePlay / DataSourcePause
    // (DataSourceAutoNextPlay/Pause do not exist).
    const func = action === 'play' ? 'DataSourcePlay' : 'DataSourcePause';
    await ctx.vmix.http.execute(func, {
      Value: `${name}|${table}`,
    });
    return successResult(`${action === 'play' ? 'Playing' : 'Paused'} auto-advance for ${name}/${table}`);
  },
});

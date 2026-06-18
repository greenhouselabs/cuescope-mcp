/**
 * Playlist/List controls - manage video lists and photo slideshows
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';
import { normalizeInput } from '../../utils/input-normalizer.js';

/**
 * vmix_list_add - Add item to a list input
 */
export const listAddTool = createTool({
  name: 'vmix_list_add',
  description:
    'Add a file to a VideoList or Photos input. The file will be added to the end of the list.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'List input: number (1, 2), name ("Video Playlist"), or GUID'
    ),
    path: z
      .string()
      .describe('Full path to the file to add (e.g., "C:\\\\Videos\\\\clip.mp4")'),
  }),
  handler: async (
    { input, path }: { input: string | number; path: string },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('ListAdd', {
      Input: inputRef,
      Value: path,
    });

    return successResult(`Added "${path}" to ${inputRef}`);
  },
});

/**
 * vmix_list_remove - Remove item from a list input
 */
export const listRemoveTool = createTool({
  name: 'vmix_list_remove',
  description:
    'Remove an item from a VideoList or Photos input by index.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'List input: number (1, 2), name ("Video Playlist"), or GUID'
    ),
    index: z
      .number()
      .int()
      .min(0)
      .describe('Index of item to remove (0-based)'),
  }),
  handler: async (
    { input, index }: { input: string | number; index: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('ListRemove', {
      Input: inputRef,
      Value: index.toString(),
    });

    return successResult(`Removed item ${index} from ${inputRef}`);
  },
});

/**
 * vmix_list_clear - Remove all items from a list
 */
export const listClearTool = createTool({
  name: 'vmix_list_clear',
  description: 'Remove all items from a VideoList or Photos input.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'List input: number (1, 2), name ("Video Playlist"), or GUID'
    ),
  }),
  handler: async ({ input }: { input: string | number }, ctx: ToolContext) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('ListRemoveAll', { Input: inputRef });

    return successResult(`Cleared all items from ${inputRef}`);
  },
});

/**
 * vmix_list_shuffle - Randomize list order
 */
export const listShuffleTool = createTool({
  name: 'vmix_list_shuffle',
  description: 'Randomize the order of items in a VideoList or Photos input.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'List input: number (1, 2), name ("Video Playlist"), or GUID'
    ),
  }),
  handler: async ({ input }: { input: string | number }, ctx: ToolContext) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('ListShuffle', { Input: inputRef });

    return successResult(`Shuffled ${inputRef}`);
  },
});

/**
 * vmix_list_next - Go to next item in list
 */
export const listNextTool = createTool({
  name: 'vmix_list_next',
  description: 'Advance to the next item in a VideoList or Photos input.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'List input: number (1, 2), name ("Video Playlist"), or GUID'
    ),
  }),
  handler: async ({ input }: { input: string | number }, ctx: ToolContext) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('NextItem', { Input: inputRef });

    return successResult(`Advanced to next item in ${inputRef}`);
  },
});

/**
 * vmix_list_previous - Go to previous item in list
 */
export const listPreviousTool = createTool({
  name: 'vmix_list_previous',
  description: 'Go back to the previous item in a VideoList or Photos input.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'List input: number (1, 2), name ("Video Playlist"), or GUID'
    ),
  }),
  handler: async ({ input }: { input: string | number }, ctx: ToolContext) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('PreviousItem', { Input: inputRef });

    return successResult(`Went to previous item in ${inputRef}`);
  },
});

/**
 * vmix_list_select - Select specific item by index
 */
export const listSelectTool = createTool({
  name: 'vmix_list_select',
  description: 'Select a specific item in a VideoList or Photos input by index.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'List input: number (1, 2), name ("Video Playlist"), or GUID'
    ),
    index: z
      .number()
      .int()
      .min(0)
      .describe('Index of item to select (0-based)'),
  }),
  handler: async (
    { input, index }: { input: string | number; index: number },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('SelectIndex', {
      Input: inputRef,
      Value: index.toString(),
    });

    return successResult(`Selected item ${index} in ${inputRef}`);
  },
});

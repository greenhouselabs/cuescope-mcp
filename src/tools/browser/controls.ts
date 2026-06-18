/**
 * Browser input controls - navigation and interaction
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';
import { normalizeInput } from '../../utils/input-normalizer.js';

const HttpUrlSchema = z
  .string()
  .url('Invalid URL format')
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'URL must use http:// or https://');

/**
 * vmix_browser_navigate - Navigate to a URL
 */
export const browserNavigateTool = createTool({
  name: 'vmix_browser_navigate',
  description: 'Navigate a browser input to a new URL.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Browser input: number (1, 2), name ("Web View"), or GUID'
    ),
    url: HttpUrlSchema.describe('URL to navigate to (must include http:// or https://)'),
  }),
  handler: async (
    { input, url }: { input: string | number; url: string },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('BrowserNavigate', {
      Input: inputRef,
      Value: url,
    });

    return successResult(`Navigated ${inputRef} to ${url}`);
  },
});

/**
 * vmix_browser_reload - Reload the current page
 */
export const browserReloadTool = createTool({
  name: 'vmix_browser_reload',
  description: 'Reload/refresh the current page in a browser input.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Browser input: number (1, 2), name ("Web View"), or GUID'
    ),
  }),
  handler: async ({ input }: { input: string | number }, ctx: ToolContext) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('BrowserReload', { Input: inputRef });

    return successResult(`Reloaded ${inputRef}`);
  },
});

/**
 * vmix_browser_back - Navigate back
 */
export const browserBackTool = createTool({
  name: 'vmix_browser_back',
  description: 'Go back to the previous page in browser history.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Browser input: number (1, 2), name ("Web View"), or GUID'
    ),
  }),
  handler: async ({ input }: { input: string | number }, ctx: ToolContext) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('BrowserBack', { Input: inputRef });

    return successResult(`Navigated ${inputRef} back`);
  },
});

/**
 * vmix_browser_forward - Navigate forward
 */
export const browserForwardTool = createTool({
  name: 'vmix_browser_forward',
  description: 'Go forward in browser history.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Browser input: number (1, 2), name ("Web View"), or GUID'
    ),
  }),
  handler: async ({ input }: { input: string | number }, ctx: ToolContext) => {
    const inputRef = normalizeInput(input);
    await ctx.vmix.http.execute('BrowserForward', { Input: inputRef });

    return successResult(`Navigated ${inputRef} forward`);
  },
});

/**
 * vmix_browser_keyboard - Enable/disable keyboard input
 */
export const browserKeyboardTool = createTool({
  name: 'vmix_browser_keyboard',
  description:
    'Enable or disable keyboard input for a browser. When enabled, keyboard events are sent to the browser.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Browser input: number (1, 2), name ("Web View"), or GUID'
    ),
    enabled: z.boolean().describe('true to enable keyboard input, false to disable'),
  }),
  handler: async (
    { input, enabled }: { input: string | number; enabled: boolean },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    const func = enabled ? 'BrowserKeyboardEnabled' : 'BrowserKeyboardDisabled';
    await ctx.vmix.http.execute(func, { Input: inputRef });

    return successResult(`${enabled ? 'Enabled' : 'Disabled'} keyboard for ${inputRef}`);
  },
});

/**
 * vmix_browser_mouse - Enable/disable mouse input
 */
export const browserMouseTool = createTool({
  name: 'vmix_browser_mouse',
  description:
    'Enable or disable mouse input for a browser. When enabled, mouse events are sent to the browser.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'Browser input: number (1, 2), name ("Web View"), or GUID'
    ),
    enabled: z.boolean().describe('true to enable mouse input, false to disable'),
  }),
  handler: async (
    { input, enabled }: { input: string | number; enabled: boolean },
    ctx: ToolContext
  ) => {
    const inputRef = normalizeInput(input);
    const func = enabled ? 'BrowserMouseEnabled' : 'BrowserMouseDisabled';
    await ctx.vmix.http.execute(func, { Input: inputRef });

    return successResult(`${enabled ? 'Enabled' : 'Disabled'} mouse for ${inputRef}`);
  },
});

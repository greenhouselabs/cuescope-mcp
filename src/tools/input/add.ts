/**
 * vmix_input_add - Add a new input to vMix
 * Supports various input types: Video, Image, Title, NDI, Browser, Call, Stream, etc.
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';

const INPUT_TYPES = [
  'Video',
  'Image',
  'Photos',
  'Title',
  'GT',
  'Colour',
  'NDI',
  'Browser',
  'AudioFile',
  'Call',
  'VideoList',
  'Stream',
  'PowerPoint',
  'VirtualSet',
  'Xaml',
] as const;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const addInputTool = createTool({
  name: 'vmix_input_add',
  description:
    'Add a new input to vMix from various sources. ' +
    'Supports video files, images, photo slideshows, titles, GT graphics, solid colors, NDI streams, ' +
    'web pages, audio files, RTMP/SRT streams, PowerPoint, virtual sets, and XAML templates. ' +
    'Note: vMix Call has LIMITED API support and often requires manual setup in vMix UI. ' +
    'The new input will be added to the end of the input list.',
  schema: z.object({
    type: z.enum(INPUT_TYPES).describe(
      'Type of input: Video (video files), Image (single image), Photos (slideshow folder), ' +
        'Title (title template), GT (GT Designer graphic), Colour (solid color), ' +
        'NDI (network video), Browser (web page), AudioFile (audio only), ' +
        'Call (vMix Call - LIMITED API SUPPORT, may require manual setup), VideoList (m3u playlist), ' +
        'Stream (RTMP/SRT input), PowerPoint (pptx file), VirtualSet (set template), Xaml (custom template)'
    ),
    path: z
      .string()
      .optional()
      .describe(
        'Source path or identifier (optional for Call type). Examples: ' +
          '"C:\\Videos\\intro.mp4" for video, ' +
          '"C:\\Images\\logo.png" for image, ' +
          '"HOSTNAME (Source Name)" for NDI, ' +
          '"https://example.com" for browser, ' +
          '"#FF0000" for colour, ' +
          '"rtmp://server/stream" for Stream, ' +
          '"C:\\Playlists\\show.m3u" for VideoList, ' +
          'Leave empty for Call (auto-generates link)'
      ),
    return_join_url: z
      .boolean()
      .default(false)
      .describe(
        'For Call inputs only: return the generated vMix Call join URL in the response. ' +
          'Default false to avoid echoing guest access links into chat transcripts.'
      ),
  }),
  handler: async (
    {
      type,
      path,
      return_join_url = false,
    }: {
      type: (typeof INPUT_TYPES)[number];
      path?: string;
      return_join_url?: boolean;
    },
    ctx: ToolContext
  ) => {
    // vMix Call doesn't need a path - vMix generates the join link
    if (type === 'Call') {
      // Try different API formats - vMix versions vary in what they accept
      const callFormats = ['Call', 'VideoCall', 'VmixCall'];
      let success = false;
      let lastError: Error | null = null;

      for (const format of callFormats) {
        try {
          await ctx.vmix.http.execute('AddInput', { Value: format });
          success = true;
          break;
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e));
          // Continue to try next format
        }
      }

      if (!success) {
        return {
          content: [
            {
              type: 'text' as const,
              text:
                `Failed to add vMix Call input.\n\n` +
                `Error: ${lastError?.message ?? 'Unknown error'}\n\n` +
                `Troubleshooting:\n` +
                `1. vMix Call requires vMix version 23 or later\n` +
                `2. Ensure vMix is registered (not in trial mode for Call features)\n` +
                `3. Check that your firewall allows vMix Call connections\n` +
                `4. Try adding the Call manually: Add Input → vMix Call\n\n` +
                `If this persists, vMix Call inputs must be added manually through the vMix interface.`,
            },
          ],
          isError: true,
        };
      }

      if (return_join_url) {
        const state = await ctx.vmix.http.getState();
        const callMatch = state.match(/<input[^>]*type="VmixCall"[^>]*>[\s\S]*?<\/input>/gi);
        const lastCall = callMatch?.[callMatch.length - 1];
        if (lastCall) {
          const keyMatch = lastCall.match(/key="([^"]+)"/i);
          const passwordMatch = lastCall.match(/<CallPassword>([^<]*)<\/CallPassword>/i);

          if (keyMatch) {
            const key = keyMatch[1];
            const password = passwordMatch ? passwordMatch[1] : '';
            const callUrl = `https://vmixcall.com/?Key=${key}${password ? `&Password=${password}` : ''}`;
            return successResult(
              `Added vMix Call input.\n\n` +
                `Join URL: ${callUrl}\n\n` +
                `Share this link only with the intended participant.`
            );
          }
        }
      }

      return successResult(
        'Added vMix Call input. Check vMix for the generated join link. ' +
          'Set return_join_url=true only when you intentionally want the link returned in this chat.'
      );
    }

    // All other types require a path
    if (!path) {
      return {
        content: [{ type: 'text' as const, text: `Path is required for ${type} input type.` }],
        isError: true,
      };
    }

    if (type === 'Browser' && !isHttpUrl(path)) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Browser inputs only accept http:// or https:// URLs through this tool.',
          },
        ],
        isError: true,
      };
    }

    // Invalidate cache first to ensure fresh "before" state
    ctx.state.invalidate();
    const stateBefore = await ctx.state.getState();
    const countBefore = stateBefore.inputs.length;

    // Handle colour format - convert hex to signed Int32 ARGB
    let finalPath = path;
    if (type === 'Colour') {
      if (path.startsWith('#')) {
        const hex = path.slice(1);
        // Validate before parsing - otherwise an invalid hex becomes "Colour|NaN"
        if (!/^(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Invalid hex colour "${path}". Use #RRGGBB (e.g., "#FF0000") or #AARRGGBB (e.g., "#80FF0000").`,
              },
            ],
            isError: true,
          };
        }
        // #RRGGBB gets full opacity (FF); #AARRGGBB is used as-is
        const argb = hex.length === 6 ? parseInt('FF' + hex, 16) : parseInt(hex, 16);
        // Convert to signed Int32 (JavaScript handles this with bitwise OR)
        finalPath = String(argb | 0);
      } else if (!/^-?\d+$/.test(path)) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Invalid colour "${path}". Use a hex colour like "#FF0000" (#RRGGBB or #AARRGGBB) or a signed ARGB integer.`,
            },
          ],
          isError: true,
        };
      }
    }

    // vMix uses AddInput with Value=Type|Path format
    const value = `${type}|${finalPath}`;
    await ctx.vmix.http.execute('AddInput', { Value: value });

    // Longer delay to let vMix fully process
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Invalidate cache to force fresh state fetch
    ctx.state.invalidate();

    // Verify the input was actually added
    const stateAfter = await ctx.state.getState();
    const countAfter = stateAfter.inputs.length;

    if (countAfter <= countBefore) {
      // Input was NOT added - vMix silently failed
      const shortPath = path.length > 40 ? '...' + path.slice(-37) : path;

      // For NDI, create a placeholder instead
      if (type === 'NDI') {
        // Create a black colour input as placeholder
        const placeholderColour = String(0xFF000000 | 0); // Black with full opacity
        await ctx.vmix.http.execute('AddInput', { Value: `Colour|${placeholderColour}` });
        await new Promise((resolve) => setTimeout(resolve, 500));

        ctx.state.invalidate();
        const stateWithPlaceholder = await ctx.state.getState();
        const placeholderInput = stateWithPlaceholder.inputs[stateWithPlaceholder.inputs.length - 1];

        if (placeholderInput && stateWithPlaceholder.inputs.length > countBefore) {
          // Rename placeholder to indicate it needs NDI source
          const placeholderName = `[NDI] ${shortPath}`;
          await ctx.vmix.http.execute('SetInputName', {
            Input: placeholderInput.key,
            Value: placeholderName,
          });

          return {
            content: [{
              type: 'text' as const,
              text: `NDI source "${shortPath}" could not be added via API (vMix limitation).\n\n` +
                `Created placeholder: "${placeholderName}"\n\n` +
                `To complete setup:\n` +
                `1. Right-click the placeholder in vMix\n` +
                `2. Select "Change Input"\n` +
                `3. Choose NDI and select "${path}"\n\n` +
                `The placeholder preserves your show structure until you connect the real source.`,
            }],
            isError: false, // Not an error - we created a workaround
          };
        }

        // Placeholder also failed
        return {
          content: [{
            type: 'text' as const,
            text: `Failed to add NDI input: "${shortPath}"\n\n` +
              `NDI sources often cannot be added via API (vMix limitation).\n` +
              `Please add this source manually in vMix: Add Input → NDI → "${path}"`,
          }],
          isError: true,
        };
      }

      let hint = '';
      if (type === 'Video' || type === 'Image' || type === 'AudioFile') {
        hint = '\n\nFile Troubleshooting:\n' +
          '- Verify the file path exists and is accessible\n' +
          '- Use full absolute path (e.g., "C:\\\\Videos\\\\file.mp4")\n' +
          '- Check file format is supported by vMix';
      } else if (type === 'Browser') {
        hint = '\n\nBrowser Troubleshooting:\n' +
          '- URL must be valid and accessible\n' +
          '- Check for correct protocol (https:// or http://)';
      }

      // Debug info
      const debug = `\n\nDebug: before=${countBefore}, after=${countAfter}, sent="${value}"`;

      return {
        content: [{
          type: 'text' as const,
          text: `Failed to add ${type} input: "${shortPath}"\n\n` +
            `vMix accepted the command but did not create the input.${hint}${debug}`,
        }],
        isError: true,
      };
    }

    // Success - input was added
    const newInput = stateAfter.inputs[stateAfter.inputs.length - 1];
    const inputName = newInput?.title ?? path;
    const shortPath = path.length > 40 ? '...' + path.slice(-37) : path;
    return successResult(`Added ${type} input: "${inputName}" (from "${shortPath}")`);
  },
});

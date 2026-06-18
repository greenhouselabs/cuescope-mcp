/**
 * vmix_switch_preview - Send an input to preview
 */

import { z } from 'zod';
import { createTool, successResult } from '../base.js';
import { InputReferenceSchema, MixSchema } from '../../validation/index.js';
import { resolveInput, formatResolveError } from '../../utils/input-resolver.js';

export const previewTool = createTool({
  name: 'vmix_switch_preview',
  description:
    'Send an input to the preview window without putting it on program (live output). ' +
    'Use this to queue up your next shot before switching. ' +
    'The input will appear in preview but not be visible to viewers.',
  schema: z.object({
    input: InputReferenceSchema.describe(
      'The input to preview - can be a number (1, 2, 3), name ("Camera 1"), or GUID'
    ),
    mix: MixSchema.describe(
      'Mix bus number (0-3). Use 0 for main output. Optional - defaults to main mix.'
    ),
  }),
  handler: async ({ input, mix }, ctx) => {
    // Pre-validate input with smart matching (same pattern as cut/fade)
    const state = await ctx.state.getState();
    const resolved = resolveInput(state, input);

    if (!resolved.success) {
      return formatResolveError(resolved);
    }

    // Use the resolved input's KEY for API calls (immutable, case-insensitive)
    await ctx.vmix.http.execute('PreviewInput', {
      Input: resolved.key,
      Mix: mix,
    });

    const mixLabel = mix !== undefined && mix > 0 ? ` on Mix ${mix}` : '';
    const fuzzyNote = resolved.fuzzyMatch ? ' (matched case-insensitively)' : '';
    return successResult(`"${resolved.input!.title}" is now in preview${mixLabel}${fuzzyNote}`);
  },
});

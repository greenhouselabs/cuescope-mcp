/**
 * vmix_title_animation - Trigger animation in a title/GT input
 * Common animations: TransitionIn, TransitionOut, Page1, Page2, Loop
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { InputReferenceSchema } from '../../validation/schemas.js';

export const animationTool = createTool({
  name: 'vmix_title_animation',
  description:
    'Trigger an animation in a Title or GT (Graphics Template) input. ' +
    'GT titles can have multiple animation states like intro/outro effects and page transitions. ' +
    "Common animations: 'TransitionIn' (show), 'TransitionOut' (hide), 'Page1', 'Page2', 'Continuous', 'Loop'.",
  schema: z.object({
    input: InputReferenceSchema.describe(
      'The title/GT input to animate - can be a number (1, 2, 3), name ("Lower Third"), or GUID'
    ),
    animation: z.string().describe(
      "Animation name to trigger. Common values: 'TransitionIn' (intro/show effect), " +
        "'TransitionOut' (outro/hide effect), 'Page1', 'Page2', 'Continuous', 'Loop'. " +
        'Available animations depend on the title template.'
    ),
  }),
  handler: async (
    { input, animation }: { input: string | number; animation: string },
    ctx: ToolContext
  ) => {
    await ctx.vmix.http.execute('TitleBeginAnimation', {
      Input: ctx.vmix.normalizeInput(input),
      Value: animation,
    });

    return successResult(`"${animation}" animation triggered on "${input}"`);
  },
});

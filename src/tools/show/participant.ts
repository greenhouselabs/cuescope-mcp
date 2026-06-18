/**
 * vmix_participant_add - Add a participant (camera + mic + graphics as unit)
 */

import { z } from 'zod';
import { createTool, type ToolContext } from '../base.js';
import { delay } from '../../utils/delay.js';

const BUS_LETTERS = ['M', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
type BusLetter = (typeof BUS_LETTERS)[number];

/** Delay after AddInput so vMix can finish creating the input before we re-read state. */
const ADD_INPUT_DELAY_MS = 500;

/** Heuristic: a "separate" microphone source that looks like a media file path can be
 * added via AddInput AudioFile|<path>. Device names cannot be added via the API. */
function looksLikeFilePath(source: string): boolean {
  return /[\\/]/.test(source) || /\.[a-z0-9]{2,4}$/i.test(source);
}

export const participantAddTool = createTool({
  name: 'vmix_participant_add',
  description:
    'Add a complete participant to the show (camera, microphone, and lower third configuration as a single unit). ' +
    'This bundles what would normally be 3-4 separate operations into one atomic action.',
  schema: z.object({
    name: z.string().describe('Participant display name'),
    title: z.string().optional().describe('Role/title (e.g., "Host", "Guest", "Co-Host")'),
    camera: z.object({
      type: z.enum(['ndi', 'capture', 'existing']).describe('Camera source type'),
      source: z.string().describe(
        'Source identifier: NDI name (e.g., "OBS (Webcam)"), device name, or existing input name'
      ),
    }),
    microphone: z.object({
      type: z.enum(['embedded', 'separate', 'existing']).describe(
        'embedded = audio from camera, separate = different audio source'
      ),
      source: z.string().optional().describe('Audio source (required if type is "separate")'),
      bus: z
        .array(z.enum(BUS_LETTERS))
        .default(['M'])
        .describe('Audio buses as single letters: M = Master, A-G = auxiliary (e.g., ["M", "A"])'),
    }),
    lowerThirdInput: z.string().optional().describe(
      'Name of existing lower third input to configure (if any)'
    ),
    lowerThirdFields: z
      .object({
        nameField: z.string().optional().default('Name.Text'),
        titleField: z.string().optional().default('Title.Text'),
      })
      .optional()
      .describe('Lower third field names'),
  }),
  handler: async (
    {
      name,
      title,
      camera,
      microphone,
      lowerThirdInput,
      lowerThirdFields,
    }: {
      name: string;
      title?: string;
      camera: { type: 'ndi' | 'capture' | 'existing'; source: string };
      microphone: {
        type: 'embedded' | 'separate' | 'existing';
        source?: string;
        bus: BusLetter[];
      };
      lowerThirdInput?: string;
      lowerThirdFields?: { nameField?: string; titleField?: string };
    },
    ctx: ToolContext
  ) => {
    const results: string[] = [];
    const errors: string[] = [];

    // 1. Add camera input
    let cameraKey: string | undefined;
    if (camera.type === 'existing') {
      // Find existing input
      const state = await ctx.state.getState();
      const existing = state.inputs.find(
        (i) => i.title.toLowerCase() === camera.source.toLowerCase()
      );
      if (existing) {
        cameraKey = existing.key;
        results.push(`✓ Using existing camera: "${existing.title}"`);
      } else {
        errors.push(`✗ Camera input "${camera.source}" not found`);
      }
    } else if (camera.type === 'capture') {
      // vMix AddInput does not support adding capture devices ("Capture|..." is not
      // a supported template). Emit manual-setup instructions instead of a call
      // that is known to fail.
      results.push(
        `⚠ Manual setup required: capture devices cannot be added via the vMix API. ` +
          `In vMix use Add Input → Camera, select "${camera.source}", then rename the input to "${name} Camera".`
      );
    } else {
      // NDI - attempt AddInput, then verify against fresh state before renaming
      try {
        ctx.state.invalidate();
        const stateBefore = await ctx.state.getState();
        const countBefore = stateBefore.inputs.length;

        await ctx.vmix.http.execute('AddInput', { Value: `NDI|${camera.source}` });
        await delay(ADD_INPUT_DELAY_MS);

        ctx.state.invalidate();
        const stateAfter = await ctx.state.getState();
        const newInput = stateAfter.inputs[stateAfter.inputs.length - 1];

        if (stateAfter.inputs.length > countBefore && newInput) {
          cameraKey = newInput.key;
          await ctx.vmix.http.execute('SetInputName', {
            Input: newInput.key,
            Value: `${name} Camera`,
          });
          results.push(`✓ Added camera: "${name} Camera" (NDI: ${camera.source})`);
        } else {
          errors.push(
            `✗ NDI source "${camera.source}" could not be added via the API (vMix limitation). ` +
              `Add it manually: Add Input → NDI/Desktop Capture → "${camera.source}", then rename it to "${name} Camera".`
          );
        }
      } catch (e) {
        errors.push(`✗ Failed to add camera: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    // 2. Add separate microphone if needed
    let micKey: string | undefined;
    if (microphone.type === 'separate' && microphone.source) {
      if (!looksLikeFilePath(microphone.source)) {
        // Audio devices cannot be added via AddInput (AudioFile expects a file path).
        results.push(
          `⚠ Manual setup required: audio devices cannot be added via the vMix API. ` +
            `In vMix use Add Input → Audio Input, select "${microphone.source}", then rename the input to "${name} Mic".`
        );
      } else {
        try {
          ctx.state.invalidate();
          const stateBefore = await ctx.state.getState();
          const countBefore = stateBefore.inputs.length;

          await ctx.vmix.http.execute('AddInput', { Value: `AudioFile|${microphone.source}` });
          await delay(ADD_INPUT_DELAY_MS);

          ctx.state.invalidate();
          const stateAfter = await ctx.state.getState();
          const newInput = stateAfter.inputs[stateAfter.inputs.length - 1];

          if (stateAfter.inputs.length > countBefore && newInput) {
            micKey = newInput.key;
            await ctx.vmix.http.execute('SetInputName', {
              Input: newInput.key,
              Value: `${name} Mic`,
            });
            results.push(`✓ Added microphone: "${name} Mic"`);
          } else {
            errors.push(
              `✗ Audio source "${microphone.source}" could not be added via the API. ` +
                `Add it manually in vMix, then rename it to "${name} Mic".`
            );
          }
        } catch (e) {
          errors.push(`✗ Failed to add microphone: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      }
    } else if (microphone.type === 'embedded') {
      micKey = cameraKey; // Audio comes from camera
      if (cameraKey) {
        results.push(`✓ Using embedded audio from camera`);
      } else {
        errors.push(`✗ Embedded audio unavailable - the camera input was not resolved`);
      }
    } else if (microphone.type === 'existing' && microphone.source) {
      const state = await ctx.state.getState();
      const existing = state.inputs.find(
        (i) => i.title.toLowerCase() === microphone.source!.toLowerCase()
      );
      if (existing) {
        micKey = existing.key;
        results.push(`✓ Using existing mic: "${existing.title}"`);
      } else {
        errors.push(`✗ Mic input "${microphone.source}" not found`);
      }
    }

    // 3. Configure audio routing
    const audioKey = micKey ?? cameraKey;
    if (audioKey && microphone.bus.length > 0) {
      try {
        for (const bus of microphone.bus) {
          // vMix expects the bus as a single letter: M (master) or A-G.
          await ctx.vmix.http.execute('AudioBusOn', { Input: audioKey, Value: bus });
        }
        results.push(`✓ Routed audio to buses: ${microphone.bus.join(', ')}`);
      } catch (e) {
        errors.push(`✗ Failed to route audio: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    // 4. Configure lower third if specified
    if (lowerThirdInput) {
      try {
        const state = await ctx.state.getState();
        const ltInput = state.inputs.find(
          (i) => i.title.toLowerCase() === lowerThirdInput.toLowerCase()
        );

        if (ltInput) {
          const nameField = lowerThirdFields?.nameField ?? 'Name.Text';
          const titleField = lowerThirdFields?.titleField ?? 'Title.Text';

          await ctx.vmix.http.execute('SetText', {
            Input: ltInput.key,
            SelectedName: nameField,
            Value: name,
          });

          if (title) {
            await ctx.vmix.http.execute('SetText', {
              Input: ltInput.key,
              SelectedName: titleField,
              Value: title,
            });
          }

          results.push(`✓ Configured lower third "${lowerThirdInput}" for ${name}`);
        } else {
          errors.push(`✗ Lower third input "${lowerThirdInput}" not found`);
        }
      } catch (e) {
        errors.push(`✗ Failed to configure lower third: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    // Build response
    let text = `# Participant Added: ${name}\n\n`;

    if (title) {
      text += `**Title:** ${title}\n\n`;
    }

    text += '## Actions:\n';
    for (const r of results) {
      text += `${r}\n`;
    }

    if (errors.length > 0) {
      text += '\n## Errors:\n';
      for (const e of errors) {
        text += `${e}\n`;
      }
    }

    text += `\n**Summary:** ${results.length} successful, ${errors.length} failed`;

    return {
      content: [{ type: 'text' as const, text }],
      isError: errors.length > results.length,
    };
  },
});

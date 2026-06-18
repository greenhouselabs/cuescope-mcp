/**
 * vmix_show_build - Build a complete show from configuration
 */

import { z } from 'zod';
import { createTool, successResult, errorResult, type ToolContext } from '../base.js';
import { getTemplate, type ShowConfig, type ParticipantConfig } from './templates.js';

const ParticipantSchema = z.object({
  name: z.string().describe('Participant display name'),
  title: z.string().optional().describe('Role/title (e.g., "Host", "Guest")'),
  camera: z.object({
    type: z.enum(['ndi', 'capture', 'existing', 'webcam']).describe('Camera source type'),
    source: z.string().describe('Source identifier (NDI name, device name, or existing input name)'),
  }),
  microphone: z.object({
    type: z.enum(['embedded', 'separate', 'existing']).describe('Mic type'),
    source: z.string().optional().describe('Mic source (if separate)'),
    bus: z.array(z.string()).describe('Audio buses (e.g., ["M", "A"])'),
  }),
});

const ShowOptionsSchema = z.object({
  lowerThirdPath: z.string().optional().describe('Path to lower third template (.gtzip)'),
  logoBugPath: z.string().optional().describe('Path to logo image'),
  startingSoonPath: z.string().optional().describe('Path to starting soon image'),
  brbPath: z.string().optional().describe('Path to BRB image'),
  includeMusic: z.boolean().optional().describe('Add background music'),
  musicPath: z.string().optional().describe('Path to music file'),
  musicDuckLevel: z.number().min(0).max(100).optional().describe('Ducked volume level (0-100)'),
  includeIntro: z.boolean().optional().describe('Add intro video'),
  introPath: z.string().optional().describe('Path to intro video'),
  includeOutro: z.boolean().optional().describe('Add outro video'),
  outroPath: z.string().optional().describe('Path to outro video'),
  includeStinger: z.boolean().optional().describe('Add stinger transition'),
  stingerPath: z.string().optional().describe('Path to stinger video'),
});

// Helper to delay between operations
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Heuristic: a "separate" microphone source that looks like a media file path can be
 * added via AddInput AudioFile|<path>. Device names cannot be added via the API. */
const looksLikeFilePath = (source: string): boolean =>
  /[\\/]/.test(source) || /\.[a-z0-9]{2,4}$/i.test(source);

const AUTO = '[auto]';
const MANUAL = '[manual setup required]';

export const showBuildTool = createTool({
  name: 'vmix_show_build',
  description:
    'Build a show from a template configuration. By default this is a DRY RUN that previews the plan ' +
    'without changing vMix. Set dryRun: false to create the inputs. Steps the vMix API cannot perform ' +
    '(capture devices, audio routing, multi-views, overlay assignments) are listed as manual setup.',
  schema: z.object({
    template: z.string().describe('Template ID (e.g., "four-person-podcast")'),
    name: z.string().describe('Show name'),
    participants: z.array(ParticipantSchema).describe('Participant configurations'),
    options: ShowOptionsSchema.optional().describe('Show options'),
    dryRun: z
      .boolean()
      .optional()
      .default(true)
      .describe('Preview without creating (default: true). Set dryRun: false to execute the build.'),
    inputDelay: z.number().min(0).max(5000).optional().default(500).describe('Delay in ms after each AddInput (default: 500)'),
  }),
  handler: async (
    {
      template,
      name,
      participants,
      options,
      dryRun = true,
      inputDelay = 500,
    }: {
      template: string;
      name: string;
      participants: ParticipantConfig[];
      options?: ShowConfig['options'];
      dryRun: boolean;
      inputDelay: number;
    },
    ctx: ToolContext
  ) => {
    const tmpl = getTemplate(template);
    if (!tmpl) {
      return errorResult(`Template "${template}" not found.`);
    }

    // Validate participant count
    if (participants.length < tmpl.participantCount.min) {
      return errorResult(
        `Template requires at least ${tmpl.participantCount.min} participants, got ${participants.length}.`
      );
    }
    if (participants.length > tmpl.participantCount.max) {
      return errorResult(
        `Template supports max ${tmpl.participantCount.max} participants, got ${participants.length}.`
      );
    }

    // Merge options with defaults
    const finalOptions = { ...tmpl.defaultOptions, ...options };

    // Build the plan
    const plan: string[] = [];
    let inputNum = 1;

    plan.push(`# Show Build Plan: ${name}`);
    plan.push(`Template: ${tmpl.name}`);
    plan.push('');

    // 1. Add camera inputs
    plan.push('## Step 1: Camera Inputs');
    for (const p of participants) {
      if (p.camera.type === 'existing') {
        plan.push(`- ${AUTO} Use existing input "${p.camera.source}" for ${p.name}`);
      } else if (p.camera.type === 'ndi') {
        plan.push(
          `- ${AUTO} Add NDI input: "${p.name} Camera" from "${p.camera.source}" ` +
            '(a placeholder is created if the NDI source cannot be added via the API)'
        );
        inputNum++;
      } else {
        // capture / webcam - vMix AddInput cannot add capture devices
        plan.push(
          `- ${MANUAL} Add camera "${p.name} Camera" from device "${p.camera.source}" ` +
            '(capture devices cannot be added via the vMix API - use Add Input → Camera in vMix)'
        );
      }
    }
    plan.push('');

    // 2. Add microphone inputs (if separate)
    const separateMics = participants.filter((p) => p.microphone.type === 'separate');
    if (separateMics.length > 0) {
      plan.push('## Step 2: Separate Microphones');
      for (const p of separateMics) {
        if (p.microphone.source && looksLikeFilePath(p.microphone.source)) {
          plan.push(`- ${AUTO} Add AudioFile input: "${p.name} Mic" from "${p.microphone.source}"`);
          inputNum++;
        } else {
          plan.push(
            `- ${MANUAL} Add microphone "${p.name} Mic" from device "${p.microphone.source ?? '(unspecified)'}" ` +
              '(audio devices cannot be added via the vMix API - use Add Input → Audio Input in vMix)'
          );
        }
      }
      plan.push('');
    }

    // 3. Add graphics
    plan.push('## Step 3: Graphics');
    if (finalOptions.lowerThirdPath) {
      plan.push(`- ${AUTO} Add GT input: "Lower Third" from "${finalOptions.lowerThirdPath}"`);
      inputNum++;
    }
    if (finalOptions.logoBugPath) {
      plan.push(`- ${AUTO} Add Image input: "Logo Bug" from "${finalOptions.logoBugPath}"`);
      inputNum++;
    }
    if (finalOptions.startingSoonPath) {
      plan.push(`- ${AUTO} Add Image input: "Starting Soon" from "${finalOptions.startingSoonPath}"`);
      inputNum++;
    }
    if (finalOptions.brbPath) {
      plan.push(`- ${AUTO} Add Image input: "BRB" from "${finalOptions.brbPath}"`);
      inputNum++;
    }
    plan.push('');

    // 4. Add media
    plan.push('## Step 4: Media');
    if (finalOptions.includeMusic && finalOptions.musicPath) {
      plan.push(`- ${AUTO} Add AudioFile input: "Background Music" from "${finalOptions.musicPath}"`);
      inputNum++;
    }
    if (finalOptions.includeIntro && finalOptions.introPath) {
      plan.push(`- ${AUTO} Add Video input: "Intro" from "${finalOptions.introPath}"`);
      inputNum++;
    }
    if (finalOptions.includeOutro && finalOptions.outroPath) {
      plan.push(`- ${AUTO} Add Video input: "Outro" from "${finalOptions.outroPath}"`);
      inputNum++;
    }
    if (finalOptions.includeStinger && finalOptions.stingerPath) {
      plan.push(
        `- ${AUTO} Add Video input: "Stinger" from "${finalOptions.stingerPath}" ` +
          '(assigning it as a stinger transition must be done manually in vMix transition settings)'
      );
      inputNum++;
    }
    plan.push(`- ${AUTO} Add Colour input: "Black" (#000000)`);
    inputNum++;
    plan.push('');

    // 5. Audio routing - not performed by this tool
    plan.push('## Step 5: Audio Routing');
    for (const p of participants) {
      const buses = p.microphone.bus.join(', ');
      plan.push(`- ${MANUAL} Route "${p.name}" audio to buses: ${buses} (use vmix_audio_bus or the vMix audio mixer)`);
    }
    if (finalOptions.includeMusic) {
      plan.push(
        `- ${MANUAL} Route "Background Music" to Master, ducking to ${finalOptions.musicDuckLevel}% when mics active ` +
          '(ducking requires a script or manual mixer setup)'
      );
    }
    plan.push('');

    // 6. Create multiview (for podcasts) - not performed by this tool
    if (tmpl.multiviews.length > 0) {
      plan.push('## Step 6: Multi-View Layouts');
      for (const mv of tmpl.multiviews) {
        const inputNames = participants.map((p) => `"${p.name} Camera"`).join(', ');
        plan.push(`- ${MANUAL} Create ${mv.layout} layout "${mv.name}" with: ${inputNames}`);
      }
      plan.push('');
    }

    // 7. Overlay assignments - not performed by this tool
    plan.push('## Step 7: Overlay Assignments');
    plan.push(`- ${MANUAL} Channel 1: ${tmpl.overlayAssignments.channel1}`);
    plan.push(`- ${MANUAL} Channel 2: ${tmpl.overlayAssignments.channel2}`);
    plan.push(`- ${MANUAL} Channel 3: ${tmpl.overlayAssignments.channel3}`);
    plan.push(`- ${MANUAL} Channel 4: ${tmpl.overlayAssignments.channel4}`);
    plan.push('');

    // Summary
    plan.push('## Summary');
    plan.push(`- Inputs created automatically: ~${inputNum - 1}`);
    plan.push(`- Participants: ${participants.length}`);
    plan.push(`- Multi-views (manual): ${tmpl.multiviews.length}`);
    plan.push(`- Steps marked ${MANUAL} are NOT performed by this tool.`);
    plan.push('');

    if (dryRun) {
      plan.push('---');
      plan.push('**DRY RUN** - No changes made. Re-run with `dryRun: false` to build.');
      return successResult(plan.join('\n'));
    }

    // Execute the build
    plan.push('---');
    plan.push('## Executing Build...');
    plan.push('');

    const created: string[] = [];
    const failed: string[] = [];
    const manual: string[] = [];

    // Helper: add an input via AddInput, verify it appeared, rename it.
    const addAndRename = async (value: string, inputName: string): Promise<boolean> => {
      ctx.state.invalidate();
      const stateBefore = await ctx.state.getState();
      const countBefore = stateBefore.inputs.length;

      await ctx.vmix.http.execute('AddInput', { Value: value });
      await delay(inputDelay);

      ctx.state.invalidate();
      const stateAfter = await ctx.state.getState();
      if (stateAfter.inputs.length <= countBefore) {
        return false;
      }

      const lastInput = stateAfter.inputs[stateAfter.inputs.length - 1];
      if (lastInput) {
        await ctx.vmix.http.execute('SetInputName', { Input: lastInput.key, Value: inputName });
      }
      return true;
    };

    // Execute Step 1: Camera inputs
    for (const p of participants) {
      if (p.camera.type === 'existing') {
        created.push(`✓ Using existing: "${p.camera.source}"`);
        continue;
      }

      if (p.camera.type === 'capture' || p.camera.type === 'webcam') {
        // vMix AddInput cannot add capture devices - known to fail, so don't try.
        manual.push(
          `⚠ "${p.name} Camera": add manually in vMix (Add Input → Camera → "${p.camera.source}"), then rename it to "${p.name} Camera".`
        );
        continue;
      }

      try {
        const added = await addAndRename(`NDI|${p.camera.source}`, `${p.name} Camera`);

        if (!added) {
          // NDI failed - create placeholder
          const placeholderColour = String(0xff000000 | 0);
          const placeholderAdded = await addAndRename(
            `Colour|${placeholderColour}`,
            `${p.name} Camera`
          );
          if (placeholderAdded) {
            created.push(`⚠ Placeholder: "${p.name} Camera" (NDI needs manual setup)`);
          } else {
            failed.push(
              `✗ Failed to add "${p.name} Camera": NDI source could not be added and placeholder creation failed.`
            );
          }
        } else {
          created.push(`✓ Added: "${p.name} Camera"`);
        }
      } catch (e) {
        failed.push(`✗ Failed to add "${p.name} Camera": ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    // Execute Step 2: Separate microphones
    for (const p of separateMics) {
      if (!p.microphone.source || !looksLikeFilePath(p.microphone.source)) {
        // Audio devices cannot be added via the API (AudioFile expects a file path).
        manual.push(
          `⚠ "${p.name} Mic": add manually in vMix (Add Input → Audio Input → "${p.microphone.source ?? '(unspecified)'}"), then rename it to "${p.name} Mic".`
        );
        continue;
      }

      try {
        const added = await addAndRename(`AudioFile|${p.microphone.source}`, `${p.name} Mic`);
        if (added) {
          created.push(`✓ Added: "${p.name} Mic"`);
        } else {
          failed.push(
            `✗ Failed to add "${p.name} Mic": vMix did not create the input. Check the file path "${p.microphone.source}".`
          );
        }
      } catch (e) {
        failed.push(`✗ Failed to add "${p.name} Mic": ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    // Helper: add an input and report on the created/failed lists.
    const addSimple = async (value: string, label: string): Promise<void> => {
      try {
        await ctx.vmix.http.execute('AddInput', { Value: value });
        await delay(inputDelay);
        created.push(`✓ Added: "${label}"`);
      } catch (e) {
        failed.push(`✗ Failed to add ${label}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    };

    // Execute Step 3: Graphics
    if (finalOptions.lowerThirdPath) {
      await addSimple(`GT|${finalOptions.lowerThirdPath}`, 'Lower Third');
    }
    if (finalOptions.logoBugPath) {
      await addSimple(`Image|${finalOptions.logoBugPath}`, 'Logo Bug');
    }
    if (finalOptions.startingSoonPath) {
      await addSimple(`Image|${finalOptions.startingSoonPath}`, 'Starting Soon');
    }
    if (finalOptions.brbPath) {
      await addSimple(`Image|${finalOptions.brbPath}`, 'BRB');
    }

    // Execute Step 4: Media
    if (finalOptions.includeMusic && finalOptions.musicPath) {
      await addSimple(`AudioFile|${finalOptions.musicPath}`, 'Background Music');
    }
    if (finalOptions.includeIntro && finalOptions.introPath) {
      await addSimple(`Video|${finalOptions.introPath}`, 'Intro');
    }
    if (finalOptions.includeOutro && finalOptions.outroPath) {
      await addSimple(`Video|${finalOptions.outroPath}`, 'Outro');
    }
    if (finalOptions.includeStinger && finalOptions.stingerPath) {
      await addSimple(`Video|${finalOptions.stingerPath}`, 'Stinger');
      manual.push(
        '⚠ "Stinger": the video input was added, but you must assign it as a stinger transition in vMix Settings → Shortcuts/Transitions.'
      );
    }

    // Add black (using signed Int32 ARGB format that vMix requires)
    await addSimple(`Colour|${String(0xff000000 | 0)}`, 'Black'); // "-16777216"

    // Steps 5-7 are not automatable via the vMix HTTP API from here.
    for (const p of participants) {
      manual.push(
        `⚠ Audio routing for "${p.name}": route to buses ${p.microphone.bus.join(', ')} (use vmix_audio_bus or the vMix audio mixer).`
      );
    }
    if (tmpl.multiviews.length > 0) {
      manual.push('⚠ Multi-view layouts: create manually in vMix (Add Input → Virtual Set/Multi View, or use layers).');
    }
    manual.push('⚠ Overlay assignments: configure overlay channels 1-4 manually in vMix.');

    // Build result
    plan.push('### Created:');
    for (const c of created) {
      plan.push(c);
    }

    if (failed.length > 0) {
      plan.push('');
      plan.push('### Failed:');
      for (const f of failed) {
        plan.push(f);
      }
    }

    if (manual.length > 0) {
      plan.push('');
      plan.push('### Manual setup still required:');
      for (const m of manual) {
        plan.push(m);
      }
    }

    plan.push('');
    plan.push(`**Build complete.** Created ${created.length} inputs, ${failed.length} failed, ${manual.length} manual steps remaining.`);
    plan.push('');
    plan.push('Next steps:');
    plan.push('1. Use `vmix_show_validate` to check the setup');
    plan.push('2. Complete the manual setup steps listed above');
    plan.push('3. Test all inputs before going live');

    return {
      content: [{ type: 'text' as const, text: plan.join('\n') }],
      isError: failed.length > created.length,
    };
  },
});

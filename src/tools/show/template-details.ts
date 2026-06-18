/**
 * vmix_show_template_details - Get detailed template specification
 */

import { z } from 'zod';
import { createTool, successResult, errorResult } from '../base.js';
import { getTemplate, SHOW_TEMPLATES } from './templates.js';

export const showTemplateDetailsTool = createTool({
  name: 'vmix_show_template_details',
  description:
    'Get the full specification for a show template, including all inputs that will be created, ' +
    'audio routing configuration, overlay assignments, and multiview layouts. ' +
    'Use this to understand what a template provides before building.',
  schema: z.object({
    template: z
      .string()
      .describe(
        'Template ID (e.g., "four-person-podcast", "two-person-podcast", "talk-show")'
      ),
  }),
  handler: ({ template }: { template: string }) => {
    const tmpl = getTemplate(template);

    if (!tmpl) {
      const available = Object.keys(SHOW_TEMPLATES).join(', ');
      return Promise.resolve(
        errorResult(`Template "${template}" not found.\n\nAvailable templates: ${available}`)
      );
    }

    let text = `# ${tmpl.name}\n\n`;
    text += `${tmpl.description}\n\n`;

    // Participants
    text += `## Participants\n`;
    text += `- Minimum: ${tmpl.participantCount.min}\n`;
    text += `- Maximum: ${tmpl.participantCount.max}\n\n`;

    // Features
    text += `## Features\n`;
    for (const feature of tmpl.features) {
      text += `- ${feature}\n`;
    }
    text += '\n';

    // Inputs that will be created
    text += `## Inputs Created\n`;
    text += `For a ${tmpl.participantCount.max}-person setup:\n`;
    text += '```\n';
    for (let i = 1; i <= tmpl.participantCount.max; i++) {
      text += `${i}. Participant ${i} Camera\n`;
    }
    let inputNum = tmpl.participantCount.max + 1;
    if (tmpl.id.includes('podcast')) {
      text += `${inputNum++}. Quad View (multi-view)\n`;
    }
    text += `${inputNum++}. Lower Third\n`;
    if (tmpl.defaultOptions.includeMusic) {
      text += `${inputNum++}. Background Music\n`;
    }
    if (tmpl.defaultOptions.includeIntro) {
      text += `${inputNum++}. Intro Video\n`;
    }
    if (tmpl.defaultOptions.includeOutro) {
      text += `${inputNum++}. Outro Video\n`;
    }
    if (tmpl.defaultOptions.includeStinger) {
      text += `${inputNum++}. Stinger Transition\n`;
    }
    text += `${inputNum++}. Starting Soon\n`;
    text += `${inputNum++}. BRB\n`;
    text += `${inputNum++}. Black\n`;
    text += '```\n\n';

    // Audio routing
    text += `## Audio Routing\n`;
    text += '```\n';
    text += `Master (M): ${tmpl.audioRouting.master.join(', ')}\n`;
    if (tmpl.audioRouting.busA) {
      text += `Bus A: ${tmpl.audioRouting.busA.join(', ')}\n`;
    }
    if (tmpl.audioRouting.busB) {
      text += `Bus B: ${tmpl.audioRouting.busB.join(', ')}\n`;
    }
    if (tmpl.audioRouting.busC) {
      text += `Bus C: ${tmpl.audioRouting.busC.join(', ')}\n`;
    }
    text += '```\n\n';

    // Overlays
    text += `## Overlay Assignments\n`;
    text += '```\n';
    text += `Channel 1: ${tmpl.overlayAssignments.channel1}\n`;
    text += `Channel 2: ${tmpl.overlayAssignments.channel2}\n`;
    text += `Channel 3: ${tmpl.overlayAssignments.channel3}\n`;
    text += `Channel 4: ${tmpl.overlayAssignments.channel4}\n`;
    text += '```\n\n';

    // Multiviews
    text += `## Multi-View Layouts\n`;
    for (const mv of tmpl.multiviews) {
      text += `- **${mv.name}** (${mv.layout}): ${mv.description}\n`;
    }
    text += '\n';

    // Example config
    text += `## Example Configuration\n`;
    text += '```json\n';
    text += JSON.stringify(
      {
        template: tmpl.id,
        name: 'My Show',
        participants: [
          {
            name: 'Host',
            title: 'Host',
            camera: { type: 'ndi', source: 'OBS (Webcam)' },
            microphone: { type: 'embedded', bus: ['M', 'A'] },
          },
          {
            name: 'Guest',
            title: 'Guest',
            camera: { type: 'capture', source: 'Cam Link 4K' },
            microphone: { type: 'separate', source: 'USB Mic', bus: ['M', 'A'] },
          },
        ],
        options: {
          lowerThirdPath: 'C:\\Graphics\\LowerThird.gtzip',
          musicPath: 'C:\\Music\\background.mp3',
          ...tmpl.defaultOptions,
        },
      },
      null,
      2
    );
    text += '\n```\n';

    return Promise.resolve(successResult(text));
  },
});

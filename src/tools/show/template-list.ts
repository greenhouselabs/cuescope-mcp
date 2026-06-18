/**
 * vmix_show_template_list - List available show templates
 */

import { z } from 'zod';
import { createTool, successResult } from '../base.js';
import { listTemplates } from './templates.js';

export const showTemplateListTool = createTool({
  name: 'vmix_show_template_list',
  description:
    'List all available show templates for quick production setup. ' +
    'Templates include podcasts, talk shows, and other common formats with pre-configured ' +
    'inputs, audio routing, overlays, and multiview layouts.',
  schema: z.object({}),
  handler: () => {
    const templates = listTemplates();

    let text = '# Available Show Templates\n\n';
    for (const template of templates) {
      text += `## ${template.name}\n`;
      text += `**ID:** \`${template.id}\`\n`;
      text += `${template.description}\n\n`;
    }

    text += '\n---\n';
    text += 'Use `vmix_show_template_details` with a template ID to see full configuration.\n';
    text += 'Use `vmix_show_build` to create a show from a template.';

    return Promise.resolve(successResult(text));
  },
});

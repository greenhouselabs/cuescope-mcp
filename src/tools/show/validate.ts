/**
 * vmix_show_validate - Validate show setup against template requirements
 */

import { z } from 'zod';
import { createTool, successResult, type ToolContext } from '../base.js';
import { getTemplate, SHOW_TEMPLATES } from './templates.js';

export const showValidateTool = createTool({
  name: 'vmix_show_validate',
  description:
    'Validate the current vMix setup against a show template requirements. ' +
    'Checks for required inputs, audio routing, and configuration. ' +
    'Use before going live to ensure everything is ready.',
  schema: z.object({
    template: z
      .string()
      .optional()
      .describe('Template ID to validate against (optional - does general check if not specified)'),
    participantCount: z
      .number()
      .optional()
      .describe('Expected number of participants'),
  }),
  handler: async (
    {
      template,
      participantCount,
    }: {
      template?: string;
      participantCount?: number;
    },
    ctx: ToolContext
  ) => {
    const state = await ctx.state.getState();
    const checks: { passed: boolean; message: string; severity: 'error' | 'warning' | 'info' }[] = [];

    // Basic checks
    checks.push({
      passed: state.inputs.length > 0,
      message: state.inputs.length > 0
        ? `Found ${state.inputs.length} inputs`
        : 'No inputs found in vMix',
      severity: state.inputs.length > 0 ? 'info' : 'error',
    });

    // Check for video/camera inputs
    const videoInputs = state.inputs.filter(
      (i) => i.type === 'Capture' || i.type === 'NDI' || i.type === 'Video'
    );
    checks.push({
      passed: videoInputs.length > 0,
      message: videoInputs.length > 0
        ? `Found ${videoInputs.length} video/camera inputs`
        : 'No video or camera inputs found',
      severity: videoInputs.length > 0 ? 'info' : 'error',
    });

    // Check for graphics
    const graphicInputs = state.inputs.filter(
      (i) => i.type === 'GT' || i.type === 'Title' || i.type === 'Image'
    );
    checks.push({
      passed: graphicInputs.length > 0,
      message: graphicInputs.length > 0
        ? `Found ${graphicInputs.length} graphic inputs`
        : 'No graphic inputs found (lower thirds, images)',
      severity: graphicInputs.length > 0 ? 'info' : 'warning',
    });

    // Check for audio
    const audioInputs = state.inputs.filter(
      (i) => i.audioBuses && i.audioBuses.length > 0
    );
    checks.push({
      passed: audioInputs.length > 0,
      message: audioInputs.length > 0
        ? `Found ${audioInputs.length} inputs with audio routing`
        : 'No inputs have audio bus assignments',
      severity: audioInputs.length > 0 ? 'info' : 'warning',
    });

    // Template-specific checks
    if (template) {
      const tmpl = getTemplate(template);
      if (!tmpl) {
        const available = Object.keys(SHOW_TEMPLATES).join(', ');
        checks.push({
          passed: false,
          message: `Template "${template}" not found. Available: ${available}`,
          severity: 'error',
        });
      } else {
        // Check participant count
        const expectedCount = participantCount ?? tmpl.participantCount.min;
        const cameraInputs = state.inputs.filter(
          (i) => i.type === 'Capture' || i.type === 'NDI'
        );

        checks.push({
          passed: cameraInputs.length >= expectedCount,
          message: cameraInputs.length >= expectedCount
            ? `✓ Found ${cameraInputs.length} camera inputs (need ${expectedCount})`
            : `Need ${expectedCount} camera inputs, found ${cameraInputs.length}`,
          severity: cameraInputs.length >= expectedCount ? 'info' : 'error',
        });

        // Check for lower thirds
        if (tmpl.overlayAssignments.channel1.toLowerCase().includes('lower')) {
          const lowerThird = state.inputs.find(
            (i) =>
              (i.type === 'GT' || i.type === 'Title') &&
              (i.title.toLowerCase().includes('lower') ||
                i.title.toLowerCase().includes('third') ||
                i.title.toLowerCase().includes('name'))
          );
          checks.push({
            passed: !!lowerThird,
            message: lowerThird
              ? `✓ Lower third found: "${lowerThird.title}"`
              : '⚠ No lower third input found',
            severity: lowerThird ? 'info' : 'warning',
          });
        }

        // Check for music (if template requires it)
        if (tmpl.defaultOptions.includeMusic) {
          const music = state.inputs.find(
            (i) =>
              i.type === 'AudioFile' ||
              i.title.toLowerCase().includes('music') ||
              i.title.toLowerCase().includes('background')
          );
          checks.push({
            passed: !!music,
            message: music
              ? `✓ Background music found: "${music.title}"`
              : '⚠ No background music input found (optional)',
            severity: music ? 'info' : 'warning',
          });
        }

        // Check for intro
        if (tmpl.defaultOptions.includeIntro) {
          const intro = state.inputs.find(
            (i) =>
              i.type === 'Video' &&
              (i.title.toLowerCase().includes('intro') ||
                i.title.toLowerCase().includes('open'))
          );
          checks.push({
            passed: !!intro,
            message: intro
              ? `✓ Intro video found: "${intro.title}"`
              : '⚠ No intro video found (optional)',
            severity: intro ? 'info' : 'warning',
          });
        }

        // Check for stinger
        if (tmpl.defaultOptions.includeStinger) {
          const stinger = state.inputs.find(
            (i) =>
              i.type === 'Video' &&
              (i.title.toLowerCase().includes('stinger') ||
                i.title.toLowerCase().includes('transition'))
          );
          checks.push({
            passed: !!stinger,
            message: stinger
              ? `✓ Stinger found: "${stinger.title}"`
              : '⚠ No stinger transition found (optional)',
            severity: stinger ? 'info' : 'warning',
          });
        }
      }
    }

    // Build result
    const errors = checks.filter((c) => !c.passed && c.severity === 'error');
    const warnings = checks.filter((c) => !c.passed && c.severity === 'warning');
    const passed = checks.filter((c) => c.passed);

    let text = '# Show Validation Results\n\n';

    if (template) {
      text += `Template: **${template}**\n\n`;
    }

    if (errors.length === 0) {
      text += '## ✓ Ready for Production\n\n';
    } else {
      text += '## ✗ Issues Found\n\n';
    }

    // Show all checks
    text += '### Checks:\n';
    for (const check of checks) {
      const icon = check.passed ? '✓' : check.severity === 'error' ? '✗' : '⚠';
      text += `${icon} ${check.message}\n`;
    }

    text += '\n### Summary:\n';
    text += `- Passed: ${passed.length}\n`;
    text += `- Errors: ${errors.length}\n`;
    text += `- Warnings: ${warnings.length}\n`;

    if (errors.length > 0) {
      text += '\n**Fix the errors above before going live.**';
    } else if (warnings.length > 0) {
      text += '\n**Warnings are optional items. Review and proceed if acceptable.**';
    } else {
      text += '\n**All checks passed. You are ready to go live!**';
    }

    return successResult(text);
  },
});

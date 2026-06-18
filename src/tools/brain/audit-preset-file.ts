/**
 * vmix_audit_preset_file - Cross-reference a saved .vmix preset against live state.
 * Surfaces ScriptStart triggers with missing scripts, triggers targeting absent
 * inputs, and saved-vs-live drift.
 */
import { z } from 'zod';
import { createTool, toolJsonContent, errorResult, type ToolContext } from '../base.js';
import { loadPresetFile } from '../../state/preset/preset-loader.js';
import { parsePresetFile } from '../../state/preset/preset-parser.js';
import { redactPresetFile } from '../../state/preset/preset-redaction.js';
import { crossReferencePreset, type CrossReferenceFinding } from '../../state/preset/cross-reference.js';
import { formatErrorMessage } from '../../errors/index.js';

const schema = z.object({
  path: z.string().optional().describe('Absolute path to a .vmix file on the server host.'),
  content: z.string().optional().describe('Raw .vmix XML, as an alternative to a path.'),
});

function summarize(findings: CrossReferenceFinding[]) {
  return {
    total: findings.length,
    errors: findings.filter((f) => f.severity === 'error').length,
    warnings: findings.filter((f) => f.severity === 'warning').length,
    info: findings.filter((f) => f.severity === 'info').length,
  };
}

export const auditPresetFileTool = createTool({
  name: 'vmix_audit_preset_file',
  description:
    'Read-only cross-reference of a saved .vmix preset against current live vMix state. Flags triggers that call ' +
    'missing scripts, triggers targeting absent inputs, and saved-vs-live drift. Reflects the preset as last saved.',
  schema,
  handler: async (params: { path?: string; content?: string }, ctx: ToolContext) => {
    if (!params.path?.trim() && !params.content) {
      return errorResult('Provide either a .vmix file path or its content.');
    }
    try {
      const preset = redactPresetFile(parsePresetFile(loadPresetFile(params)));
      const state = await ctx.state.getState();
      const findings = crossReferencePreset(preset, state);
      return toolJsonContent({
        source: preset.meta.source,
        freshnessNote: preset.meta.freshnessNote,
        meta: preset.meta,
        findingSummary: summarize(findings),
        findings,
        note: 'Errors usually mean a saved reference was renamed/removed live, or the preset was not re-saved after edits.',
      });
    } catch (error) {
      return errorResult(formatErrorMessage(error));
    }
  },
});

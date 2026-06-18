/**
 * vmix_read_preset_file - Read-only inventory of a saved .vmix preset.
 * Loads + parses + redacts; labeled "as last saved". Does not touch vMix.
 */
import { z } from 'zod';
import { createTool, toolJsonContent, errorResult, type ToolContext } from '../base.js';
import { loadPresetFile } from '../../state/preset/preset-loader.js';
import { parsePresetFile } from '../../state/preset/preset-parser.js';
import { redactPresetFile } from '../../state/preset/preset-redaction.js';
import type { PresetFile, PresetInput, PresetScript } from '../../state/preset/preset-types.js';
import { formatErrorMessage } from '../../errors/index.js';

type DetailMode = 'summary' | 'full';

const schema = z.object({
  path: z.string().optional().describe('Absolute path to a .vmix file on the server host.'),
  content: z.string().optional().describe('Raw .vmix XML, as an alternative to a path (e.g. remote host).'),
  detailMode: z
    .enum(['summary', 'full'])
    .optional()
    .describe('Output detail. summary is compact and omits script source/trigger bodies; full includes everything. Default: summary.'),
});

interface ReadPresetFileParams {
  path?: string;
  content?: string;
  detailMode?: DetailMode;
}

function countBy<T>(items: T[], keyOf: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyOf(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function lineCount(text: string): number {
  if (text.length === 0) return 0;
  return text.split(/\r\n|\r|\n/).length;
}

function scriptSummary(script: PresetScript) {
  return {
    name: script.name,
    sourceLength: script.source.length,
    lineCount: lineCount(script.source),
    hasSource: script.source.length > 0,
  };
}

function inputSummary(input: PresetInput) {
  return {
    key: input.key,
    title: input.title,
    type: input.type,
    triggerCount: input.triggers.length,
    audio: input.audio
      ? {
          muted: input.audio.muted,
          buses: input.audio.buses,
          busMaster: input.audio.busMaster,
        }
      : null,
    videoCall: input.videoCall
      ? {
          hasKey: input.videoCall.hasKey,
          returnAudioIndex: input.videoCall.returnAudioIndex,
          returnVideoName: input.videoCall.returnVideoName,
          serverMode: input.videoCall.serverMode,
          bandwidthProfile: input.videoCall.bandwidthProfile,
          guestBandwidth: input.videoCall.guestBandwidth,
        }
      : null,
  };
}

function baseInventory(preset: PresetFile, detailMode: DetailMode) {
  const triggerCount = preset.inputs.reduce((n, i) => n + i.triggers.length, 0);
  const videoCallInputs = preset.inputs.filter((input) => input.videoCall !== null);
  const inputsWithSavedAudio = preset.inputs.filter((input) => input.audio !== null);

  return {
    detailMode,
    source: preset.meta.source,
    freshnessNote: preset.meta.freshnessNote,
    meta: preset.meta,
    counts: {
      scripts: preset.scripts.length,
      scriptSourceCharacters: preset.scripts.reduce((n, script) => n + script.source.length, 0),
      inputs: preset.inputs.length,
      triggers: triggerCount,
      dataSources: preset.dataSources.length,
      inputsWithSavedAudio: inputsWithSavedAudio.length,
      videoCallInputs: videoCallInputs.length,
    },
    inputTypeCounts: countBy(preset.inputs, (input) => input.type ?? 'unknown'),
  };
}

function buildInventory(preset: PresetFile, detailMode: DetailMode) {
  const base = baseInventory(preset, detailMode);

  if (detailMode === 'full') {
    return {
      ...base,
      scripts: preset.scripts,
      inputs: preset.inputs,
      dataSources: preset.dataSources,
    };
  }

  return {
    ...base,
    scripts: preset.scripts.map(scriptSummary),
    inputs: preset.inputs.map(inputSummary),
    dataSources: preset.dataSources,
    omitted: {
      scriptSources: preset.scripts.length,
      inputTriggers: base.counts.triggers,
      reason: 'summary mode omits script source and full trigger bodies. Re-run with detailMode="full" for complete preset data.',
    },
  };
}

export const readPresetFileTool = createTool({
  name: 'vmix_read_preset_file',
  description:
    'Read-only inventory of a saved vMix .vmix preset file: scripts, input triggers, data sources, inputs, saved audio flags, and vMix Call metadata. ' +
    'Defaults to a compact summary; use detailMode="full" for script source and full trigger bodies. ' +
    'Secrets are redacted. Reflects the preset as last saved, which may differ from live vMix state.',
  schema,
  handler: (params: ReadPresetFileParams, _ctx: ToolContext) => {
    if (!params.path?.trim() && !params.content) {
      return Promise.resolve(errorResult('Provide either a .vmix file path or its content.'));
    }
    try {
      const preset = redactPresetFile(parsePresetFile(loadPresetFile(params)));
      return Promise.resolve(toolJsonContent(buildInventory(preset, params.detailMode ?? 'summary')));
    } catch (error) {
      return Promise.resolve(errorResult(formatErrorMessage(error)));
    }
  },
});

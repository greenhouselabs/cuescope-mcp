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
  content: z
    .string()
    .optional()
    .describe('Raw .vmix XML fallback when a server-host file path is unavailable; prefer path for real/large presets.'),
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
  const titleMetadata = input.titleMetadata
    ? {
        hasCountdownXml: input.titleMetadata.hasCountdownXml,
        hasDataSourcesXml: input.titleMetadata.hasDataSourcesXml,
        countdownSettingCount: input.titleMetadata.countdownSettings.length,
        dataSourceBindingCount: input.titleMetadata.dataSourceBindings.length,
        countdownSettings: input.titleMetadata.countdownSettings.map((setting) => ({
          fieldName: setting.fieldName,
          startTime: setting.startTime,
          duration: setting.duration,
          format: setting.format,
          reverse: setting.reverse,
          reverseDisplay: setting.reverseDisplay,
          autoStart: setting.autoStart,
          loop: setting.loop,
          actionAtEnd: setting.actionAtEnd,
        })),
        dataSourceBindings: input.titleMetadata.dataSourceBindings.map((binding) => ({
          fieldName: binding.fieldName,
          instanceId: binding.instanceId,
          dataSource: binding.dataSource,
          table: binding.table,
          column: binding.column,
          row: binding.row,
        })),
      }
    : null;

  return {
    key: input.key,
    title: input.title,
    type: input.type,
    triggerCount: input.triggers.length,
    titleMetadata,
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
  const inputsWithTitleMetadata = preset.inputs.filter((input) => input.titleMetadata !== null);

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
      titleMetadataInputs: inputsWithTitleMetadata.length,
      titleCountdownSettings: preset.inputs.reduce(
        (n, input) => n + (input.titleMetadata?.countdownSettings.length ?? 0),
        0
      ),
      titleDataSourceBindings: preset.inputs.reduce(
        (n, input) => n + (input.titleMetadata?.dataSourceBindings.length ?? 0),
        0
      ),
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
      reason:
        'summary mode omits script source and full trigger bodies. Use this compact summary first for title countdown/data-source metadata and input-level counts. Re-run with detailMode="full" only when raw scripts or full trigger bodies are needed.',
    },
  };
}

export const readPresetFileTool = createTool({
  name: 'vmix_read_preset_file',
  description:
    'Read-only inventory of a saved vMix .vmix preset file: scripts, input triggers, global data sources, title countdown/data-source metadata, inputs, saved audio flags, and vMix Call metadata. ' +
    'Defaults to a compact summary; use summary first for one-input saved-preset questions about title metadata or data-source bindings. Use detailMode="full" only when raw script source or full trigger bodies are specifically needed. ' +
    'Secrets are redacted. Reflects the preset as last saved, which may differ from live vMix state. ' +
    'Use only when the user supplies an explicit .vmix path on the machine running CueScope or asks for saved-only facts. Chat-uploaded attachments may not be readable by the MCP server, and raw XML is a fallback. For current input questions, use live-state tools first; if vMix is disconnected, run vmix_connection_test before asking for a saved file.',
  schema,
  handler: (params: ReadPresetFileParams, _ctx: ToolContext) => {
    if (!params.path?.trim() && !params.content) {
      return Promise.resolve(
        errorResult('Provide either a .vmix file path on the CueScope server host or raw XML content as a fallback.')
      );
    }
    try {
      const preset = redactPresetFile(parsePresetFile(loadPresetFile(params)));
      return Promise.resolve(toolJsonContent(buildInventory(preset, params.detailMode ?? 'summary')));
    } catch (error) {
      return Promise.resolve(errorResult(formatErrorMessage(error)));
    }
  },
});

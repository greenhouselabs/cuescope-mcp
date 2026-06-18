/**
 * Parse a saved .vmix preset into a typed PresetFile.
 * Root is <XML>. Scripts hold entity-escaped VB.NET. Input triggers are an
 * entity-escaped XML sub-document inside each <Input>'s Triggers="…" attribute.
 * Format-specific names live in SCHEMA (confirmed in 2026-06-10-preset-schema-notes.md).
 */
import { VmixError } from '../../errors/index.js';
import { decodeEntities, getSection, elements, scanOpenTags, attrValue, textOf } from './xml-decode.js';
import {
  PRESET_FRESHNESS_NOTE,
  type PresetFile,
  type PresetFileMeta,
  type PresetScript,
  type PresetInput,
  type PresetInputAudio,
  type PresetInputTrigger,
  type PresetInputVideoCall,
  type PresetDataSource,
  type PresetDataSourceTable,
} from './preset-types.js';
import type { LoadedPreset } from './preset-loader.js';

const SCHEMA = {
  scriptingContainer: 'Scripting',
  scriptElement: 'Script',
  scriptCodeTag: 'Code',
  scriptNameTag: 'Name',
  inputElement: 'Input',
  inputTriggersAttr: 'Triggers',
  triggerElement: 'InputTrigger',
  dataSourcesContainer: 'DataSources',
  dataSourceElement: 'datasource',
  dataSourceProviderAttr: 'friendlyName',
  dataSourceInstanceElement: 'instance',
  dataSourceTableElement: 'table',
} as const;

const ZERO_GUID = '00000000-0000-0000-0000-000000000000';

function intOrNull(value: string): number | null {
  if (value.trim() === '') return null;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

function boolOrNull(value: string | null): boolean | null {
  if (value === null || value.trim() === '') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return null;
}

function blankToNull(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const SAVED_BUS_ATTRS = [
  { bus: 'A', attr: 'BusA' },
  { bus: 'B', attr: 'BusB' },
  { bus: 'C', attr: 'BusC' },
  { bus: 'D', attr: 'BusD' },
  { bus: 'E', attr: 'BusE' },
  { bus: 'F', attr: 'BusF' },
  { bus: 'G', attr: 'BusG' },
] as const;

function parseScripts(xml: string): PresetScript[] {
  const scope = getSection(xml, SCHEMA.scriptingContainer);
  const scripts: PresetScript[] = [];
  for (const { inner } of elements(scope, SCHEMA.scriptElement)) {
    scripts.push({
      name: textOf(inner, SCHEMA.scriptNameTag),
      source: textOf(inner, SCHEMA.scriptCodeTag).trim(),
    });
  }
  return scripts;
}

function parseInputTriggers(openTag: string): PresetInputTrigger[] {
  const raw = attrValue(openTag, SCHEMA.inputTriggersAttr); // already entity-decoded once
  if (!raw) return [];
  const triggers: PresetInputTrigger[] = [];
  for (const { inner } of elements(raw, SCHEMA.triggerElement)) {
    const targetBlock = getSection(inner, 'Input');
    const targetKey = textOf(targetBlock, 'Key');
    const targetNumber = intOrNull(textOf(targetBlock, 'Number'));
    triggers.push({
      event: textOf(inner, 'Trigger'),
      function: textOf(inner, 'Function'),
      value: textOf(inner, 'Value') || null,
      duration: intOrNull(textOf(inner, 'Duration')),
      delay: intOrNull(textOf(inner, 'Delay')),
      mix: intOrNull(textOf(inner, 'Mix')),
      targetInputKey: targetKey && targetKey !== ZERO_GUID ? targetKey : null,
      targetInputNumber: targetNumber && targetNumber !== 0 ? targetNumber : null,
    });
  }
  return triggers;
}

function parseInputAudio(openTag: string): PresetInputAudio | null {
  const muted = boolOrNull(attrValue(openTag, 'Muted'));
  const busMaster = boolOrNull(attrValue(openTag, 'BusMaster'));
  const busFlags: PresetInputAudio['busFlags'] = {};
  const buses: string[] = [];

  if (busMaster === true) {
    buses.push('M');
  }

  for (const { bus, attr } of SAVED_BUS_ATTRS) {
    const value = boolOrNull(attrValue(openTag, attr));
    if (value !== null) {
      busFlags[bus] = value;
      if (value) {
        buses.push(bus);
      }
    }
  }

  const hasAudioMetadata = muted !== null || busMaster !== null || Object.keys(busFlags).length > 0;
  if (!hasAudioMetadata) return null;

  return {
    muted,
    buses,
    busMaster,
    busFlags,
  };
}

function parseVideoCall(openTag: string): PresetInputVideoCall | null {
  const key = blankToNull(attrValue(openTag, 'VideoCallKey'));
  const returnAudioIndex = intOrNull(attrValue(openTag, 'VideoCallReturnAudioIndex') ?? '');
  const returnVideoName = blankToNull(attrValue(openTag, 'VideoCallReturnVideoName'));
  const serverMode = blankToNull(attrValue(openTag, 'VideoCallServerMode'));
  const bandwidthProfile = blankToNull(attrValue(openTag, 'VideoCallBandwidthProfile'));
  const guestBandwidth = blankToNull(attrValue(openTag, 'VideoCallGuestBandwidth'));

  if (
    key === null &&
    returnAudioIndex === null &&
    returnVideoName === null &&
    serverMode === null &&
    bandwidthProfile === null &&
    guestBandwidth === null
  ) {
    return null;
  }

  return {
    key,
    hasKey: key !== null,
    returnAudioIndex,
    returnVideoName,
    serverMode,
    bandwidthProfile,
    guestBandwidth,
  };
}

function parseInputs(xml: string): PresetInput[] {
  const inputs: PresetInput[] = [];
  // Only top-level input definitions carry a Title attribute; nested <Input> refs do not.
  // scanOpenTags is quote-aware, so a legal raw '>' inside an attribute value
  // (e.g. Title="Cam 1 -> Wide") does not truncate the open tag.
  for (const openTag of scanOpenTags(xml, SCHEMA.inputElement)) {
    const title = attrValue(openTag, 'Title');
    if (title === null) continue;
    inputs.push({
      key: attrValue(openTag, 'Key'),
      title,
      type: attrValue(openTag, 'Type'),
      audio: parseInputAudio(openTag),
      videoCall: parseVideoCall(openTag),
      triggers: parseInputTriggers(openTag),
    });
  }
  return inputs;
}

function parseDataSources(xml: string): PresetDataSource[] {
  const scope = getSection(xml, SCHEMA.dataSourcesContainer);
  const sources: PresetDataSource[] = [];
  for (const { openTag, inner } of elements(scope, SCHEMA.dataSourceElement)) {
    const instance = getSection(inner, SCHEMA.dataSourceInstanceElement);
    const tables: PresetDataSourceTable[] = [];
    for (const t of elements(getSection(instance, 'tables'), SCHEMA.dataSourceTableElement)) {
      tables.push({ name: attrValue(t.openTag, 'name') ?? '', index: intOrNull(attrValue(t.openTag, 'index') ?? '') });
    }
    const instanceTitle = instance.match(/<instance\b[^>]*\btitle="([^"]*)"/)?.[1] ?? null;
    sources.push({
      provider: attrValue(openTag, SCHEMA.dataSourceProviderAttr) ?? '',
      title: instanceTitle ? decodeEntities(instanceTitle) : null,
      tables,
    });
  }
  return sources;
}

function buildMeta(loaded: LoadedPreset, xml: string): PresetFileMeta {
  const version = xml.match(/<Version>([^<]*)<\/Version>/)?.[1] ?? null;
  return {
    path: loaded.path,
    modifiedAt: loaded.modifiedAt,
    presetVersion: version,
    source: 'saved preset file',
    freshnessNote: PRESET_FRESHNESS_NOTE,
  };
}

export function parsePresetFile(loaded: LoadedPreset): PresetFile {
  const xml = loaded.xml;
  if (!/^\s*<XML[\s>]/.test(xml)) {
    throw new VmixError('Input does not look like a .vmix preset (expected <XML> root).', 'PRESET_PARSE_ERROR');
  }
  return {
    meta: buildMeta(loaded, xml),
    scripts: parseScripts(xml),
    inputs: parseInputs(xml),
    dataSources: parseDataSources(xml),
  };
}

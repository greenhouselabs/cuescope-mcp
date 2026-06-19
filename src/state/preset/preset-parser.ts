/**
 * Parse a saved .vmix preset into a typed PresetFile.
 * Root is <XML>. Scripts hold entity-escaped VB.NET. Input triggers are an
 * entity-escaped XML sub-document inside each <Input>'s Triggers="…" attribute.
 * Format-specific names live in SCHEMA (confirmed in 2026-06-10-preset-schema-notes.md).
 */
import { VmixError } from '../../errors/index.js';
import { decodeEntities, getSection, elements, scanElements, scanOpenTags, attrValue, textOf } from './xml-decode.js';
import {
  PRESET_FRESHNESS_NOTE,
  type PresetFile,
  type PresetFileMeta,
  type PresetScript,
  type PresetInput,
  type PresetInputAudio,
  type PresetInputTrigger,
  type PresetInputVideoCall,
  type PresetInputTitleMetadata,
  type PresetInputCountdownSetting,
  type PresetInputDataSourceBinding,
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

function textOfAny(xml: string, tags: string[]): string | null {
  for (const tag of tags) {
    const match = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
    if (match?.[1] !== undefined) {
      const value = decodeEntities(match[1]).trim();
      if (value.length > 0) return value;
    }
  }
  return null;
}

function collectKnownValues(xml: string, tags: string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const tag of tags) {
    const value = textOfAny(xml, [tag]);
    if (value !== null) values[tag] = value;
  }
  return values;
}

function parseBoolText(value: string | null): boolean | null {
  if (value === null) return null;
  return boolOrNull(value);
}

function attrMap(openTag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([\w:-]+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(openTag)) !== null) {
    attrs[match[1]!.toLowerCase()] = decodeEntities(match[2]!);
  }
  return attrs;
}

function attrOfAny(openTag: string, names: string[]): string | null {
  const attrs = attrMap(openTag);
  for (const name of names) {
    const value = attrs[name.toLowerCase()];
    if (value !== undefined && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function textOrAttr(xml: string, openTag: string, names: string[]): string | null {
  return textOfAny(xml, names) ?? attrOfAny(openTag, names);
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

const COUNTDOWN_VALUE_TAGS = [
  'Name',
  'Field',
  'FieldName',
  'SelectedName',
  'StartTime',
  'StartString',
  'Time',
  'Duration',
  'DurationString',
  'Format',
  'Reverse',
  'ReverseDisplay',
  'AutoStart',
  'Loop',
  'ActionAtEnd',
  'Action',
  'Function',
  'Value',
  'OnCompletion',
] as const;

const DATA_SOURCE_VALUE_TAGS = [
  'Field',
  'FieldName',
  'TitleField',
  'TitleFieldName',
  'Name',
  'Key',
  'InstanceId',
  'InstanceID',
  'DataSourceInstanceId',
  'DataSourceInstanceID',
  'DataSource',
  'DataSourceName',
  'Source',
  'SourceName',
  'Table',
  'TableName',
  'Column',
  'ColumnName',
  'Row',
  'RowIndex',
  'Value',
] as const;

const FIELD_NAME_KEYS = ['FieldName', 'Field', 'TitleFieldName', 'TitleField', 'Name', 'Key'];
const INSTANCE_ID_KEYS = [
  'InstanceId',
  'InstanceID',
  'DataSourceInstanceId',
  'DataSourceInstanceID',
  'DataSourceId',
  'DataSourceID',
  'SourceId',
  'SourceID',
  'Id',
];
const DATA_SOURCE_NAME_KEYS = ['DataSourceName', 'DataSource', 'SourceName', 'Source'];
const TABLE_KEYS = ['TableName', 'Table'];
const COLUMN_KEYS = ['ColumnName', 'Column'];
const ROW_KEYS = ['RowIndex', 'Row'];

function parseCountdownSettings(xml: string): PresetInputCountdownSetting[] {
  const settings: PresetInputCountdownSetting[] = [];

  for (const { inner } of scanElements(xml, 'CountdownSettings', { caseInsensitive: true })) {
    const fieldName = textOfAny(inner, ['FieldName', 'Field', 'SelectedName', 'Name']);
    const startTime = textOfAny(inner, ['StartTime', 'StartString', 'Time']);
    settings.push({
      fieldName,
      startTime,
      duration: textOfAny(inner, ['Duration', 'DurationString']),
      format: textOfAny(inner, ['Format']),
      reverse: parseBoolText(textOfAny(inner, ['Reverse'])),
      reverseDisplay: parseBoolText(textOfAny(inner, ['ReverseDisplay'])),
      autoStart: parseBoolText(textOfAny(inner, ['AutoStart'])),
      loop: parseBoolText(textOfAny(inner, ['Loop'])),
      actionAtEnd: textOfAny(inner, ['ActionAtEnd', 'Action', 'Function', 'OnCompletion']),
      rawValues: collectKnownValues(inner, [...COUNTDOWN_VALUE_TAGS]),
    });
  }

  return settings;
}

function isDataSourceBinding(binding: PresetInputDataSourceBinding): boolean {
  return (
    binding.fieldName !== null ||
    binding.instanceId !== null ||
    binding.dataSource !== null ||
    binding.table !== null ||
    binding.column !== null ||
    binding.row !== null
  );
}

function parseDataSourceBindingRecord(openTag: string, inner: string): PresetInputDataSourceBinding {
  return {
    fieldName: textOrAttr(inner, openTag, FIELD_NAME_KEYS),
    instanceId: textOrAttr(inner, openTag, INSTANCE_ID_KEYS),
    dataSource: textOrAttr(inner, openTag, DATA_SOURCE_NAME_KEYS),
    table: textOrAttr(inner, openTag, TABLE_KEYS),
    column: textOrAttr(inner, openTag, COLUMN_KEYS),
    row: intOrNull(textOrAttr(inner, openTag, ROW_KEYS) ?? ''),
    rawValues: collectKnownValues(inner, [...DATA_SOURCE_VALUE_TAGS]),
  };
}

function mergeDataSourceBindings(
  parent: PresetInputDataSourceBinding,
  child: PresetInputDataSourceBinding
): PresetInputDataSourceBinding {
  return {
    fieldName: parent.fieldName ?? child.fieldName,
    instanceId: child.instanceId ?? parent.instanceId,
    dataSource: child.dataSource ?? parent.dataSource,
    table: child.table ?? parent.table,
    column: child.column ?? parent.column,
    row: child.row ?? parent.row,
    rawValues: {
      ...parent.rawValues,
      ...child.rawValues,
    },
  };
}

function sameNullableValue<T>(left: T | null, right: T | null): boolean {
  return left === null || right === null || left === right;
}

function isSubsumedBinding(
  candidate: PresetInputDataSourceBinding,
  existing: PresetInputDataSourceBinding
): boolean {
  const comparable =
    sameNullableValue(candidate.fieldName, existing.fieldName) &&
    sameNullableValue(candidate.instanceId, existing.instanceId) &&
    sameNullableValue(candidate.dataSource, existing.dataSource) &&
    sameNullableValue(candidate.table, existing.table) &&
    sameNullableValue(candidate.column, existing.column) &&
    sameNullableValue(candidate.row, existing.row);
  if (!comparable) return false;

  const candidateKnown = [
    candidate.fieldName,
    candidate.instanceId,
    candidate.dataSource,
    candidate.table,
    candidate.column,
    candidate.row,
  ].filter((value) => value !== null).length;
  const existingKnown = [
    existing.fieldName,
    existing.instanceId,
    existing.dataSource,
    existing.table,
    existing.column,
    existing.row,
  ].filter((value) => value !== null).length;

  return existingKnown > candidateKnown;
}

function parseTitleDataSourceBindings(xml: string): PresetInputDataSourceBinding[] {
  const bindings: PresetInputDataSourceBinding[] = [];
  const recordNames = [
    'DataSourceMapping',
    'DataSourceBinding',
    'TitleDataSource',
    'DataSourceMapper',
    'DataSourceMap',
    'Mapping',
    'Item',
  ];
  const seen = new Set<string>();
  const addBinding = (binding: PresetInputDataSourceBinding) => {
    if (!isDataSourceBinding(binding)) return;
    if (bindings.some((existing) => isSubsumedBinding(binding, existing))) return;

    for (let i = bindings.length - 1; i >= 0; i--) {
      if (isSubsumedBinding(bindings[i]!, binding)) {
        bindings.splice(i, 1);
      }
    }

    const key = [
      binding.fieldName,
      binding.instanceId,
      binding.dataSource,
      binding.table,
      binding.column,
      binding.row,
    ].join('|');
    if (!seen.has(key)) {
      seen.add(key);
      bindings.push(binding);
    }
  };

  for (const { openTag, inner } of scanElements(xml, 'DataSource', { caseInsensitive: true })) {
    const parent = parseDataSourceBindingRecord(openTag, inner);
    let mapperCount = 0;
    for (const mapper of scanElements(inner, 'Mapper', { caseInsensitive: true })) {
      mapperCount++;
      addBinding(mergeDataSourceBindings(parent, parseDataSourceBindingRecord(mapper.openTag, mapper.inner)));
    }
    if (mapperCount === 0) addBinding(parent);
  }

  for (const { openTag, inner } of scanElements(xml, recordNames, { caseInsensitive: true })) {
    addBinding(parseDataSourceBindingRecord(openTag, inner));
  }

  for (const name of uniqueElementNames(xml)) {
    for (const openTag of scanOpenTags(xml, name)) {
      addBinding(parseDataSourceBindingRecord(openTag, ''));
    }
  }

  return bindings;
}

function uniqueElementNames(xml: string): string[] {
  const names = new Set<string>();
  for (const match of xml.matchAll(/<([A-Za-z_][\w.-]*)\b/g)) {
    const name = match[1];
    if (name) names.add(name);
  }
  return [...names];
}

function parseTitleMetadata(openTag: string): PresetInputTitleMetadata | null {
  const countdownXml = attrValue(openTag, 'CountdownXML');
  const dataSourcesXml = attrValue(openTag, 'DataSourcesXML');
  const hasCountdownXml = countdownXml !== null && countdownXml.trim().length > 0;
  const hasDataSourcesXml = dataSourcesXml !== null && dataSourcesXml.trim().length > 0;

  if (!hasCountdownXml && !hasDataSourcesXml) return null;

  return {
    hasCountdownXml,
    hasDataSourcesXml,
    countdownSettings: hasCountdownXml ? parseCountdownSettings(countdownXml ?? '') : [],
    dataSourceBindings: hasDataSourcesXml ? parseTitleDataSourceBindings(dataSourcesXml ?? '') : [],
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
      titleMetadata: parseTitleMetadata(openTag),
    });
  }
  return inputs;
}

function parseDataSources(xml: string): PresetDataSource[] {
  const scope = getSection(xml, SCHEMA.dataSourcesContainer);
  const sources: PresetDataSource[] = [];
  for (const { openTag, inner } of elements(scope, SCHEMA.dataSourceElement)) {
    let instanceOpenTag = '';
    let instance = '';
    for (const element of scanElements(inner, SCHEMA.dataSourceInstanceElement)) {
      instanceOpenTag = element.openTag;
      instance = element.inner;
      break;
    }
    const tables: PresetDataSourceTable[] = [];
    for (const t of elements(getSection(instance, 'tables'), SCHEMA.dataSourceTableElement)) {
      tables.push({ name: attrValue(t.openTag, 'name') ?? '', index: intOrNull(attrValue(t.openTag, 'index') ?? '') });
    }
    sources.push({
      id: attrValue(instanceOpenTag, 'id'),
      provider: attrValue(openTag, SCHEMA.dataSourceProviderAttr) ?? '',
      title: attrValue(instanceOpenTag, 'title'),
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

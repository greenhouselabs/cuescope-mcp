/**
 * vMix XML state parser
 * Uses regex-based parsing for performance (no external XML library)
 */

import type {
  VmixState,
  VmixInput,
  VmixAudioState,
  AudioChannel,
  InputState,
  VmixLayer,
  VmixMixState,
} from './types.js';
import { VmixError } from '../errors/index.js';
import { createInputLookup, getInputLookup } from './input-lookup.js';
import { createAudioRouting, createOverlayChannels, parseAudioBusList } from './normalized-topology.js';
import { createStateRelationships } from './relationships.js';
import { decodeEntities, scanElements } from './preset/xml-decode.js';
import { isGuid, normalizeInputKey } from '../utils/input-normalizer.js';

/**
 * Parse vMix XML state to a typed object
 * @param xml Raw XML from vMix API
 * @returns Parsed VmixState object
 */
export function parseVmixState(xml: string): VmixState {
  try {
    const inputs = parseInputs(xml);
    const overlays = parseOverlays(xml);
    const mixes = parseMixes(xml);
    const audio = parseAudio(xml);
    const state: VmixState = {
      version: getValue(xml, 'version'),
      edition: getValue(xml, 'edition'),
      active: getNum(xml, 'active'),
      preview: getNum(xml, 'preview'),
      fadeToBlack: getBool(xml, 'fadeToBlack'),
      recording: getBool(xml, 'recording'),
      recordingDuration: parseRecordingDuration(xml),
      streaming: getBool(xml, 'streaming'),
      external: getBool(xml, 'external'),
      inputs,
      inputLookup: createInputLookup(inputs),
      overlays,
      overlayChannels: createOverlayChannels(overlays, inputs),
      mixes,
      audio,
      audioRouting: createAudioRouting(inputs, audio),
    };

    state.relationships = createStateRelationships(state);
    return state;
  } catch (error) {
    throw new VmixError(
      `Failed to parse vMix state: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'STATE_PARSE_ERROR'
    );
  }
}

/**
 * Get simple text value from XML tag.
 * Allows attributes on the tag — live vMix emits e.g.
 * `<recording duration="...">True</recording>` while recording is active.
 * Text content is entity-decoded.
 */
function getValue(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}\\b[^>]*>([^<]*)</${tag}>`));
  return match?.[1] !== undefined ? decodeEntities(match[1]) : '';
}

/**
 * Get numeric value from XML tag
 */
function getNum(xml: string, tag: string): number {
  const value = getValue(xml, tag);
  const num = parseInt(value, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Get boolean value from XML tag
 */
function getBool(xml: string, tag: string): boolean {
  return getValue(xml, tag).toLowerCase() === 'true';
}

/**
 * Get attribute value from XML
 */
function getAttr(xml: string, pattern: string | RegExp): string {
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
  const match = xml.match(regex);
  return match?.[1] ?? '';
}

type AttrMap = Record<string, string>;

/**
 * Parse an element's raw attribute string into a name->value map in a single
 * pass. Names are lowercased so lookups stay case-insensitive. This replaces
 * compiling a fresh RegExp per attribute per element (hot on every input/layer).
 * Values are entity-decoded so a title attribute of `Q&amp;A` surfaces as `Q&A`.
 */
function parseAttrs(attrs: string): AttrMap {
  const map: AttrMap = {};
  const attrRegex = /([\w-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(attrs)) !== null) {
    map[match[1]!.toLowerCase()] = decodeEntities(match[2]!);
  }
  return map;
}

/**
 * Get a parsed attribute by one or more possible names (case-insensitive)
 */
function lookupAttr(map: AttrMap, names: string | string[]): string {
  const candidates = Array.isArray(names) ? names : [names];

  for (const name of candidates) {
    const value = map[name.toLowerCase()];
    if (value !== undefined) {
      return value;
    }
  }

  return '';
}

/**
 * Check whether an attribute is present, even when its value is empty
 */
function hasAttr(map: AttrMap, names: string | string[]): boolean {
  const candidates = Array.isArray(names) ? names : [names];

  return candidates.some((name) => map[name.toLowerCase()] !== undefined);
}

/**
 * Parse an optional integer attribute value
 */
function parseOptionalInt(value: string): number | null {
  if (value.trim() === '') return null;
  const num = parseInt(value, 10);
  return Number.isNaN(num) ? null : num;
}

/**
 * Parse an optional floating-point attribute value
 */
function parseOptionalFloat(value: string): number | null {
  if (value.trim() === '') return null;
  const num = parseFloat(value);
  return Number.isNaN(num) ? null : num;
}

/**
 * Parse a floating-point attribute with default, preserving valid zero values
 */
function parseFloatWithDefault(value: string | undefined, defaultValue: number): number {
  const num = parseFloat(value ?? String(defaultValue));
  return Number.isNaN(num) ? defaultValue : num;
}

/**
 * Parse recording duration from XML
 */
function parseRecordingDuration(xml: string): number {
  if (!getBool(xml, 'recording')) return 0;
  const duration = getAttr(xml, /<recording[^>]*duration="([^"]*)"/);
  const num = parseInt(duration, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse all inputs from XML.
 * Uses the quote-aware element scanner so a legal raw '>' inside an attribute
 * value (e.g. title="Cam 1 -> Wide") does not truncate the open tag.
 */
function parseInputs(xml: string): VmixInput[] {
  const inputs: VmixInput[] = [];

  for (const element of scanElements(xml, 'input', { caseInsensitive: true })) {
    const input = parseInput(element.attrs, element.inner);
    if (input) {
      inputs.push(input);
    }
  }

  return inputs;
}

const KNOWN_INPUT_STATES = new Set<string>(['Running', 'Paused', 'Completed', '']);

/**
 * Validate a raw state attribute against the known vMix input states.
 * Unknown values fall back to '' instead of being cast blindly.
 */
function parseInputState(value: string): InputState {
  return KNOWN_INPUT_STATES.has(value) ? (value as InputState) : '';
}

/**
 * Parse a single input from its attributes and content
 */
function parseInput(attrs: string, content: string): VmixInput | null {
  const attrMap = parseAttrs(attrs);
  const getInputAttr = (name: string | string[]): string => lookupAttr(attrMap, name);
  const hasInputAttr = (name: string | string[]): boolean => hasAttr(attrMap, name);

  const number = parseInt(getInputAttr('number'), 10);
  if (isNaN(number)) return null;

  const fields: Record<string, string> = {
    ...parseFieldElements(content, 'text'),
    ...parseFieldElements(content, 'image'),
  };

  const audioBuses = hasInputAttr('audiobusses') ? getInputAttr('audiobusses') : 'M';

  return {
    key: getInputAttr('key'),
    number,
    type: getInputAttr('type'),
    title: getInputAttr('title'),
    state: parseInputState(getInputAttr('state')),
    position: parseInt(getInputAttr('position'), 10) || 0,
    duration: parseInt(getInputAttr('duration'), 10) || 0,
    muted: getInputAttr('muted').toLowerCase() === 'true',
    loop: getInputAttr('loop').toLowerCase() === 'true',
    selectedIndex: parseOptionalInt(getInputAttr(['selectedIndex', 'selectedindex'])),
    audioBuses,
    audioBusList: parseAudioBusList(audioBuses),
    meters: {
      f1: parseOptionalFloat(getInputAttr(['meterF1', 'meterf1'])),
      f2: parseOptionalFloat(getInputAttr(['meterF2', 'meterf2'])),
    },
    fields: Object.keys(fields).length > 0 ? fields : undefined,
    layers: parseLayers(content),
  };
}

/**
 * Parse title/image fields from nested input XML.
 * vMix does not guarantee attribute order, so read the whole attribute string.
 * Field text content is entity-decoded.
 */
function parseFieldElements(content: string, tagName: 'text' | 'image'): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const element of scanElements(content, tagName, { caseInsensitive: true })) {
    const fieldName = lookupAttr(parseAttrs(element.attrs), 'name');
    if (fieldName.length === 0) continue;

    fields[fieldName] = decodeEntities(element.inner);
  }

  return fields;
}

/**
 * Parse layer/overlay references nested inside an input
 */
function parseLayers(content: string): VmixLayer[] {
  const layers: VmixLayer[] = [];

  for (const element of scanElements(content, ['layer', 'overlay'], { caseInsensitive: true })) {
    layers.push(parseLayer(element.attrs, layers.length + 1));
  }

  return layers;
}

/**
 * Parse a nested layer/overlay attribute set
 */
function parseLayer(attrs: string, fallbackIndex: number): VmixLayer {
  const attrMap = parseAttrs(attrs);
  const index = parseOptionalInt(lookupAttr(attrMap, ['index', 'number'])) ?? fallbackIndex;
  const layer: VmixLayer = { index };

  const input = parseOptionalInt(lookupAttr(attrMap, 'input'));
  if (input !== null) layer.input = input;

  const key = lookupAttr(attrMap, 'key');
  if (key !== '') layer.key = key;

  const title = lookupAttr(attrMap, 'title');
  if (title !== '') layer.title = title;

  setOptionalLayerNumber(layer, 'panX', lookupAttr(attrMap, ['panX', 'panx']));
  setOptionalLayerNumber(layer, 'panY', lookupAttr(attrMap, ['panY', 'pany']));
  setOptionalLayerNumber(layer, 'zoom', lookupAttr(attrMap, 'zoom'));
  setOptionalLayerNumber(layer, 'width', lookupAttr(attrMap, 'width'));
  setOptionalLayerNumber(layer, 'height', lookupAttr(attrMap, 'height'));
  setOptionalLayerNumber(layer, 'cropX1', lookupAttr(attrMap, ['cropX1', 'cropx1']));
  setOptionalLayerNumber(layer, 'cropY1', lookupAttr(attrMap, ['cropY1', 'cropy1']));
  setOptionalLayerNumber(layer, 'cropX2', lookupAttr(attrMap, ['cropX2', 'cropx2']));
  setOptionalLayerNumber(layer, 'cropY2', lookupAttr(attrMap, ['cropY2', 'cropy2']));

  return layer;
}

function setOptionalLayerNumber(layer: VmixLayer, key: keyof VmixLayer, value: string): void {
  const num = parseOptionalFloat(value);
  if (num !== null) {
    Object.assign(layer, { [key]: num });
  }
}

/**
 * Parse overlay channels from XML
 */
function parseOverlays(xml: string): (number | null)[] {
  const overlays: (number | null)[] = [];
  const overlaysXml = xml.match(/<overlays>([\s\S]*?)<\/overlays>/i)?.[1] ?? '';

  for (let i = 1; i <= 4; i++) {
    const match = overlaysXml.match(new RegExp(`<overlay\\s+[^>]*number="${i}"[^>]*(?:/>|>([^<]*)</overlay>)`));
    if (match?.[1]) {
      const num = parseInt(match[1], 10);
      overlays.push(isNaN(num) ? null : num);
    } else {
      overlays.push(null);
    }
  }

  return overlays;
}

/**
 * Parse vMix mixes from XML when available
 */
function parseMixes(xml: string): VmixMixState[] {
  const mixes: VmixMixState[] = [];
  const mixesXml = xml.match(/<mixes>([\s\S]*?)<\/mixes>/i)?.[1] ?? '';
  const mixRegex = /<mix\s+([^>]*?)>([\s\S]*?)<\/mix>/gi;

  let match;
  while ((match = mixRegex.exec(mixesXml)) !== null) {
    const attrs = match[1] ?? '';
    const content = match[2] ?? '';
    const number = parseInt(lookupAttr(parseAttrs(attrs), 'number'), 10);
    if (Number.isNaN(number)) continue;

    mixes.push({
      number,
      active: getNum(content, 'active'),
      preview: getNum(content, 'preview'),
    });
  }

  return mixes;
}

/**
 * Parse audio state from XML.
 * Attributes are read via parseAttrs so volume/muted may appear in any order
 * (the previous regexes silently failed when muted preceded volume).
 */
function parseAudio(xml: string): VmixAudioState {
  const audio: VmixAudioState = {
    master: { volume: 100, muted: false },
    // Track whether <master> was actually present so bus M does not report
    // parsed:true when the element was missing and defaults were assumed.
    masterParsed: false,
  };

  const master = parseAudioChannel(xml, 'master');
  if (master) {
    audio.master = master;
    audio.masterParsed = true;
  }

  // Parse buses A-G
  const buses = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
  for (const bus of buses) {
    const channel = parseAudioChannel(xml, `bus${bus.toLowerCase()}`);
    if (channel) {
      audio[`bus${bus}`] = channel;
    }
  }

  return audio;
}

/**
 * Parse a single audio output element (master or busa..busg), order-independent.
 * Returns null when the element is absent.
 */
function parseAudioChannel(xml: string, tagName: string): AudioChannel | null {
  for (const element of scanElements(xml, tagName, { caseInsensitive: true })) {
    const attrs = parseAttrs(element.attrs);
    const volume = lookupAttr(attrs, 'volume');
    return {
      volume: parseFloatWithDefault(volume === '' ? undefined : volume, 100),
      muted: lookupAttr(attrs, 'muted').toLowerCase() === 'true',
    };
  }

  return null;
}

/**
 * Find an input by name, number, or GUID
 */
export function findInput(
  state: VmixState,
  reference: string | number
): VmixInput | undefined {
  const lookup = getInputLookup(state);

  if (typeof reference === 'number') {
    return lookup.byNumber[String(reference)] ?? state.inputs.find((i) => i.number === reference);
  }

  const trimmed = reference.trim();

  // Check if it's a number string
  if (/^\d+$/.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    return lookup.byNumber[String(num)] ?? state.inputs.find((i) => i.number === num);
  }

  // Check if it's a GUID (vMix emits unbraced keys; braced references are equivalent)
  if (isGuid(trimmed)) {
    const normalizedKey = normalizeInputKey(trimmed);
    return (
      lookup.byKey[normalizedKey] ??
      state.inputs.find((i) => normalizeInputKey(i.key) === normalizedKey)
    );
  }

  // Search by name (case-sensitive)
  const byTitle = lookup.byExactTitle[trimmed]?.[0] ?? state.inputs.find((i) => i.title === trimmed);
  if (byTitle) return byTitle;

  // Last resort: non-GUID-shaped stable keys (some sources use opaque key strings)
  return lookup.byKey[normalizeInputKey(trimmed)];
}

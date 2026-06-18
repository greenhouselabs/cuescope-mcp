/**
 * Shared helpers for Review Mode tools
 */

import type { AudioBusName, VmixInput, VmixState } from '../../state/types.js';
import { getInputLookup } from '../../state/input-lookup.js';
import { inferInputRole, INPUT_ROLES, type InputRole } from '../../state/input-roles.js';
import { AUDIO_BUS_NAMES, parseAudioBusList } from '../../state/normalized-topology.js';
import {
  inferProductionRoles,
  PRODUCTION_ROLES,
  type ProductionRole,
  type ProductionRoleAnalysis,
} from './production-roles.js';

export { INPUT_ROLES, type InputRole };
export { AUDIO_BUS_NAMES, type AudioBusName };
export { PRODUCTION_ROLES, type ProductionRole, type ProductionRoleAnalysis };

export interface InputAnalysis {
  key: string;
  number: number;
  title: string;
  type: string;
  role: InputRole;
  productionRole: ProductionRoleAnalysis;
  state: string;
  stableReference: string;
  audioBuses: string[];
  muted: boolean;
  durationMs: number;
  positionMs: number;
  selectedIndex: number | null;
  meters: {
    f1: number | null;
    f2: number | null;
  };
  fieldNames: string[];
  layerCount: number;
  layers: InputLayerAnalysis[];
}

export interface InputLayerAnalysis {
  index: number;
  input?: number;
  key?: string;
  title?: string;
  panX?: number;
  panY?: number;
  zoom?: number;
}

export function findInputByNumber(state: VmixState, number: number): VmixInput | null {
  const lookup = getInputLookup(state);
  return lookup.byNumber[String(number)] ?? state.inputs.find((input) => input.number === number) ?? null;
}

export function parseAudioBuses(audioBuses: string): string[] {
  return parseAudioBusList(audioBuses);
}

export function inferRole(input: VmixInput): InputRole {
  return inferInputRole(input);
}

export function isLikelyAudioSource(role: InputRole): boolean {
  return ['camera', 'remoteGuest', 'audioOnly', 'mediaPlayback', 'browser'].includes(role);
}

export function isLikelyOfflinePlaceholder(input: { title: string; type: string }): boolean {
  const title = input.title.toLowerCase();
  const type = input.type.toLowerCase();

  return (
    /\b(offline|placeholder|slate|standby|holding)\b/.test(title) ||
    (type === 'colour' && /\b(gfx|graphic|slate|offline)\b/.test(title))
  );
}

// analyzeInput is a pure function of the VmixInput object, and the same input
// is analyzed repeatedly per request (role grouping, audio buses, generators,
// nested paired-audio loops). Memoize per input object so the work runs once.
// VmixInput objects are recreated on every state parse, so a WeakMap keyed by
// identity stays correct across refreshes and lets stale entries be collected.
const analyzeInputCache = new WeakMap<VmixInput, InputAnalysis>();

export function analyzeInput(input: VmixInput): InputAnalysis {
  const cached = analyzeInputCache.get(input);
  if (cached) return cached;

  const analysis = computeInputAnalysis(input);
  analyzeInputCache.set(input, analysis);
  return analysis;
}

function computeInputAnalysis(input: VmixInput): InputAnalysis {
  return {
    key: input.key,
    number: input.number,
    title: input.title,
    type: input.type,
    role: inferRole(input),
    productionRole: inferProductionRoles(input),
    state: input.state,
    stableReference: input.key || String(input.number),
    audioBuses: parseAudioBuses(input.audioBuses),
    muted: input.muted,
    durationMs: input.duration,
    positionMs: input.position,
    selectedIndex: input.selectedIndex ?? null,
    meters: {
      f1: input.meters?.f1 ?? null,
      f2: input.meters?.f2 ?? null,
    },
    fieldNames: Object.keys(input.fields ?? {}),
    layerCount: input.layers?.length ?? 0,
    layers: (input.layers ?? []).map(summarizeLayer),
  };
}

function summarizeLayer(layer: NonNullable<VmixInput['layers']>[number]): InputLayerAnalysis {
  const summary: InputLayerAnalysis = {
    index: layer.index,
  };

  if (layer.input !== undefined) summary.input = layer.input;
  if (layer.key !== undefined) summary.key = layer.key;
  if (layer.title !== undefined) summary.title = layer.title;
  if (layer.panX !== undefined) summary.panX = layer.panX;
  if (layer.panY !== undefined) summary.panY = layer.panY;
  if (layer.zoom !== undefined) summary.zoom = layer.zoom;

  return summary;
}

export function groupByRole(inputs: InputAnalysis[]): Record<InputRole, InputAnalysis[]> {
  const groups: Record<InputRole, InputAnalysis[]> = {
    camera: [],
    remoteGuest: [],
    titleGraphic: [],
    imageGraphic: [],
    audioOnly: [],
    mediaPlayback: [],
    browser: [],
    virtualSet: [],
    utility: [],
    presentation: [],
    unknown: [],
  };

  for (const input of inputs) {
    groups[input.role].push(input);
  }

  return groups;
}

export function groupByProductionRole(
  inputs: InputAnalysis[]
): Record<ProductionRole, InputAnalysis[]> {
  const groups = createProductionRoleGroups();

  for (const input of inputs) {
    groups[input.productionRole.primary.role].push(input);
  }

  return groups;
}

export function countProductionRoles(inputs: InputAnalysis[]): Record<ProductionRole, number> {
  const counts = createProductionRoleCounts();

  for (const input of inputs) {
    counts[input.productionRole.primary.role] += 1;
  }

  return counts;
}

function createProductionRoleGroups(): Record<ProductionRole, InputAnalysis[]> {
  const groups = {} as Record<ProductionRole, InputAnalysis[]>;

  for (const role of PRODUCTION_ROLES) {
    groups[role] = [];
  }

  return groups;
}

function createProductionRoleCounts(): Record<ProductionRole, number> {
  const counts = {} as Record<ProductionRole, number>;

  for (const role of PRODUCTION_ROLES) {
    counts[role] = 0;
  }

  return counts;
}

export function buildAudioBusMap(inputs: InputAnalysis[]): Record<string, InputAnalysis[]> {
  const busMap: Record<string, InputAnalysis[]> = {
    unrouted: [],
  };

  for (const bus of AUDIO_BUS_NAMES) {
    busMap[bus] = [];
  }

  for (const input of inputs) {
    if (input.audioBuses.length === 0) {
      busMap['unrouted']?.push(input);
      continue;
    }

    for (const bus of input.audioBuses) {
      const busInputs = busMap[bus] ?? [];
      busInputs.push(input);
      busMap[bus] = busInputs;
    }
  }

  return busMap;
}

export function summarizeRequiredInput(input: InputAnalysis) {
  // Slim shape for inputs a generated artifact references: identity, audio,
  // timing, field names, and the *primary* production role + confidence. Drops
  // the heavy fields a host model does not need to act on a script/sequence:
  // per-frame meters, full layer detail (layerCount kept), and the
  // productionRole.matches[] candidate list.
  return {
    key: input.key,
    number: input.number,
    title: input.title,
    type: input.type,
    role: input.role,
    state: input.state,
    stableReference: input.stableReference,
    audioBuses: input.audioBuses,
    muted: input.muted,
    durationMs: input.durationMs,
    positionMs: input.positionMs,
    selectedIndex: input.selectedIndex,
    fieldNames: input.fieldNames,
    layerCount: input.layerCount,
    productionRole: { primary: input.productionRole.primary },
  };
}

export function summarizeInputs(inputs: InputAnalysis[]) {
  const groups = groupByRole(inputs);

  return {
    total: inputs.length,
    liveSources: groups.camera.length + groups.remoteGuest.length,
    cameras: groups.camera.length,
    remoteGuests: groups.remoteGuest.length,
    titleGraphics: groups.titleGraphic.length,
    imageGraphics: groups.imageGraphic.length,
    mediaPlayback: groups.mediaPlayback.length,
    audioOnly: groups.audioOnly.length,
    browsers: groups.browser.length,
    virtualSets: groups.virtualSet.length,
    productionRoles: countProductionRoles(inputs),
    unknown: groups.unknown.length,
  };
}

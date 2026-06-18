/**
 * Production-role inference for Review Mode analysis
 */

import type { VmixInput } from '../../state/types.js';
import { inferInputRole } from '../../state/input-roles.js';

export const PRODUCTION_ROLES = [
  'hostCamera',
  'guestCamera',
  'callInput',
  'lowerThird',
  'scorebug',
  'music',
  'introOutro',
  'replay',
  'virtualSet',
  'mixInput',
  'mediaPlayback',
  'audioSource',
  'graphic',
  'utility',
  'unknown',
] as const;

export type ProductionRole = (typeof PRODUCTION_ROLES)[number];

export interface ProductionRoleMatch {
  role: ProductionRole;
  confidence: number;
  evidence: string[];
}

export interface ProductionRoleAnalysis {
  primary: ProductionRoleMatch;
  matches: ProductionRoleMatch[];
}

interface InputSignals {
  type: string;
  title: string;
  fieldNames: string[];
  fieldText: string;
  fieldValueText: string;
}

const ROLE_PRIORITY = Object.fromEntries(
  PRODUCTION_ROLES.map((role, index) => [role, index])
) as Record<ProductionRole, number>;

function normalize(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, ' ').trim();
}

function hasAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function hasAnyField(fieldNames: string[], needles: string[]): boolean {
  return fieldNames.some((fieldName) => hasAny(fieldName, needles));
}

function collectSignals(input: VmixInput): InputSignals {
  const fieldNames = Object.keys(input.fields ?? {}).map(normalize);
  const fieldValues = Object.values(input.fields ?? {}).map((value) => normalize(String(value)));

  return {
    type: normalize(input.type),
    title: normalize(input.title),
    fieldNames,
    fieldText: fieldNames.join(' '),
    fieldValueText: fieldValues.join(' '),
  };
}

function addMatch(
  matches: Map<ProductionRole, ProductionRoleMatch>,
  role: ProductionRole,
  confidence: number,
  evidence: string[]
): void {
  const existing = matches.get(role);
  const normalizedConfidence = Number(Math.min(1, Math.max(0, confidence)).toFixed(2));

  if (!existing) {
    matches.set(role, {
      role,
      confidence: normalizedConfidence,
      evidence: [...new Set(evidence)].slice(0, 5),
    });
    return;
  }

  existing.confidence = Math.max(existing.confidence, normalizedConfidence);
  for (const item of evidence) {
    if (!existing.evidence.includes(item) && existing.evidence.length < 5) {
      existing.evidence.push(item);
    }
  }
}

function addCameraMatches(
  input: VmixInput,
  signals: InputSignals,
  matches: Map<ProductionRole, ProductionRoleMatch>
): void {
  const broadRole = inferInputRole(input);
  const cameraType = hasAny(signals.type, ['capture', 'camera', 'webcam', 'ndi']);
  const hostTitle = hasAny(signals.title, ['host', 'anchor', 'presenter', 'main camera', 'cam 1']);
  const guestTitle = hasAny(signals.title, ['guest', 'caller', 'remote', 'interview']);
  const broadRoleCanBeCamera = broadRole === 'camera' || broadRole === 'remoteGuest';

  if (hasAny(signals.type, ['vmixcall', 'call'])) {
    addMatch(matches, 'callInput', 0.98, ['type indicates a vMix Call or call input']);
  }

  if (hasAny(signals.title, ['call', 'caller']) && broadRole === 'remoteGuest') {
    addMatch(matches, 'callInput', 0.9, ['title and broad role indicate a caller input']);
  }

  if (guestTitle && broadRoleCanBeCamera && (cameraType || broadRole === 'remoteGuest')) {
    addMatch(matches, 'guestCamera', broadRole === 'remoteGuest' ? 0.88 : 0.82, [
      'title indicates a guest or remote source',
    ]);
  }

  if (hostTitle && broadRoleCanBeCamera && (cameraType || broadRole === 'camera')) {
    addMatch(matches, 'hostCamera', 0.92, ['title indicates a host/presenter camera']);
    return;
  }

  if (broadRole === 'camera') {
    addMatch(matches, 'hostCamera', 0.58, ['input type is camera-like']);
  }
}

function addGraphicMatches(
  input: VmixInput,
  signals: InputSignals,
  matches: Map<ProductionRole, ProductionRoleMatch>
): void {
  const broadRole = inferInputRole(input);
  const titleAndFields = `${signals.title} ${signals.fieldText} ${signals.fieldValueText}`;
  const isGraphic = broadRole === 'titleGraphic' || broadRole === 'imageGraphic';
  const hasNameAndTitleFields =
    hasAnyField(signals.fieldNames, ['name']) &&
    hasAnyField(signals.fieldNames, ['title', 'role', 'company', 'subtitle']);
  const hasScoreFields =
    hasAnyField(signals.fieldNames, ['score']) ||
    (hasAnyField(signals.fieldNames, ['home']) && hasAnyField(signals.fieldNames, ['away']));
  const hasClockFields = hasAnyField(signals.fieldNames, ['clock', 'timer', 'period', 'quarter']);

  if (hasAny(titleAndFields, ['lower third', 'lowerthird', 'name strap', 'namestrap'])) {
    addMatch(matches, 'lowerThird', 0.96, ['title or fields indicate a lower third']);
  } else if (isGraphic && hasNameAndTitleFields) {
    addMatch(matches, 'lowerThird', 0.9, ['fields include name/title style lower-third data']);
  }

  if (hasAny(titleAndFields, ['scorebug', 'score board', 'scoreboard'])) {
    addMatch(matches, 'scorebug', 0.96, ['title or fields indicate a scorebug']);
  } else if (isGraphic && hasScoreFields && hasClockFields) {
    addMatch(matches, 'scorebug', 0.9, ['fields include score and clock/period data']);
  } else if (isGraphic && hasScoreFields) {
    addMatch(matches, 'scorebug', 0.82, ['fields include score/team data']);
  }

  if (isGraphic) {
    addMatch(matches, 'graphic', broadRole === 'titleGraphic' ? 0.72 : 0.68, [
      `broad role is ${broadRole}`,
    ]);
  }
}

function addMediaMatches(
  input: VmixInput,
  signals: InputSignals,
  matches: Map<ProductionRole, ProductionRoleMatch>
): void {
  const broadRole = inferInputRole(input);
  const isMediaLike = broadRole === 'mediaPlayback' || input.duration > 0;

  if (hasAny(signals.title, ['replay', 'highlight', 'recap'])) {
    addMatch(matches, 'replay', 0.94, ['title indicates replay or highlights']);
  }

  if (hasAny(signals.type, ['replay'])) {
    addMatch(matches, 'replay', 0.94, ['type indicates replay']);
  }

  if (
    hasAny(signals.title, [
      'intro',
      'outro',
      'open',
      'opener',
      'close',
      'closing',
      'bumper',
      'stinger',
      'slate',
    ])
  ) {
    addMatch(matches, 'introOutro', isMediaLike ? 0.94 : 0.82, [
      'title indicates intro/outro or show packaging media',
    ]);
  }

  if (isMediaLike) {
    addMatch(matches, 'mediaPlayback', input.duration > 0 ? 0.74 : 0.68, [
      input.duration > 0 ? 'input has playback duration' : 'broad role is media playback',
    ]);
  }
}

function addAudioAndUtilityMatches(
  input: VmixInput,
  signals: InputSignals,
  matches: Map<ProductionRole, ProductionRoleMatch>
): void {
  const broadRole = inferInputRole(input);
  const titleAndType = `${signals.title} ${signals.type}`;

  if (hasAny(titleAndType, ['music', 'bed', 'theme', 'walk on', 'walkup', 'soundtrack'])) {
    addMatch(matches, 'music', 0.92, ['title or type indicates music/audio bed']);
  }

  if (broadRole === 'audioOnly') {
    addMatch(matches, 'audioSource', 0.86, ['broad role is audio-only']);
  } else if (input.audioBuses.trim().length > 0 && broadRole !== 'titleGraphic') {
    addMatch(matches, 'audioSource', 0.54, ['input is routed to one or more audio buses']);
  }

  if (hasAny(signals.type, ['virtualset', 'virtual set', 'virtual'])) {
    addMatch(matches, 'virtualSet', 0.98, ['type indicates a virtual set']);
  } else if (hasAny(signals.title, ['virtual set', 'virtual studio'])) {
    addMatch(matches, 'virtualSet', 0.9, ['title indicates a virtual set']);
  }

  if (
    signals.type === 'mix' ||
    hasAny(signals.title, ['mix input', 'clean feed', 'program feed', 'iso feed'])
  ) {
    addMatch(matches, 'mixInput', signals.type === 'mix' ? 0.96 : 0.86, [
      signals.type === 'mix' ? 'type is Mix' : 'title indicates a production feed/mix',
    ]);
  }

  if (broadRole === 'utility') {
    addMatch(matches, 'utility', 0.8, ['broad role is utility']);
  }
}

export function inferProductionRoles(input: VmixInput): ProductionRoleAnalysis {
  const signals = collectSignals(input);
  const matches = new Map<ProductionRole, ProductionRoleMatch>();

  addCameraMatches(input, signals, matches);
  addGraphicMatches(input, signals, matches);
  addMediaMatches(input, signals, matches);
  addAudioAndUtilityMatches(input, signals, matches);

  const sortedMatches = [...matches.values()].sort((left, right) => {
    if (right.confidence !== left.confidence) return right.confidence - left.confidence;
    return ROLE_PRIORITY[left.role] - ROLE_PRIORITY[right.role];
  });

  if (sortedMatches.length === 0) {
    sortedMatches.push({
      role: 'unknown',
      confidence: 0.2,
      evidence: ['no strong type, title, field, or routing signal matched'],
    });
  }

  return {
    primary: sortedMatches[0]!,
    matches: sortedMatches,
  };
}

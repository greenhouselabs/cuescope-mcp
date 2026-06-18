/**
 * Normalized input lookup maps for parsed vMix state
 */

import type { VmixInput, VmixInputLookupMaps, VmixState } from './types.js';
import { INPUT_ROLES, inferInputRole, type InputRole } from './input-roles.js';
import { normalizeInputKey } from '../utils/input-normalizer.js';

function emptyRoleMap(): Record<InputRole, VmixInput[]> {
  const map = {} as Record<InputRole, VmixInput[]>;
  for (const role of INPUT_ROLES) {
    map[role] = [];
  }
  return map;
}

function appendInput(map: Record<string, VmixInput[]>, key: string, input: VmixInput): void {
  const existing = map[key] ?? [];
  existing.push(input);
  map[key] = existing;
}

export function createInputLookup(inputs: VmixInput[]): VmixInputLookupMaps {
  const lookup: VmixInputLookupMaps = {
    byKey: {},
    byNumber: {},
    byExactTitle: {},
    byType: {},
    byRole: emptyRoleMap(),
  };

  for (const input of inputs) {
    if (input.key !== '') {
      // Keys are stored normalized (braces stripped, lower-cased) so braced and
      // unbraced GUID references resolve identically. Real vMix emits unbraced keys.
      lookup.byKey[normalizeInputKey(input.key)] = input;
    }

    lookup.byNumber[String(input.number)] = input;

    if (input.title !== '') {
      appendInput(lookup.byExactTitle, input.title, input);
    }

    if (input.type !== '') {
      appendInput(lookup.byType, input.type.toLowerCase(), input);
    }

    lookup.byRole[inferInputRole(input)].push(input);
  }

  return lookup;
}

export function getInputLookup(state: VmixState): VmixInputLookupMaps {
  return state.inputLookup ?? createInputLookup(state.inputs);
}

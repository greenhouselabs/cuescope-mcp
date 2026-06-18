/**
 * Relationship helpers for normalized vMix state
 */

import type {
  AudioBusName,
  VmixAudioRouting,
  VmixBusRelationship,
  VmixInput,
  VmixInputSummary,
  VmixInputUsage,
  VmixMixRelationship,
  VmixOverlayChannel,
  VmixOverlayRelationship,
  VmixState,
  VmixStateRelationships,
  VmixTitleFieldRelationship,
} from './types.js';
import { getInputLookup } from './input-lookup.js';
import { inferInputRole } from './input-roles.js';
import {
  AUDIO_BUS_NAMES,
  createAudioRouting,
  createOverlayChannels,
  parseAudioBusList,
} from './normalized-topology.js';

export function summarizeInput(input: VmixInput): VmixInputSummary {
  return {
    number: input.number,
    key: input.key,
    title: input.title,
    type: input.type,
    role: inferInputRole(input),
  };
}

export function getActiveInput(state: VmixState): VmixInput | null {
  if (state.active <= 0) return null;
  return getInputLookup(state).byNumber[String(state.active)] ?? null;
}

export function getPreviewInput(state: VmixState): VmixInput | null {
  if (state.preview <= 0) return null;
  return getInputLookup(state).byNumber[String(state.preview)] ?? null;
}

export function getOverlayInputRelationships(state: VmixState): VmixOverlayRelationship[] {
  const overlayChannels = getOverlayChannels(state);
  const lookup = getInputLookup(state);

  return overlayChannels.map((overlay) => {
    const input = overlay.inputNumber !== null ? lookup.byNumber[String(overlay.inputNumber)] : undefined;

    return {
      channel: overlay.channel,
      inputNumber: overlay.inputNumber,
      input: input ? summarizeInput(input) : null,
      active: overlay.active,
    };
  });
}

export function getMixRelationships(state: VmixState): VmixMixRelationship[] {
  const lookup = getInputLookup(state);

  return (state.mixes ?? []).map((mix) => {
    const activeInput = mix.active > 0 ? lookup.byNumber[String(mix.active)] : undefined;
    const previewInput = mix.preview > 0 ? lookup.byNumber[String(mix.preview)] : undefined;

    return {
      number: mix.number,
      activeInputNumber: mix.active,
      activeInput: activeInput ? summarizeInput(activeInput) : null,
      previewInputNumber: mix.preview,
      previewInput: previewInput ? summarizeInput(previewInput) : null,
    };
  });
}

export function getBusInputRelationships(state: VmixState): Record<AudioBusName, VmixBusRelationship> {
  const routing = getAudioRouting(state);
  const relationships = {} as Record<AudioBusName, VmixBusRelationship>;

  for (const bus of AUDIO_BUS_NAMES) {
    relationships[bus] = {
      bus,
      output: routing.buses[bus].output,
      inputs: routing.buses[bus].inputs.map((input) => ({
        number: input.number,
        key: input.key,
        title: input.title,
        type: input.type,
        role: inferInputRoleForRoutingInput(state, input.number),
      })),
    };
  }

  return relationships;
}

export function getTitleFieldRelationships(state: VmixState): VmixTitleFieldRelationship[] {
  return state.inputs
    .filter((input) => Object.keys(input.fields ?? {}).length > 0)
    .map((input) => ({
      input: summarizeInput(input),
      fieldNames: Object.keys(input.fields ?? {}),
      fields: input.fields ?? {},
    }));
}

export function getInputUsages(state: VmixState): VmixInputUsage[] {
  const overlayChannels = getOverlayChannels(state);

  return state.inputs.map((input) => {
    const audioBuses = input.audioBusList ?? parseAudioBusList(input.audioBuses);
    const fieldNames = Object.keys(input.fields ?? {});
    const inputOverlayChannels = overlayChannels
      .filter((overlay) => overlay.inputNumber === input.number)
      .map((overlay) => overlay.channel);
    const usage: VmixInputUsage = {
      input: summarizeInput(input),
      program: state.active === input.number,
      preview: state.preview === input.number,
      overlayChannels: inputOverlayChannels,
      audioBuses,
      hasFields: fieldNames.length > 0,
      fieldNames,
      layerCount: input.layers?.length ?? 0,
      likelyUsage: [],
    };

    usage.likelyUsage = buildLikelyUsage(input, usage);

    return usage;
  });
}

export function createStateRelationships(state: VmixState): VmixStateRelationships {
  const activeInput = getActiveInput(state);
  const previewInput = getPreviewInput(state);

  return {
    activeInput: activeInput ? summarizeInput(activeInput) : null,
    previewInput: previewInput ? summarizeInput(previewInput) : null,
    overlays: getOverlayInputRelationships(state),
    mixes: getMixRelationships(state),
    buses: getBusInputRelationships(state),
    titleInputs: getTitleFieldRelationships(state),
    inputUsages: getInputUsages(state),
  };
}

export function getStateRelationships(state: VmixState): VmixStateRelationships {
  return state.relationships ?? createStateRelationships(state);
}

function getOverlayChannels(state: VmixState): VmixOverlayChannel[] {
  return state.overlayChannels ?? createOverlayChannels(state.overlays, state.inputs);
}

function getAudioRouting(state: VmixState): VmixAudioRouting {
  return state.audioRouting ?? createAudioRouting(state.inputs, state.audio);
}

function inferInputRoleForRoutingInput(state: VmixState, number: number) {
  const input = getInputLookup(state).byNumber[String(number)];
  return input ? inferInputRole(input) : 'unknown';
}

function buildLikelyUsage(input: VmixInput, usage: Omit<VmixInputUsage, 'likelyUsage'>): string[] {
  const tags: string[] = [];
  const role = usage.input.role;

  if (usage.program) tags.push('program');
  if (usage.preview) tags.push('preview');
  if (usage.overlayChannels.length > 0) tags.push('overlay');
  if (usage.audioBuses.length > 0) tags.push('audio');
  if (usage.hasFields) tags.push('titleFields');
  if (usage.layerCount > 0) tags.push('layeredComposition');
  if (input.duration > 0) tags.push('playback');
  if (role !== 'unknown') tags.push(role);

  return Array.from(new Set(tags));
}

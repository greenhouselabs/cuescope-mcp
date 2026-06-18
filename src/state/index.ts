/**
 * State management module
 * @module state
 */

export type {
  VmixState,
  VmixInput,
  VmixInputLookupMaps,
  AudioBusName,
  VmixOverlayChannel,
  VmixAudioRouting,
  VmixAudioRoutingBus,
  VmixAudioRoutingInput,
  VmixAudioRoutingOutput,
  VmixInputSummary,
  VmixOverlayRelationship,
  VmixBusRelationship,
  VmixTitleFieldRelationship,
  VmixInputUsage,
  VmixStateRelationships,
  VmixAudioState,
  AudioChannel,
  InputState,
  IStateCache,
  IStateParser,
  StateCacheOptions,
} from './types.js';

export { parseVmixState, findInput } from './parser.js';
export { StateCache, createStateCache } from './cache.js';
export { createInputLookup, getInputLookup } from './input-lookup.js';
export { INPUT_ROLES, inferInputRole, type InputRole } from './input-roles.js';
export {
  AUDIO_BUS_NAMES,
  createAudioRouting,
  createOverlayChannels,
  parseAudioBusList,
} from './normalized-topology.js';
export {
  createStateRelationships,
  getActiveInput,
  getBusInputRelationships,
  getInputUsages,
  getOverlayInputRelationships,
  getPreviewInput,
  getStateRelationships,
  getTitleFieldRelationships,
  summarizeInput,
} from './relationships.js';

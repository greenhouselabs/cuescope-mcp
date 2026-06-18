/**
 * Validation module
 * @module validation
 */

// Schemas
export {
  InputReferenceSchema,
  MixSchema,
  OverlayChannelSchema,
  AudioBusSchema,
  VolumeSchema,
  MuteStateSchema,
  DurationSchema,
  TransitionEffectSchema,
  StingerNumberSchema,
  PlaybackActionSchema,
  InputTypeSchema,
  StreamNumberSchema,
  FtbStateSchema,
  CountdownActionSchema,
  type InputReference,
  type AudioBus,
  type TransitionEffect,
  type PlaybackAction,
  type InputType,
  type CountdownAction,
} from './schemas.js';

// Script validation
export {
  validateVmixScript,
  VMIX_SCRIPT_PATTERNS,
  type ScriptValidationResult,
} from './script-validator.js';

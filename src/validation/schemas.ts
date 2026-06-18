/**
 * Shared Zod schemas for tool input validation
 */

import { z } from 'zod';

// =============================================================================
// Input References
// =============================================================================

/**
 * Input can be referenced by:
 * - Number: 1, 2, 3 (input position)
 * - Name: "Camera 1" (case-sensitive!)
 * - GUID: "{abc123-...}"
 */
export const InputReferenceSchema = z.union([
  z.string().min(1, 'Input reference cannot be empty'),
  z.number().int().positive('Input number must be a positive integer'),
]);

export type InputReference = z.infer<typeof InputReferenceSchema>;

// =============================================================================
// Mix and Overlay
// =============================================================================

/**
 * Mix number (0 = main, 1-3 = additional M/E buses)
 */
export const MixSchema = z
  .number()
  .int()
  .min(0, 'Mix must be 0-3')
  .max(3, 'Mix must be 0-3')
  .optional()
  .describe('Mix number (0=main, 1-3=additional)');

/**
 * Overlay channel (1-4)
 */
export const OverlayChannelSchema = z
  .number()
  .int()
  .min(1, 'Overlay channel must be 1-4')
  .max(4, 'Overlay channel must be 1-4')
  .describe('Overlay channel 1-4');

// =============================================================================
// Audio
// =============================================================================

/**
 * Audio bus identifier
 */
export const AudioBusSchema = z
  .enum(['M', 'A', 'B', 'C', 'D', 'E', 'F', 'G'])
  .describe('Audio bus (M=master, A-G=auxiliary)');

export type AudioBus = z.infer<typeof AudioBusSchema>;

/**
 * Volume level (0-100 is normal range, can exceed 100 for gain)
 */
export const VolumeSchema = z
  .number()
  .min(0, 'Volume cannot be negative')
  .max(200, 'Volume cannot exceed 200')
  .describe('Volume level (0-100 normal, can exceed for gain)');

/**
 * Mute state
 */
export const MuteStateSchema = z
  .enum(['on', 'off', 'toggle'])
  .default('toggle')
  .describe("'on' = mute, 'off' = unmute, 'toggle' = switch");

// =============================================================================
// Transitions
// =============================================================================

/**
 * Transition duration in milliseconds
 */
export const DurationSchema = z
  .number()
  .min(0, 'Duration cannot be negative')
  .max(10000, 'Duration cannot exceed 10 seconds')
  .default(1000)
  .describe('Duration in milliseconds');

/**
 * Transition effect names
 */
export const TransitionEffectSchema = z.enum([
  'Fade',
  'Zoom',
  'Wipe',
  'Slide',
  'Fly',
  'CrossZoom',
  'FlyRotate',
  'Cube',
  'CubeZoom',
  'VerticalWipe',
  'VerticalSlide',
  'Merge',
  'WipeReverse',
  'SlideReverse',
  'VerticalWipeReverse',
  'VerticalSlideReverse',
]);

export type TransitionEffect = z.infer<typeof TransitionEffectSchema>;

/**
 * Stinger number (1-4)
 */
export const StingerNumberSchema = z
  .number()
  .int()
  .min(1, 'Stinger must be 1-4')
  .max(4, 'Stinger must be 1-4')
  .default(1)
  .describe('Stinger transition number 1-4');

// =============================================================================
// Playback
// =============================================================================

/**
 * Playback action
 */
export const PlaybackActionSchema = z.enum(['play', 'pause', 'restart', 'play_pause']);

export type PlaybackAction = z.infer<typeof PlaybackActionSchema>;

// =============================================================================
// Input Types
// =============================================================================

/**
 * Input types that can be added
 */
export const InputTypeSchema = z.enum([
  'Video',
  'Image',
  'Photos',
  'Title',
  'GT',
  'Colour',
  'NDI',
  'Browser',
  'AudioFile',
  'Call',
  'VideoList',
  'Stream',
  'PowerPoint',
  'VirtualSet',
  'Xaml',
]);

export type InputType = z.infer<typeof InputTypeSchema>;

// =============================================================================
// Streaming
// =============================================================================

/**
 * Stream number (0-2 for the 3 simultaneous streams)
 */
export const StreamNumberSchema = z
  .number()
  .int()
  .min(0, 'Stream number must be 0-2')
  .max(2, 'Stream number must be 0-2')
  .default(0)
  .describe('Stream number (0, 1, or 2)');

// =============================================================================
// Fade/FTB
// =============================================================================

/**
 * Fade to Black state
 */
export const FtbStateSchema = z
  .enum(['on', 'off', 'toggle'])
  .default('toggle')
  .describe("'on' = fade to black, 'off' = restore, 'toggle' = switch");

// =============================================================================
// Countdown
// =============================================================================

/**
 * Countdown action
 */
export const CountdownActionSchema = z.enum(['start', 'stop', 'pause', 'set', 'adjust']);

export type CountdownAction = z.infer<typeof CountdownActionSchema>;

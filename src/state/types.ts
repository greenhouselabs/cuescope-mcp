/**
 * vMix state type definitions
 */

import type { InputRole } from './input-roles.js';

/**
 * Input state (playback status)
 */
export type InputState = 'Running' | 'Paused' | 'Completed' | '';

/**
 * vMix audio bus names visible in input routing
 */
export type AudioBusName = 'M' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

/**
 * Per-input audio meter readings where vMix exposes them
 */
export interface VmixInputAudioMeters {
  /** First front channel meter */
  f1: number | null;
  /** Second front channel meter */
  f2: number | null;
}

/**
 * Layer/overlay relationship inside a vMix input
 */
export interface VmixLayer {
  /** Layer index within the parent input */
  index: number;
  /** Referenced input number, when vMix exposes it */
  input?: number;
  /** Referenced input GUID, when vMix exposes it */
  key?: string;
  /** Referenced input title, when vMix exposes it */
  title?: string;
  /** Horizontal pan value */
  panX?: number;
  /** Vertical pan value */
  panY?: number;
  /** Layer zoom value */
  zoom?: number;
  /** Layer width value */
  width?: number;
  /** Layer height value */
  height?: number;
  /** Left crop value */
  cropX1?: number;
  /** Top crop value */
  cropY1?: number;
  /** Right crop value */
  cropX2?: number;
  /** Bottom crop value */
  cropY2?: number;
}

/**
 * vMix input representation
 */
export interface VmixInput {
  /** Unique identifier (GUID) */
  key: string;
  /** Input number (1-indexed) */
  number: number;
  /** Input type (Capture, Video, Xaml, GT, NDI, etc.) */
  type: string;
  /** Display name (case-sensitive!) */
  title: string;
  /** Playback state */
  state: InputState;
  /** Current position in milliseconds */
  position: number;
  /** Total duration in milliseconds (0 for live sources) */
  duration: number;
  /** Whether audio is muted */
  muted: boolean;
  /** Whether looping is enabled */
  loop: boolean;
  /** Selected list/title index when vMix exposes it */
  selectedIndex?: number | null;
  /** Audio bus assignment (e.g., "M", "M,A", "M,A,B") */
  audioBuses: string;
  /** Normalized audio bus assignment */
  audioBusList?: AudioBusName[];
  /** Live input audio meters when vMix exposes them */
  meters?: VmixInputAudioMeters;
  /** Text/image fields for Title/GT inputs */
  fields?: Record<string, string>;
  /** Layers/overlays contained inside this input */
  layers?: VmixLayer[];
}

/**
 * Normalized input lookup maps for fast state reasoning
 */
export interface VmixInputLookupMaps {
  /** Inputs by normalized GUID/key (surrounding braces stripped, lower-cased) */
  byKey: Record<string, VmixInput>;
  /** Inputs by stringified input number */
  byNumber: Record<string, VmixInput>;
  /** Inputs by exact, case-sensitive title */
  byExactTitle: Record<string, VmixInput[]>;
  /** Inputs grouped by lower-cased vMix input type */
  byType: Record<string, VmixInput[]>;
  /** Inputs grouped by inferred production role */
  byRole: Record<InputRole, VmixInput[]>;
}

/**
 * Audio channel state
 */
export interface AudioChannel {
  /** Volume level (0-100+, 100 = unity/0dB) */
  volume: number;
  /** Whether the channel is muted */
  muted: boolean;
}

/**
 * Normalized overlay channel state
 */
export interface VmixOverlayChannel {
  /** Overlay channel number, 1-4 */
  channel: number;
  /** Assigned input number, or null when empty */
  inputNumber: number | null;
  /** Assigned input key when the input is visible in parsed state */
  inputKey?: string;
  /** Assigned input title when the input is visible in parsed state */
  inputTitle?: string;
  /** Whether the overlay channel has an assigned input */
  active: boolean;
}

/**
 * Parsed vMix mix active/preview state
 */
export interface VmixMixState {
  /** vMix mix number */
  number: number;
  /** Active/Program input number for this mix */
  active: number;
  /** Preview input number for this mix */
  preview: number;
}

/**
 * Compact input summary used in normalized audio routing
 */
export interface VmixAudioRoutingInput {
  /** Input number */
  number: number;
  /** Stable input key/GUID */
  key: string;
  /** Input title */
  title: string;
  /** vMix input type */
  type: string;
  /** Whether the input is muted */
  muted: boolean;
}

/**
 * Parsed output bus state for routing summaries
 */
export interface VmixAudioRoutingOutput {
  /** Whether mute/volume state was parsed for this output */
  parsed: boolean;
  /** Output volume, or null when not parsed */
  volume: number | null;
  /** Output mute state, or null when not parsed */
  muted: boolean | null;
}

/**
 * Inputs routed to a specific audio bus
 */
export interface VmixAudioRoutingBus {
  /** Bus name */
  bus: AudioBusName;
  /** Parsed output state for this bus */
  output: VmixAudioRoutingOutput;
  /** Inputs routed to this bus */
  inputs: VmixAudioRoutingInput[];
}

/**
 * Normalized audio routing map
 */
export interface VmixAudioRouting {
  /** Routed inputs by bus */
  buses: Record<AudioBusName, VmixAudioRoutingBus>;
  /** Inputs with no parsed bus assignment */
  unrouted: VmixAudioRoutingInput[];
}

/**
 * Compact input identity summary for relationship views
 */
export interface VmixInputSummary {
  /** Input number */
  number: number;
  /** Stable input key/GUID */
  key: string;
  /** Input title */
  title: string;
  /** vMix input type */
  type: string;
  /** Inferred production role */
  role: InputRole;
}

/**
 * Overlay-to-input relationship summary
 */
export interface VmixOverlayRelationship {
  /** Overlay channel number */
  channel: number;
  /** Assigned input number, or null when empty */
  inputNumber: number | null;
  /** Assigned input summary, or null when empty/not found */
  input: VmixInputSummary | null;
  /** Whether the overlay channel has an assigned input */
  active: boolean;
}

/**
 * Mix-to-input relationship summary
 */
export interface VmixMixRelationship {
  /** vMix mix number */
  number: number;
  /** Active/Program input number for this mix */
  activeInputNumber: number;
  /** Active/Program input summary, or null when not found */
  activeInput: VmixInputSummary | null;
  /** Preview input number for this mix */
  previewInputNumber: number;
  /** Preview input summary, or null when not found */
  previewInput: VmixInputSummary | null;
}

/**
 * Audio bus-to-input relationship summary
 */
export interface VmixBusRelationship {
  /** Bus name */
  bus: AudioBusName;
  /** Parsed output state for this bus */
  output: VmixAudioRoutingOutput;
  /** Inputs routed to this bus */
  inputs: VmixInputSummary[];
}

/**
 * Title/graphics field relationship summary
 */
export interface VmixTitleFieldRelationship {
  /** Title/graphics input identity */
  input: VmixInputSummary;
  /** Visible field names */
  fieldNames: string[];
  /** Visible field values */
  fields: Record<string, string>;
}

/**
 * Per-input placement and usage relationship summary
 */
export interface VmixInputUsage {
  /** Input identity */
  input: VmixInputSummary;
  /** Whether this input is currently Program */
  program: boolean;
  /** Whether this input is currently Preview */
  preview: boolean;
  /** Overlay channels where this input is assigned */
  overlayChannels: number[];
  /** Audio buses where this input is routed */
  audioBuses: AudioBusName[];
  /** Whether this input exposes title/image fields */
  hasFields: boolean;
  /** Visible title/image field names */
  fieldNames: string[];
  /** Number of parsed nested layers */
  layerCount: number;
  /** Human-readable likely usage tags */
  likelyUsage: string[];
}

/**
 * Normalized relationships across the current vMix state
 */
export interface VmixStateRelationships {
  /** Current Program input summary */
  activeInput: VmixInputSummary | null;
  /** Current Preview input summary */
  previewInput: VmixInputSummary | null;
  /** Overlay channel-to-input relationships */
  overlays: VmixOverlayRelationship[];
  /** Mix active/preview relationships */
  mixes: VmixMixRelationship[];
  /** Audio bus-to-input relationships */
  buses: Record<AudioBusName, VmixBusRelationship>;
  /** Title/graphics inputs and visible fields */
  titleInputs: VmixTitleFieldRelationship[];
  /** Per-input placement/routing/usage summary */
  inputUsages: VmixInputUsage[];
}

/**
 * Audio state for all buses
 */
export interface VmixAudioState {
  master: AudioChannel;
  /**
   * Whether a <master> element was actually present in the parsed XML.
   * When false, `master` holds assumed defaults. Undefined (e.g. hand-built
   * states) is treated as parsed for backwards compatibility.
   */
  masterParsed?: boolean;
  busA?: AudioChannel;
  busB?: AudioChannel;
  busC?: AudioChannel;
  busD?: AudioChannel;
  busE?: AudioChannel;
  busF?: AudioChannel;
  busG?: AudioChannel;
}

/**
 * Complete vMix state
 */
export interface VmixState {
  /** vMix version string */
  version: string;
  /** vMix edition (Basic, HD, 4K, Pro, etc.) */
  edition: string;
  /** Current program (active) input number */
  active: number;
  /** Current preview input number */
  preview: number;
  /** Whether Fade to Black is active */
  fadeToBlack: boolean;
  /** Whether recording is active */
  recording: boolean;
  /** Recording duration in seconds, exactly as vMix reports it (`<recording duration="…">`) */
  recordingDuration: number;
  /** Whether streaming is active */
  streaming: boolean;
  /** Whether external output is active */
  external: boolean;
  /** All inputs */
  inputs: VmixInput[];
  /** Normalized input lookup maps, populated by the parser when state comes from XML */
  inputLookup?: VmixInputLookupMaps;
  /** Overlay channels 1-4 (null if empty, input number if assigned) */
  overlays: (number | null)[];
  /** Normalized overlay channel assignments */
  overlayChannels?: VmixOverlayChannel[];
  /** Parsed mix active/preview states when vMix exposes a <mixes> section */
  mixes?: VmixMixState[];
  /** Audio state */
  audio: VmixAudioState;
  /** Normalized audio routing by bus */
  audioRouting?: VmixAudioRouting;
  /** Normalized relationships across parsed state */
  relationships?: VmixStateRelationships;
}

/**
 * State cache interface
 */
export interface IStateCache {
  /** Get parsed state (uses cache if fresh) */
  getState(): Promise<VmixState>;
  /** Get raw XML (uses cache if fresh) */
  getRawXml(): Promise<string>;
  /** Invalidate the cache */
  invalidate(): void;
}

/**
 * State parser interface
 */
export interface IStateParser {
  /** Parse XML to state object */
  parse(xml: string): VmixState;
}

/**
 * State cache options
 */
export interface StateCacheOptions {
  /** Cache time-to-live in milliseconds (default: 100) */
  ttlMs?: number;
}

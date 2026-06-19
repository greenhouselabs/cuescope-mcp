/**
 * Typed model for a saved vMix preset (.vmix) file.
 * Distinct from VmixState (live /api/ XML) — this is "as last saved".
 */

export const PRESET_FRESHNESS_NOTE =
  'Read from a saved .vmix file. Reflects the preset as last saved, which may differ from what vMix is running now.';

export interface PresetFileMeta {
  /** Filesystem path when read from disk; null when read from supplied content. */
  path: string | null;
  /** ISO timestamp of the file's last modification when known. */
  modifiedAt: string | null;
  /** Preset format version from the file's <Version> element, when present. */
  presetVersion: string | null;
  source: 'saved preset file';
  /** Human-readable freshness caveat (PRESET_FRESHNESS_NOTE). */
  freshnessNote: string;
}

export interface PresetScript {
  name: string;
  /** Entity-decoded VB.NET source. */
  source: string;
}

export interface PresetInputTrigger {
  /** Event, e.g. "OnTransitionIn" / "OnCompletion". */
  event: string;
  /** vMix function the trigger fires, e.g. "ScriptStart". */
  function: string;
  /** Function value/argument (for ScriptStart, the script name). */
  value: string | null;
  duration: number | null;
  delay: number | null;
  mix: number | null;
  /** Target input GUID; null when the all-zero/no-target placeholder. */
  targetInputKey: string | null;
  /** Target input number; null when 0/unset. */
  targetInputNumber: number | null;
}

export interface PresetInput {
  key: string | null;
  title: string;
  /** Numeric type code as a string, e.g. "22". */
  type: string | null;
  /** Saved input audio state. Reflects the preset file as last saved. */
  audio: PresetInputAudio | null;
  /** vMix Call-specific saved settings, when this input carries them. */
  videoCall: PresetInputVideoCall | null;
  triggers: PresetInputTrigger[];
  /** Saved title/GT metadata embedded in input attributes, when present. */
  titleMetadata: PresetInputTitleMetadata | null;
}

export interface PresetInputCountdownSetting {
  /** Best-effort field/slot name when exposed, e.g. Countdown.Text. */
  fieldName: string | null;
  /** Countdown start/default value when exposed by vMix. */
  startTime: string | null;
  /** Countdown duration/default countdown value when exposed by vMix. */
  duration: string | null;
  format: string | null;
  reverse: boolean | null;
  reverseDisplay: boolean | null;
  autoStart: boolean | null;
  loop: boolean | null;
  actionAtEnd: string | null;
  /** Compact known child values preserved for review/debugging. */
  rawValues: Record<string, string>;
}

export interface PresetInputDataSourceBinding {
  /** Title field name, e.g. Countdown.Text, when exposed. */
  fieldName: string | null;
  /** Data-source instance id when vMix stores the binding by GUID/id. */
  instanceId: string | null;
  dataSource: string | null;
  table: string | null;
  column: string | null;
  row: number | null;
  rawValues: Record<string, string>;
}

export interface PresetInputTitleMetadata {
  hasCountdownXml: boolean;
  hasDataSourcesXml: boolean;
  countdownSettings: PresetInputCountdownSetting[];
  dataSourceBindings: PresetInputDataSourceBinding[];
}

export interface PresetInputAudio {
  muted: boolean | null;
  buses: string[];
  busMaster: boolean | null;
  busFlags: Partial<Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G', boolean>>;
}

export interface PresetInputVideoCall {
  /** Redacted by redactPresetFile before output. */
  key: string | null;
  hasKey: boolean;
  returnAudioIndex: number | null;
  returnVideoName: string | null;
  serverMode: string | null;
  bandwidthProfile: string | null;
  guestBandwidth: string | null;
}

export interface PresetDataSourceTable {
  name: string;
  index: number | null;
}

export interface PresetDataSource {
  /** Instance id from the saved preset, when present. */
  id: string | null;
  /** Provider, from datasource friendlyName, e.g. "Google Sheets". */
  provider: string;
  /** Instance title; may be empty/null. */
  title: string | null;
  tables: PresetDataSourceTable[];
}

export interface PresetFile {
  meta: PresetFileMeta;
  scripts: PresetScript[];
  inputs: PresetInput[];
  dataSources: PresetDataSource[];
}

/**
 * Compare a saved PresetFile against live VmixState. Surfaces ScriptStart triggers
 * pointing at non-existent scripts, triggers targeting absent inputs, and drift
 * between saved inputs and live state.
 */
import type { VmixState } from '../types.js';
import type { PresetFile } from './preset-types.js';
import { normalizeInputKey } from '../../utils/input-normalizer.js';

export type CrossRefCategory = 'trigger' | 'script' | 'drift';

export interface CrossReferenceFinding {
  severity: 'error' | 'warning' | 'info';
  category: CrossRefCategory;
  message: string;
  detail?: string;
}

export function crossReferencePreset(preset: PresetFile, state: VmixState): CrossReferenceFinding[] {
  const scriptNames = new Set(preset.scripts.map((s) => s.name));
  const liveTitles = new Set(state.inputs.map((i) => i.title).filter((t) => t.length > 0));
  // Keys are compared normalized (braces stripped, lower-cased): live vMix emits
  // unbraced keys while other sources may use the braced form.
  const liveKeys = new Set(state.inputs.map((i) => normalizeInputKey(i.key)).filter((k) => k.length > 0));
  const findings: CrossReferenceFinding[] = [];

  for (const input of preset.inputs) {
    for (const t of input.triggers) {
      if (/^ScriptStart/i.test(t.function) && t.value && !scriptNames.has(t.value)) {
        findings.push({
          severity: 'error',
          category: 'trigger',
          message: `Trigger on "${input.title}" (${t.event}) calls ScriptStart "${t.value}", but no saved script has that name.`,
          detail: 'The trigger will fail silently, or the script was renamed/removed.',
        });
      }
      if (t.targetInputKey && !liveKeys.has(normalizeInputKey(t.targetInputKey))) {
        findings.push({
          severity: 'warning',
          category: 'trigger',
          message: `Trigger on "${input.title}" targets an input key absent from live state.`,
          detail: `Event "${t.event}" -> ${t.function}.`,
        });
      }
    }

    const keyKnown = !!input.key && liveKeys.has(normalizeInputKey(input.key));
    const titleKnown = input.title.length > 0 && liveTitles.has(input.title);
    if (!keyKnown && !titleKnown) {
      findings.push({
        severity: 'warning',
        category: 'drift',
        message: `Saved input "${input.title}" is not present in live state.`,
        detail: 'The running preset differs from this saved file (drift / unsaved change).',
      });
    }
  }

  return findings;
}

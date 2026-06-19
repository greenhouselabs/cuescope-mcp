import { describe, it, expect } from 'vitest';
import { crossReferencePreset } from '../../../../src/state/preset/cross-reference.js';
import type { PresetFile, PresetInput } from '../../../../src/state/preset/preset-types.js';
import { PRESET_FRESHNESS_NOTE } from '../../../../src/state/preset/preset-types.js';
import type { VmixState } from '../../../../src/state/types.js';

function input(over: Partial<PresetInput>): PresetInput {
  return { key: null, title: '', type: null, audio: null, videoCall: null, triggers: [], titleMetadata: null, ...over };
}
function preset(over: Partial<PresetFile>): PresetFile {
  return {
    meta: { path: null, modifiedAt: null, presetVersion: '9', source: 'saved preset file', freshnessNote: PRESET_FRESHNESS_NOTE },
    scripts: [], inputs: [], dataSources: [], ...over,
  };
}
const live = { inputs: [{ number: 1, key: '{abc}', title: 'Camera 1', type: 'Capture' }] } as unknown as VmixState;

describe('crossReferencePreset', () => {
  it('flags a ScriptStart trigger whose target script does not exist', () => {
    const p = preset({
      scripts: [{ name: 'Exists', source: '' }],
      inputs: [input({ title: 'Mix 1 1-Up', key: '{abc}', triggers: [
        { event: 'OnTransitionIn', function: 'ScriptStart', value: 'Missing Script', duration: 500, delay: 0, mix: 1, targetInputKey: null, targetInputNumber: null },
      ] })],
    });
    const findings = crossReferencePreset(p, live);
    expect(findings.some((f) => f.severity === 'error' && f.category === 'trigger' && /Missing Script/.test(f.message))).toBe(true);
  });

  it('does not flag a ScriptStart trigger whose script exists', () => {
    const p = preset({
      scripts: [{ name: 'Mix 1 Audio In', source: '' }],
      inputs: [input({ title: 'Camera 1', key: '{abc}', triggers: [
        { event: 'OnTransitionIn', function: 'ScriptStart', value: 'Mix 1 Audio In', duration: 500, delay: 0, mix: 1, targetInputKey: null, targetInputNumber: null },
      ] })],
    });
    expect(crossReferencePreset(p, live).filter((f) => f.category === 'trigger')).toHaveLength(0);
  });

  it('flags drift when a saved input is missing from live state', () => {
    const findings = crossReferencePreset(preset({ inputs: [input({ title: 'Removed', key: '{xyz}' })] }), live);
    expect(findings.some((f) => f.category === 'drift')).toBe(true);
  });

  it('matches keys brace-insensitively (live vMix emits unbraced keys)', () => {
    const unbracedLive = {
      inputs: [
        { number: 1, key: '8e211845-684d-43cd-b5af-cabb00e4a00f', title: 'Camera 1', type: 'Capture' },
      ],
    } as unknown as VmixState;
    const p = preset({
      inputs: [input({ title: 'Renamed Camera', key: '{8E211845-684D-43CD-B5AF-CABB00E4A00F}' })],
    });
    expect(crossReferencePreset(p, unbracedLive).filter((f) => f.category === 'drift')).toHaveLength(0);
  });

  it('does not let an empty live key suppress drift', () => {
    const liveWithEmptyKey = { inputs: [{ number: 1, key: '', title: 'Camera 1', type: 'Capture' }] } as unknown as VmixState;
    const findings = crossReferencePreset(preset({ inputs: [input({ title: 'Ghost', key: '' })] }), liveWithEmptyKey);
    expect(findings.some((f) => f.category === 'drift')).toBe(true);
  });
});

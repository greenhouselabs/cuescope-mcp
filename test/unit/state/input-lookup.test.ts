/**
 * Tests for normalized input lookup maps
 */

import { describe, expect, it } from 'vitest';
import type { VmixInput, VmixState } from '../../../src/state/types.js';
import { createInputLookup, getInputLookup } from '../../../src/state/input-lookup.js';

function input(partial: Partial<VmixInput>): VmixInput {
  return {
    key: partial.key ?? '{input-key}',
    number: partial.number ?? 1,
    type: partial.type ?? 'Video',
    title: partial.title ?? 'Input',
    state: partial.state ?? 'Paused',
    position: partial.position ?? 0,
    duration: partial.duration ?? 0,
    muted: partial.muted ?? false,
    loop: partial.loop ?? false,
    audioBuses: partial.audioBuses ?? 'M',
    fields: partial.fields,
  };
}

describe('createInputLookup', () => {
  it('builds single-input lookup maps by key, number, exact title, type, and role', () => {
    const camera = input({
      key: '{Camera-Key}',
      number: 2,
      type: 'Capture',
      title: 'Camera 1',
    });

    const lookup = createInputLookup([camera]);

    // byKey is normalized: surrounding braces stripped and lower-cased
    expect(lookup.byKey['camera-key']).toBe(camera);
    expect(lookup.byKey['{camera-key}']).toBeUndefined();
    expect(lookup.byNumber['2']).toBe(camera);
    expect(lookup.byExactTitle['Camera 1']).toEqual([camera]);
    expect(lookup.byExactTitle['camera 1']).toBeUndefined();
    expect(lookup.byType['capture']).toEqual([camera]);
    expect(lookup.byRole.camera).toEqual([camera]);
  });

  it('keeps exact-title collisions as arrays', () => {
    const first = input({ key: '{first}', number: 1, title: 'Replay' });
    const second = input({ key: '{second}', number: 2, title: 'Replay' });

    const lookup = createInputLookup([first, second]);

    expect(lookup.byExactTitle['Replay']).toEqual([first, second]);
  });

  it('stores unbraced keys (real vMix format) under the same normalized form', () => {
    const camera = input({
      key: '8E211845-684D-43CD-B5AF-CABB00E4A00F',
      number: 1,
      type: 'Capture',
      title: 'Camera 1',
    });

    const lookup = createInputLookup([camera]);

    expect(lookup.byKey['8e211845-684d-43cd-b5af-cabb00e4a00f']).toBe(camera);
  });
});

describe('getInputLookup', () => {
  it('returns parser-populated lookup maps when present', () => {
    const camera = input({ key: '{camera}', number: 1, type: 'Capture', title: 'Camera' });
    const lookup = createInputLookup([camera]);
    const state = {
      inputs: [camera],
      inputLookup: lookup,
    } as VmixState;

    expect(getInputLookup(state)).toBe(lookup);
  });

  it('builds lookup maps for compatibility states without inputLookup', () => {
    const camera = input({ key: '{camera}', number: 1, type: 'Capture', title: 'Camera' });
    const state = {
      inputs: [camera],
    } as VmixState;

    expect(getInputLookup(state).byNumber['1']).toBe(camera);
  });
});

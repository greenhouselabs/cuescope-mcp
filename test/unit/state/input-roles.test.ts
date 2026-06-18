/**
 * Tests for shared input role inference
 */

import { describe, expect, it } from 'vitest';
import type { VmixInput } from '../../../src/state/types.js';
import { inferInputRole } from '../../../src/state/input-roles.js';

function input(overrides: Partial<VmixInput>): VmixInput {
  return {
    key: '{input}',
    number: 1,
    type: 'Unknown',
    title: 'Input',
    state: '',
    position: 0,
    duration: 0,
    muted: false,
    loop: false,
    audioBuses: '',
    ...overrides,
  };
}

describe('input role inference', () => {
  it('prioritizes explicit NDI microphone/audio titles over generic NDI camera inference', () => {
    expect(
      inferInputRole(
        input({
          type: 'NDI',
          title: 'NDI - MIC 1 AUDIO',
          audioBuses: 'A',
        })
      )
    ).toBe('audioOnly');
  });

  it('prioritizes NDI graphics/playout titles over generic NDI camera inference', () => {
    expect(
      inferInputRole(
        input({
          type: 'NDI',
          title: 'NDI - HORIZONTAL GFX PLAYOUT',
          muted: true,
        })
      )
    ).toBe('imageGraphic');
  });

  it('recognizes offline cable audio titles as audio sources even when type is thin', () => {
    expect(
      inferInputRole(
        input({
          type: 'Placeholder',
          title: 'Offline - Audio CABLE-A Output',
          audioBuses: 'M',
        })
      )
    ).toBe('audioOnly');
  });
});


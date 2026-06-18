/**
 * Tests for normalized overlay and audio topology helpers
 */

import { describe, expect, it } from 'vitest';
import type { VmixAudioState, VmixInput } from '../../../src/state/types.js';
import {
  createAudioRouting,
  createOverlayChannels,
  parseAudioBusList,
} from '../../../src/state/normalized-topology.js';

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
    audioBusList: partial.audioBusList,
  };
}

describe('parseAudioBusList', () => {
  it('normalizes valid bus names and removes duplicates', () => {
    expect(parseAudioBusList('m, A, a, G, unknown')).toEqual(['M', 'A', 'G']);
  });

  it('returns an empty array for empty routing', () => {
    expect(parseAudioBusList('')).toEqual([]);
  });
});

describe('createOverlayChannels', () => {
  it('summarizes overlay channels with visible input identity', () => {
    const camera = input({ key: '{camera}', number: 2, type: 'Capture', title: 'Camera' });

    expect(createOverlayChannels([2, null], [camera])).toEqual([
      {
        channel: 1,
        inputNumber: 2,
        inputKey: '{camera}',
        inputTitle: 'Camera',
        active: true,
      },
      {
        channel: 2,
        inputNumber: null,
        active: false,
      },
    ]);
  });
});

describe('createAudioRouting', () => {
  it('groups routed and unrouted inputs by normalized bus', () => {
    const audio: VmixAudioState = {
      master: { volume: 100, muted: false },
      busA: { volume: 80, muted: true },
    };
    const camera = input({
      key: '{camera}',
      number: 1,
      type: 'Capture',
      title: 'Camera',
      audioBuses: 'M,A',
      audioBusList: ['M', 'A'],
    });
    const graphic = input({
      key: '{graphic}',
      number: 2,
      type: 'GT',
      title: 'Graphic',
      audioBuses: '',
      audioBusList: [],
    });

    const routing = createAudioRouting([camera, graphic], audio);

    expect(routing.buses.M.output).toEqual({
      parsed: true,
      volume: 100,
      muted: false,
    });
    expect(routing.buses.A.output).toEqual({
      parsed: true,
      volume: 80,
      muted: true,
    });
    expect(routing.buses.B.output).toEqual({
      parsed: false,
      volume: null,
      muted: null,
    });
    expect(routing.buses.M.inputs.map((routedInput) => routedInput.title)).toEqual(['Camera']);
    expect(routing.buses.A.inputs.map((routedInput) => routedInput.title)).toEqual(['Camera']);
    expect(routing.unrouted.map((routedInput) => routedInput.title)).toEqual(['Graphic']);
  });

  it('reports bus M as unparsed when master holds assumed defaults', () => {
    const audio: VmixAudioState = {
      master: { volume: 100, muted: false },
      masterParsed: false,
    };

    const routing = createAudioRouting([], audio);

    expect(routing.buses.M.output).toEqual({
      parsed: false,
      volume: null,
      muted: null,
    });
  });

  it('treats hand-built states without masterParsed as parsed for compatibility', () => {
    const audio: VmixAudioState = {
      master: { volume: 90, muted: false },
    };

    const routing = createAudioRouting([], audio);

    expect(routing.buses.M.output).toEqual({
      parsed: true,
      volume: 90,
      muted: false,
    });
  });
});

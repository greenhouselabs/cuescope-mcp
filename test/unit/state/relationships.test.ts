/**
 * Tests for normalized state relationship helpers
 */

import { describe, expect, it } from 'vitest';
import type { VmixInput, VmixState } from '../../../src/state/types.js';
import {
  createStateRelationships,
  getActiveInput,
  getPreviewInput,
  getStateRelationships,
} from '../../../src/state/relationships.js';

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
    fields: partial.fields,
    layers: partial.layers,
  };
}

function state(inputs: VmixInput[]): VmixState {
  return {
    version: '29.0.0.0',
    edition: '4K Plus',
    active: 1,
    preview: 2,
    fadeToBlack: false,
    recording: false,
    recordingDuration: 0,
    streaming: false,
    external: false,
    inputs,
    overlays: [3, null, null, null],
    audio: {
      master: { volume: 100, muted: false },
      busA: { volume: 80, muted: false },
    },
  };
}

describe('relationship helpers', () => {
  it('resolves active and preview inputs from state lookup fallbacks', () => {
    const currentState = state([
      input({ key: '{host}', number: 1, type: 'Capture', title: 'Host Camera' }),
      input({ key: '{guest}', number: 2, type: 'vMixCall', title: 'Remote Guest' }),
    ]);

    expect(getActiveInput(currentState)?.title).toBe('Host Camera');
    expect(getPreviewInput(currentState)?.title).toBe('Remote Guest');
  });

  it('builds relationships for placement, buses, title fields, and likely usage', () => {
    const currentState = state([
      input({
        key: '{host}',
        number: 1,
        type: 'Capture',
        title: 'Host Camera',
        audioBuses: 'M,A',
        audioBusList: ['M', 'A'],
      }),
      input({
        key: '{guest}',
        number: 2,
        type: 'vMixCall',
        title: 'Remote Guest',
        audioBuses: 'M',
        audioBusList: ['M'],
      }),
      input({
        key: '{lower-third}',
        number: 3,
        type: 'GT',
        title: 'Lower Third',
        audioBuses: '',
        audioBusList: [],
        fields: {
          'Name.Text': 'Jane Host',
        },
      }),
    ]);

    const relationships = createStateRelationships(currentState);

    expect(relationships.activeInput?.title).toBe('Host Camera');
    expect(relationships.previewInput?.title).toBe('Remote Guest');
    expect(relationships.overlays[0]).toMatchObject({
      channel: 1,
      inputNumber: 3,
      input: {
        title: 'Lower Third',
        role: 'titleGraphic',
      },
      active: true,
    });
    expect(relationships.buses.M.inputs.map((busInput) => busInput.title)).toEqual([
      'Host Camera',
      'Remote Guest',
    ]);
    expect(relationships.buses.A.inputs.map((busInput) => busInput.title)).toEqual(['Host Camera']);
    expect(relationships.titleInputs[0]).toMatchObject({
      input: {
        title: 'Lower Third',
      },
      fieldNames: ['Name.Text'],
      fields: {
        'Name.Text': 'Jane Host',
      },
    });
    expect(relationships.inputUsages.find((usage) => usage.input.title === 'Host Camera')).toMatchObject({
      program: true,
      preview: false,
      audioBuses: ['M', 'A'],
      likelyUsage: expect.arrayContaining(['program', 'audio', 'camera']),
    });
    expect(relationships.inputUsages.find((usage) => usage.input.title === 'Lower Third')).toMatchObject({
      overlayChannels: [1],
      hasFields: true,
      likelyUsage: expect.arrayContaining(['overlay', 'titleFields', 'titleGraphic']),
    });
  });

  it('returns parser-populated relationships when present', () => {
    const currentState = state([input({ key: '{host}', number: 1, type: 'Capture', title: 'Host Camera' })]);
    const relationships = createStateRelationships(currentState);
    const withRelationships = {
      ...currentState,
      relationships,
    };

    expect(getStateRelationships(withRelationships)).toBe(relationships);
  });
});

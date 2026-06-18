/**
 * Tests for vmix://state/relationships resource
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { stateRelationshipsResource } from '../../../src/resources/state-relationships.js';
import type { ResourceContext } from '../../../src/resources/base.js';
import { createTestConfig } from '../../../src/config/index.js';
import { createMockStateCache } from '../../mocks/tool-context.mock.js';
import { createMockVmixClient } from '../../mocks/vmix-client.mock.js';

describe('vmix://state/relationships', () => {
  let ctx: ResourceContext;

  beforeEach(() => {
    ctx = {
      state: createMockStateCache({
        active: 1,
        preview: 2,
        mixes: [
          { number: 1, active: 1, preview: 2 },
          { number: 2, active: 2, preview: 1 },
        ],
        overlays: [3, null, null, null],
        inputs: [
          {
            key: '{host}',
            number: 1,
            type: 'Capture',
            title: 'Host Camera',
            state: 'Running',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: 'M,A',
            audioBusList: ['M', 'A'],
          },
          {
            key: '{guest}',
            number: 2,
            type: 'vMixCall',
            title: 'Remote Guest',
            state: 'Running',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: 'M',
            audioBusList: ['M'],
          },
          {
            key: '{lower-third}',
            number: 3,
            type: 'GT',
            title: 'Lower Third',
            state: '',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: '',
            audioBusList: [],
            fields: {
              'Name.Text': 'Jane Host',
            },
          },
        ],
      }),
      vmix: createMockVmixClient(),
      config: createTestConfig(),
    };
  });

  it('has correct URI', () => {
    expect(stateRelationshipsResource.uri).toBe('vmix://state/relationships');
  });

  it('returns normalized state relationships', async () => {
    const result = await stateRelationshipsResource.handler(ctx);
    const data = JSON.parse(result.contents[0]?.text ?? '{}');

    expect(data.activeInput.title).toBe('Host Camera');
    expect(data.previewInput.title).toBe('Remote Guest');
    expect(data.overlays[0]).toMatchObject({
      channel: 1,
      inputNumber: 3,
      input: {
        title: 'Lower Third',
      },
      active: true,
    });
    expect(data.buses.M.inputs.map((input: { title: string }) => input.title)).toEqual([
      'Host Camera',
      'Remote Guest',
    ]);
    expect(data.mixes[1]).toMatchObject({
      number: 2,
      activeInput: {
        title: 'Remote Guest',
      },
      previewInput: {
        title: 'Host Camera',
      },
    });
    expect(data.mixesMeta).toMatchObject({
      parsedMixCount: 2,
      mixInputCount: 0,
    });
    expect(data.mixesMeta.note).toContain('Mix-type inputs');
    expect(data.titleInputs[0].fieldNames).toEqual(['Name.Text']);
    expect(data.inputUsages.find((usage: { input: { title: string } }) => usage.input.title === 'Host Camera'))
      .toMatchObject({
        program: true,
        audioBuses: ['M', 'A'],
      });
  });
});

/**
 * Tests for vmix://audio resource
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { audioResource } from '../../../src/resources/audio.js';
import type { ResourceContext } from '../../../src/resources/base.js';
import { createTestConfig } from '../../../src/config/index.js';
import { createMockStateCache } from '../../mocks/tool-context.mock.js';
import { createMockVmixClient } from '../../mocks/vmix-client.mock.js';

describe('vmix://audio', () => {
  let ctx: ResourceContext;

  beforeEach(() => {
    ctx = {
      state: createMockStateCache({
        inputs: [
          {
            key: '{camera}',
            number: 1,
            type: 'Capture',
            title: 'Camera',
            state: 'Running',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: 'M,A',
            audioBusList: ['M', 'A'],
          },
          {
            key: '{graphic}',
            number: 2,
            type: 'GT',
            title: 'Graphic',
            state: '',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: '',
            audioBusList: [],
          },
        ],
        audio: {
          master: { volume: 100, muted: false },
          busA: { volume: 80, muted: true },
        },
      }),
      vmix: createMockVmixClient(),
      config: createTestConfig(),
    };
  });

  it('has correct URI', () => {
    expect(audioResource.uri).toBe('vmix://audio');
  });

  it('returns normalized routing with legacy input bus fields', async () => {
    const result = await audioResource.handler(ctx);
    const data = JSON.parse(result.contents[0]?.text ?? '{}');

    expect(data.master).toEqual({ volume: 100, muted: false });
    expect(data.routing.buses.M.inputs.map((input: { title: string }) => input.title)).toEqual([
      'Camera',
    ]);
    expect(data.routing.buses.A.output).toEqual({
      parsed: true,
      volume: 80,
      muted: true,
    });
    expect(data.routing.unrouted.map((input: { title: string }) => input.title)).toEqual([
      'Graphic',
    ]);
    expect(data.inputs[0].buses).toBe('M,A');
    expect(data.inputs[0].busList).toEqual(['M', 'A']);
  });
});

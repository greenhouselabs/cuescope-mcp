/**
 * Tests for vmix://state/live resource
 */

import { describe, expect, it } from 'vitest';
import { stateLiveResource } from '../../../src/resources/state-live.js';
import { createMockStateCache } from '../../mocks/tool-context.mock.js';
import { createMockVmixClient } from '../../mocks/vmix-client.mock.js';
import { createTestConfig } from '../../../src/config/index.js';
import type { ResourceContext } from '../../../src/resources/base.js';

function createContext(): ResourceContext {
  return {
    state: createMockStateCache({
      active: 1,
      preview: 2,
      mixes: [
        { number: 1, active: 1, preview: 2 },
        { number: 2, active: 2, preview: 1 },
      ],
      inputs: [
        {
          key: '{video-1}',
          number: 1,
          type: 'Video',
          title: 'Program Clip',
          state: 'Running',
          position: 5000,
          duration: 10000,
          muted: true,
          loop: true,
          audioBuses: 'A',
          audioBusList: ['A'],
          meters: { f1: 0.1, f2: 0.2 },
        },
        {
          key: '{title-1}',
          number: 2,
          type: 'GT',
          title: 'Preview Title',
          state: '',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: '',
          fields: {
            'Headline.Text': 'Tonight',
          },
        },
      ],
    }),
    vmix: createMockVmixClient(),
    config: createTestConfig(),
  };
}

describe('vmix://state/live', () => {
  it('has correct URI', () => {
    expect(stateLiveResource.uri).toBe('vmix://state/live');
  });

  it('reports recording duration in seconds (vMix native unit)', async () => {
    const ctx = createContext();
    (ctx.state as ReturnType<typeof createMockStateCache>)._setState({
      recording: true,
      recordingDuration: 125,
    });

    const result = await stateLiveResource.handler(ctx);
    const data = JSON.parse(result.contents[0]?.text ?? '{}');

    expect(data.outputs.recordingDurationSeconds).toBe(125);
    expect(data.outputs).not.toHaveProperty('recordingDurationMs');
  });

  it('returns Program, Preview, playback, audio, and field details', async () => {
    const result = await stateLiveResource.handler(createContext());
    const data = JSON.parse(result.contents[0]?.text ?? '{}');

    const programInput = data.inputs.find((input: { number: number }) => input.number === data.program.inputNumber);
    const previewInput = data.inputs.find((input: { number: number }) => input.number === data.preview.inputNumber);
    expect(data.program.inputTitle).toBe('Program Clip');
    expect(programInput.progressPercent).toBe(50);
    expect(programInput.remainingMs).toBe(5000);
    expect(programInput.audioBusList).toEqual(['A']);
    expect(programInput.meters).toEqual({ f1: 0.1, f2: 0.2 });
    expect(previewInput.fieldNames).toEqual(['Headline.Text']);
    expect(data.mixes[1]).toMatchObject({
      number: 2,
      activeInputNumber: 2,
      activeInput: {
        title: 'Preview Title',
      },
      previewInputNumber: 1,
      previewInput: {
        title: 'Program Clip',
      },
    });
    expect(data.mixesMeta).toMatchObject({
      parsedMixCount: 2,
      mixInputCount: 0,
    });
    expect(data.mixesMeta.note).toContain('Mix-type inputs');
    expect(data.inputs).toHaveLength(2);
    expect(data.parserLimitations.join('\n')).toContain('point-in-time');
    expect(data.parserLimitations.join('\n')).toContain('parsed mix active/preview paths');
  });
});

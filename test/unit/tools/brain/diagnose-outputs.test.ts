/**
 * Tests for vmix_diagnose_outputs
 */

import { describe, expect, it } from 'vitest';
import { diagnoseOutputsTool } from '../../../../src/tools/brain/diagnose-outputs.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

function createOutputReviewContext(overrides = {}) {
  return createMockToolContext({
    initialState: {
      active: 1,
      preview: 3,
      inputs: [
        {
          key: '{program-key}',
          number: 1,
          type: 'Capture',
          title: 'Program Camera',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M',
        },
        {
          key: '{return-feed-key}',
          number: 2,
          type: 'Video',
          title: 'Return Feed',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: true,
          loop: false,
          audioBuses: '',
        },
        {
          key: '{output-key}',
          number: 3,
          type: 'Output',
          title: 'Output',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M',
        },
      ],
      overlays: [null, null, null, null],
      audio: {
        master: { volume: 100, muted: false },
        busA: { volume: 80, muted: false },
      },
      ...overrides,
    },
  });
}

describe('vmix_diagnose_outputs', () => {
  it('has the expected tool name', () => {
    expect(diagnoseOutputsTool.name).toBe('vmix_diagnose_outputs');
  });

  it('reviews idle go-live outputs without mutating vMix', async () => {
    const ctx = createOutputReviewContext();
    const result = await diagnoseOutputsTool.handler({}, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    expect(data.mode).toBe('readOnlyOutputReadiness');
    expect(data.execution.executed).toBe(false);
    expect(data.focus).toBe('goLive');
    expect(data.overallStatus).toBe('review');
    expect(data.readinessSummary).toMatchObject({
      disposition: 'notArmed',
      headline: 'Outputs are not armed yet; visible state is ready for operator verification.',
    });
    expect(data.readinessSummary.toneGuidance).toMatch(/not armed yet/i);
    expect(data.readinessSummary.headline).not.toMatch(/not ready/i);
    expect(data.visibleOutputState).toMatchObject({
      recording: false,
      streaming: false,
      external: false,
      activeOutputCount: 0,
      status: 'idle',
    });
    expect(data.destinationChecks.map((check: { id: string; status: string }) => [check.id, check.status]))
      .toEqual([
        ['streaming', 'review'],
        ['recording', 'review'],
        ['external', 'review'],
      ]);
    expect(data.videoPath.outputLikeInputs[0]).toMatchObject({
      input: {
        number: 3,
        title: 'Output',
        type: 'Output',
      },
    });
    expect(data.knownUnknowns).toContain('stream platform/profile destination and health');
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain('rtmp://');
    expect(serialized).not.toContain('SECRET');
    expect(serialized).not.toContain('password=');
  });

  it('blocks active output review when fade to black and Master audio are unsafe', async () => {
    const ctx = createOutputReviewContext({
      streaming: true,
      fadeToBlack: true,
      audio: {
        master: { volume: 0, muted: true },
      },
    });

    const result = await diagnoseOutputsTool.handler({ focus: 'streaming' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    expect(data.overallStatus).toBe('blocked');
    expect(data.readinessSummary.disposition).toBe('blocked');
    expect(data.visibleOutputState.activeOutputs).toEqual(['streaming']);
    expect(data.destinationChecks.find((check: { id: string }) => check.id === 'streaming'))
      .toMatchObject({
        status: 'blocked',
        visibleState: 'active',
      });
    expect(data.reviewItems.some((item: { message: string }) => /Fade to Black/i.test(item.message)))
      .toBe(true);
    expect(data.reviewItems.some((item: { message: string }) => /Master audio is muted/i.test(item.message)))
      .toBe(true);
    expect(data.audioPath.status).toBe('blocked');
  });

  it('reports multiple mix paths as review-only destination awareness', async () => {
    const ctx = createOutputReviewContext({
      external: true,
      mixes: [
        { number: 1, active: 1, preview: 3 },
        { number: 2, active: 3, preview: 1 },
      ],
    });

    const result = await diagnoseOutputsTool.handler({ focus: 'external' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.overallStatus).toBe('review');
    expect(data.readinessSummary.disposition).toBe('needsVerification');
    expect(data.videoPath.mixDestinationAwareness).toMatchObject({
      parsedMixCount: 2,
      canMapMixDestinations: false,
    });
    expect(data.reviewItems.some((item: { message: string }) => /destination binding/i.test(item.message)))
      .toBe(true);
  });
});

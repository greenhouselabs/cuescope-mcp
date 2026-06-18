/**
 * Tests for replay playback and camera/channel tools.
 * Camera and event-toggle names are runtime-composed (ReplayCamera<N>,
 * ReplayToggle{Last,Selected}EventCamera<N>) — verify against the allowlist.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  replayPlayTool,
  replayPauseTool,
  replaySpeedTool,
  replayJumpTool,
  replayPlayEventTool,
  replayPlayLastTool,
} from '../../../../src/tools/replay/playback.js';
import {
  replayCameraTool,
  replayChannelTool,
  replayToggleEventCameraTool,
} from '../../../../src/tools/replay/camera.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';
import { expectExecutedFunctionsAllowlisted } from '../allowlist-helper.js';

describe('replay tools', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  describe('playback', () => {
    it('play/pause use ReplayPlay / ReplayPause with no params', async () => {
      await replayPlayTool.handler({}, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ReplayPlay');

      await replayPauseTool.handler({}, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ReplayPause');
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('speed uses ReplaySetSpeed with the multiplier as Value', async () => {
      await replaySpeedTool.handler({ speed: 0.5 }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ReplaySetSpeed', { Value: '0.5' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('rejects speeds outside 0.1-4 in the schema', () => {
      expect(replaySpeedTool.schema.safeParse({ speed: 0 }).success).toBe(false);
      expect(replaySpeedTool.schema.safeParse({ speed: 5 }).success).toBe(false);
    });

    it('jump uses ReplayJumpFrames for forward and backward jumps', async () => {
      await replayJumpTool.handler({ frames: 50 }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ReplayJumpFrames', { Value: '50' });

      await replayJumpTool.handler({ frames: -50 }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ReplayJumpFrames', { Value: '-50' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('plays a specific event via ReplayPlayEvent', async () => {
      await replayPlayEventTool.handler({ event: 3 }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ReplayPlayEvent', { Value: '3' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('plays the most recent event via ReplayPlayLastEvent', async () => {
      await replayPlayLastTool.handler({}, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ReplayPlayLastEvent');
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });
  });

  describe('camera/channel selection', () => {
    it.each([1, 2, 3, 4, 5, 6, 7, 8])(
      'camera %i composes ReplayCamera%i (allowlisted)',
      async (camera) => {
        await replayCameraTool.handler({ camera }, ctx);
        expect(ctx.vmix.http.execute).toHaveBeenCalledWith(`ReplayCamera${camera}`);
        expectExecutedFunctionsAllowlisted(ctx.vmix.http);
      }
    );

    it('rejects cameras outside 1-8 in the schema', () => {
      expect(replayCameraTool.schema.safeParse({ camera: 0 }).success).toBe(false);
      expect(replayCameraTool.schema.safeParse({ camera: 9 }).success).toBe(false);
    });

    it('channel A/B compose ReplaySelectChannelA / ReplaySelectChannelB', async () => {
      await replayChannelTool.handler({ channel: 'A' }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ReplaySelectChannelA');

      await replayChannelTool.handler({ channel: 'B' }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ReplaySelectChannelB');
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('toggles camera visibility for the LAST event', async () => {
      await replayToggleEventCameraTool.handler({ camera: 4, event: 'last' }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ReplayToggleLastEventCamera4');
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('toggles camera visibility for the SELECTED event', async () => {
      await replayToggleEventCameraTool.handler({ camera: 8, event: 'selected' }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ReplayToggleSelectedEventCamera8');
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });
  });

  it('propagates vMix errors (failure path)', async () => {
    ctx.vmix.http._failOnFunction('ReplayPlay', new Error('replay not configured'));
    await expect(replayPlayTool.handler({}, ctx)).rejects.toThrow('replay not configured');
  });
});

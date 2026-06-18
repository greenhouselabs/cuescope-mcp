/**
 * Tests for PTZ tools: movement (composed PTZMove<Direction> names), zoom,
 * focus, and virtual input management.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ptzMoveTool, ptzStopTool, ptzHomeTool, ptzZoomTool, ptzZoomStopTool } from '../../../../src/tools/ptz/movement.js';
import { ptzFocusTool, ptzFocusStopTool, ptzFocusAutoTool } from '../../../../src/tools/ptz/focus.js';
import { ptzVirtualCreateTool, ptzVirtualUpdateTool } from '../../../../src/tools/ptz/virtual.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';
import { expectExecutedFunctionsAllowlisted } from '../allowlist-helper.js';

const ALL_DIRECTIONS = [
  'Up',
  'Down',
  'Left',
  'Right',
  'UpLeft',
  'UpRight',
  'DownLeft',
  'DownRight',
] as const;

describe('PTZ tools', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  describe('movement', () => {
    it.each(ALL_DIRECTIONS)(
      'composes PTZMove%s and the name is allowlisted',
      async (direction) => {
        await ptzMoveTool.handler({ input: 'PTZ Cam', direction, speed: 0.5 }, ctx);

        expect(ctx.vmix.http.execute).toHaveBeenCalledWith(`PTZMove${direction}`, {
          Input: 'PTZ Cam',
          Value: '0.5',
        });
        expectExecutedFunctionsAllowlisted(ctx.vmix.http);
      }
    );

    it('rejects unknown directions in the schema', () => {
      expect(
        ptzMoveTool.schema.safeParse({ input: 1, direction: 'Sideways', speed: 0.5 }).success
      ).toBe(false);
    });

    it('rejects speeds outside 0-1 in the schema', () => {
      expect(ptzMoveTool.schema.safeParse({ input: 1, direction: 'Up', speed: 2 }).success).toBe(
        false
      );
    });

    it('stop uses PTZMoveStop', async () => {
      await ptzStopTool.handler({ input: 1 }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('PTZMoveStop', { Input: '1' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('home uses PTZHome', async () => {
      await ptzHomeTool.handler({ input: 1 }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('PTZHome', { Input: '1' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });
  });

  describe('zoom', () => {
    it('in/out map to PTZZoomIn / PTZZoomOut with speed', async () => {
      await ptzZoomTool.handler({ input: 1, direction: 'in', speed: 0.8 }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('PTZZoomIn', { Input: '1', Value: '0.8' });

      await ptzZoomTool.handler({ input: 1, direction: 'out', speed: 0.3 }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('PTZZoomOut', { Input: '1', Value: '0.3' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('zoom stop uses PTZZoomStop', async () => {
      await ptzZoomStopTool.handler({ input: 1 }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('PTZZoomStop', { Input: '1' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });
  });

  describe('focus', () => {
    it('near/far map to PTZFocusNear / PTZFocusFar with speed', async () => {
      await ptzFocusTool.handler({ input: 1, direction: 'near', speed: 0.4 }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('PTZFocusNear', { Input: '1', Value: '0.4' });

      await ptzFocusTool.handler({ input: 1, direction: 'far', speed: 0.6 }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('PTZFocusFar', { Input: '1', Value: '0.6' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('focus stop uses PTZFocusStop', async () => {
      await ptzFocusStopTool.handler({ input: 1 }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('PTZFocusStop', { Input: '1' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('auto/manual map to PTZFocusAuto / PTZFocusManual', async () => {
      await ptzFocusAutoTool.handler({ input: 1, enabled: true }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('PTZFocusAuto', { Input: '1' });

      await ptzFocusAutoTool.handler({ input: 1, enabled: false }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('PTZFocusManual', { Input: '1' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });
  });

  describe('virtual PTZ', () => {
    it('create uses PTZCreateVirtualInput', async () => {
      await ptzVirtualCreateTool.handler({ input: 'Wide Shot' }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('PTZCreateVirtualInput', {
        Input: 'Wide Shot',
      });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('update uses PTZUpdateVirtualInput', async () => {
      await ptzVirtualUpdateTool.handler({ input: 5 }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('PTZUpdateVirtualInput', { Input: '5' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });
  });

  it('propagates vMix errors (failure path)', async () => {
    ctx.vmix.http._failOnFunction('PTZMoveStop', new Error('camera offline'));
    await expect(ptzStopTool.handler({ input: 1 }, ctx)).rejects.toThrow('camera offline');
  });
});

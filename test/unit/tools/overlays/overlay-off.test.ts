/**
 * Tests for vmix_overlay_off tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { overlayOffTool } from '../../../../src/tools/overlays/overlay-off.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_overlay_off', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(overlayOffTool.name).toBe('vmix_overlay_off');
  });

  describe('single channel', () => {
    it('turns off overlay channel 1 immediately', async () => {
      await overlayOffTool.handler({ channel: 1 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('OverlayInput1Off', {});
    });

    it('turns off overlay channel 4 immediately', async () => {
      await overlayOffTool.handler({ channel: 4 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('OverlayInput4Off', {});
    });
  });

  describe('all channels', () => {
    it('turns off all overlays when channel is omitted', async () => {
      const params = overlayOffTool.schema.parse({});
      await overlayOffTool.handler(params, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('OverlayInputAllOff', {});
    });
  });

  describe('schema validation', () => {
    it('channel is optional', () => {
      expect(overlayOffTool.schema.safeParse({}).success).toBe(true);
    });

    it('accepts channels 1-4', () => {
      for (let ch = 1; ch <= 4; ch++) {
        expect(overlayOffTool.schema.safeParse({ channel: ch }).success).toBe(true);
      }
    });

    it('rejects channel 0', () => {
      expect(overlayOffTool.schema.safeParse({ channel: 0 }).success).toBe(false);
    });

    it('rejects channel 5', () => {
      expect(overlayOffTool.schema.safeParse({ channel: 5 }).success).toBe(false);
    });
  });

  describe('result messages', () => {
    it('returns channel-specific message', async () => {
      const result = await overlayOffTool.handler({ channel: 2 }, ctx);
      expect(result.content[0]?.text).toContain('channel 2');
      expect(result.content[0]?.text).toContain('off');
    });

    it('returns all-channels message when no channel specified', async () => {
      const params = overlayOffTool.schema.parse({});
      const result = await overlayOffTool.handler(params, ctx);
      expect(result.content[0]?.text).toContain('overlay channels');
      expect(result.content[0]?.text).toContain('off');
    });
  });
});

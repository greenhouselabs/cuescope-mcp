/**
 * Tests for vmix_overlay_out tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { overlayOutTool } from '../../../../src/tools/overlays/overlay-out.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_overlay_out', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(overlayOutTool.name).toBe('vmix_overlay_out');
  });

  describe('basic operation', () => {
    it('hides overlay channel 1 with transition', async () => {
      await overlayOutTool.handler({ channel: 1 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('OverlayInput1Out', {});
    });

    it('hides overlay channel 2 with transition', async () => {
      await overlayOutTool.handler({ channel: 2 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('OverlayInput2Out', {});
    });

    it('hides overlay channel 3 with transition', async () => {
      await overlayOutTool.handler({ channel: 3 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('OverlayInput3Out', {});
    });

    it('hides overlay channel 4 with transition', async () => {
      await overlayOutTool.handler({ channel: 4 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('OverlayInput4Out', {});
    });
  });

  describe('schema validation', () => {
    it('requires channel', () => {
      expect(overlayOutTool.schema.safeParse({}).success).toBe(false);
    });

    it('accepts channels 1-4', () => {
      for (let ch = 1; ch <= 4; ch++) {
        expect(overlayOutTool.schema.safeParse({ channel: ch }).success).toBe(true);
      }
    });

    it('rejects channel 0', () => {
      expect(overlayOutTool.schema.safeParse({ channel: 0 }).success).toBe(false);
    });

    it('rejects channel 5', () => {
      expect(overlayOutTool.schema.safeParse({ channel: 5 }).success).toBe(false);
    });
  });

  describe('result messages', () => {
    it('returns success message with channel number', async () => {
      const result = await overlayOutTool.handler({ channel: 2 }, ctx);
      expect(result.content[0]?.text).toContain('channel 2');
      expect(result.content[0]?.text).toContain('transitioning out');
    });
  });
});

/**
 * Tests for vmix_overlay_in tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { overlayInTool } from '../../../../src/tools/overlays/overlay-in.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_overlay_in', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(overlayInTool.name).toBe('vmix_overlay_in');
  });

  describe('basic operation', () => {
    it('shows input on overlay channel 1', async () => {
      await overlayInTool.handler({ channel: 1, input: 'Logo' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('OverlayInput1In', {
        Input: 'Logo',
      });
    });

    it('shows input on overlay channel 4', async () => {
      await overlayInTool.handler({ channel: 4, input: 'Lower Third' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('OverlayInput4In', {
        Input: 'Lower Third',
      });
    });

    it('handles input by number', async () => {
      await overlayInTool.handler({ channel: 2, input: 5 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('OverlayInput2In', {
        Input: '5',
      });
    });
  });

  describe('mix parameter', () => {
    it('passes mix parameter when specified', async () => {
      await overlayInTool.handler({ channel: 1, input: 'Logo', mix: 2 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('OverlayInput1In', {
        Input: 'Logo',
        Mix: 2,
      });
    });

    it('omits mix parameter when not specified', async () => {
      await overlayInTool.handler({ channel: 1, input: 'Logo' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('OverlayInput1In', {
        Input: 'Logo',
      });
    });
  });

  describe('schema validation', () => {
    it('accepts channels 1-4', () => {
      for (let ch = 1; ch <= 4; ch++) {
        expect(overlayInTool.schema.safeParse({ channel: ch, input: 'Test' }).success).toBe(true);
      }
    });

    it('rejects channel 0', () => {
      expect(overlayInTool.schema.safeParse({ channel: 0, input: 'Test' }).success).toBe(false);
    });

    it('rejects channel 5', () => {
      expect(overlayInTool.schema.safeParse({ channel: 5, input: 'Test' }).success).toBe(false);
    });

    it('accepts mix 0-3', () => {
      for (let mix = 0; mix <= 3; mix++) {
        expect(overlayInTool.schema.safeParse({ channel: 1, input: 'Test', mix }).success).toBe(true);
      }
    });

    it('rejects mix > 3', () => {
      expect(overlayInTool.schema.safeParse({ channel: 1, input: 'Test', mix: 4 }).success).toBe(false);
    });
  });

  describe('result messages', () => {
    it('returns success message', async () => {
      const result = await overlayInTool.handler({ channel: 1, input: 'Logo' }, ctx);
      expect(result.content[0]?.text).toContain('overlay channel 1');
      expect(result.content[0]?.text).toContain('Logo');
    });
  });
});

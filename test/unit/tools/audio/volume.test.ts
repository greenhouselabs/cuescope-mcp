/**
 * Tests for vmix_audio_volume tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { volumeTool } from '../../../../src/tools/audio/volume.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_audio_volume', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(volumeTool.name).toBe('vmix_audio_volume');
  });

  describe('input volume', () => {
    it('sets volume for input by name', async () => {
      await volumeTool.handler({ target: 'Mic', volume: 80 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetVolume', {
        Input: 'Mic',
        Value: 80,
      });
    });

    it('sets volume for input by number', async () => {
      await volumeTool.handler({ target: 1, volume: 50 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetVolume', {
        Input: '1',
        Value: 50,
      });
    });

    it('sets volume with fade', async () => {
      await volumeTool.handler({ target: 'Music', volume: 30, fade_ms: 500 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetVolumeFade', {
        Input: 'Music',
        Value: '30,500',
      });
    });
  });

  describe('master volume', () => {
    it('sets master volume', async () => {
      await volumeTool.handler({ target: 'master', volume: 100 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetMasterVolume', {
        Value: 100,
      });
    });

    it('applies master volume immediately when fade is requested (vMix has no master fade)', async () => {
      const result = await volumeTool.handler({ target: 'master', volume: 50, fade_ms: 1000 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetMasterVolume', {
        Value: 50,
      });
      expect(result.content[0]?.text).toContain('does not support fading master/bus volume');
    });
  });

  describe('bus volume', () => {
    it('sets bus A volume', async () => {
      await volumeTool.handler({ target: 'A', volume: 75 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetBusAVolume', {
        Value: 75,
      });
    });

    it('applies bus volume immediately when fade is requested (vMix has no bus fade)', async () => {
      const result = await volumeTool.handler({ target: 'G', volume: 60, fade_ms: 2000 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetBusGVolume', {
        Value: 60,
      });
      expect(result.content[0]?.text).toContain('does not support fading master/bus volume');
    });

    it('handles all bus letters', async () => {
      const buses = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
      for (const bus of buses) {
        ctx.vmix.http.execute.mockClear();
        await volumeTool.handler({ target: bus, volume: 50 }, ctx);
        expect(ctx.vmix.http.execute).toHaveBeenCalledWith(`SetBus${bus}Volume`, {
          Value: 50,
        });
      }
    });
  });

  describe('schema validation', () => {
    it('accepts volume 0-100', () => {
      expect(volumeTool.schema.safeParse({ target: 'Mic', volume: 0 }).success).toBe(true);
      expect(volumeTool.schema.safeParse({ target: 'Mic', volume: 100 }).success).toBe(true);
    });

    it('rejects volume < 0', () => {
      expect(volumeTool.schema.safeParse({ target: 'Mic', volume: -1 }).success).toBe(false);
    });

    it('rejects volume > 100', () => {
      expect(volumeTool.schema.safeParse({ target: 'Mic', volume: 101 }).success).toBe(false);
    });

    it('accepts fade_ms 0-60000', () => {
      expect(volumeTool.schema.safeParse({ target: 'Mic', volume: 50, fade_ms: 0 }).success).toBe(true);
      expect(volumeTool.schema.safeParse({ target: 'Mic', volume: 50, fade_ms: 60000 }).success).toBe(true);
    });

    it('rejects fade_ms > 60000', () => {
      expect(volumeTool.schema.safeParse({ target: 'Mic', volume: 50, fade_ms: 60001 }).success).toBe(false);
    });
  });
});

/**
 * Tests for vmix_audio_bus tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { busTool } from '../../../../src/tools/audio/bus.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';
import { expectExecutedFunctionsAllowlisted } from '../allowlist-helper.js';

describe('vmix_audio_bus', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(busTool.name).toBe('vmix_audio_bus');
  });

  describe('bus assignment', () => {
    it('routes input to master bus (M) via AudioBusOn with Value=M', async () => {
      await busTool.handler({ input: 'Mic', bus: 'M', enabled: true }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AudioBusOn', {
        Input: 'Mic',
        Value: 'M',
      });
    });

    it('removes input from master bus via AudioBusOff with Value=M', async () => {
      await busTool.handler({ input: 'Mic', bus: 'M', enabled: false }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AudioBusOff', {
        Input: 'Mic',
        Value: 'M',
      });
    });

    it('routes input to bus A', async () => {
      await busTool.handler({ input: 'Music', bus: 'A', enabled: true }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AudioBusOn', {
        Input: 'Music',
        Value: 'A',
      });
    });

    it('removes input from bus G', async () => {
      await busTool.handler({ input: 'Sound FX', bus: 'G', enabled: false }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AudioBusOff', {
        Input: 'Sound FX',
        Value: 'G',
      });
    });

    it('handles input by number', async () => {
      await busTool.handler({ input: 3, bus: 'B', enabled: true }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AudioBusOn', {
        Input: '3',
        Value: 'B',
      });
    });
  });

  describe('all bus letters', () => {
    it('passes each bus letter as Value for routing on', async () => {
      const buses = ['M', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
      for (const bus of buses) {
        ctx.vmix.http.execute.mockClear();
        await busTool.handler({ input: 'Test', bus, enabled: true }, ctx);
        expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AudioBusOn', {
          Input: 'Test',
          Value: bus,
        });
      }
    });

    it('passes each bus letter as Value for routing off', async () => {
      const buses = ['M', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
      for (const bus of buses) {
        ctx.vmix.http.execute.mockClear();
        await busTool.handler({ input: 'Test', bus, enabled: false }, ctx);
        expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AudioBusOff', {
          Input: 'Test',
          Value: bus,
        });
      }
    });
  });

  describe('allowlist compliance', () => {
    it('only executes official vMix function names', async () => {
      const buses = ['M', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
      for (const bus of buses) {
        await busTool.handler({ input: 'Test', bus, enabled: true }, ctx);
        await busTool.handler({ input: 'Test', bus, enabled: false }, ctx);
      }
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });
  });

  describe('schema validation', () => {
    it('requires input', () => {
      expect(busTool.schema.safeParse({ bus: 'A', enabled: true }).success).toBe(false);
    });

    it('requires bus', () => {
      expect(busTool.schema.safeParse({ input: 'Mic', enabled: true }).success).toBe(false);
    });

    it('requires enabled', () => {
      expect(busTool.schema.safeParse({ input: 'Mic', bus: 'A' }).success).toBe(false);
    });

    it('accepts all valid bus letters', () => {
      const buses = ['M', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
      for (const bus of buses) {
        expect(busTool.schema.safeParse({ input: 'Mic', bus, enabled: true }).success).toBe(true);
      }
    });

    it('rejects invalid bus letters', () => {
      expect(busTool.schema.safeParse({ input: 'Mic', bus: 'H', enabled: true }).success).toBe(false);
      expect(busTool.schema.safeParse({ input: 'Mic', bus: 'X', enabled: true }).success).toBe(false);
    });
  });

  describe('error handling', () => {
    it('propagates vMix errors', async () => {
      ctx.vmix.http._failOnFunction('AudioBusOn', new Error('vMix unreachable'));

      await expect(
        busTool.handler({ input: 'Mic', bus: 'A', enabled: true }, ctx)
      ).rejects.toThrow('vMix unreachable');
    });
  });

  describe('result messages', () => {
    it('returns ON message when enabled', async () => {
      const result = await busTool.handler({ input: 'Mic', bus: 'A', enabled: true }, ctx);
      expect(result.content[0]?.text).toContain('routed to');
      expect(result.content[0]?.text).toContain('Bus A');
    });

    it('returns OFF message when disabled', async () => {
      const result = await busTool.handler({ input: 'Mic', bus: 'A', enabled: false }, ctx);
      expect(result.content[0]?.text).toContain('removed from');
      expect(result.content[0]?.text).toContain('Bus A');
    });
  });
});

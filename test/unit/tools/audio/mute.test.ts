/**
 * Tests for vmix_audio_mute tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { muteTool } from '../../../../src/tools/audio/mute.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_audio_mute', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(muteTool.name).toBe('vmix_audio_mute');
  });

  describe('input mute', () => {
    it('toggles input mute by default', async () => {
      const params = muteTool.schema.parse({ target: 'Mic' });
      await muteTool.handler(params, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('Audio', {
        Input: 'Mic',
      });
    });

    it('mutes input (state: on)', async () => {
      await muteTool.handler({ target: 'Mic', state: 'on' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AudioOff', {
        Input: 'Mic',
      });
    });

    it('unmutes input (state: off)', async () => {
      await muteTool.handler({ target: 'Mic', state: 'off' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AudioOn', {
        Input: 'Mic',
      });
    });

    it('handles input by number', async () => {
      await muteTool.handler({ target: 2, state: 'toggle' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('Audio', {
        Input: '2',
      });
    });
  });

  describe('master mute', () => {
    it('toggles master mute', async () => {
      await muteTool.handler({ target: 'master', state: 'toggle' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('MasterAudio', {});
    });

    it('mutes master (state: on)', async () => {
      await muteTool.handler({ target: 'master', state: 'on' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('MasterAudioOff', {});
    });

    it('unmutes master (state: off)', async () => {
      await muteTool.handler({ target: 'master', state: 'off' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('MasterAudioOn', {});
    });
  });

  describe('bus mute', () => {
    it('toggles bus A mute', async () => {
      await muteTool.handler({ target: 'A', state: 'toggle' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('BusAAudio', {});
    });

    it('mutes bus B (state: on)', async () => {
      await muteTool.handler({ target: 'B', state: 'on' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('BusBAudioOff', {});
    });

    it('unmutes bus C (state: off)', async () => {
      await muteTool.handler({ target: 'C', state: 'off' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('BusCAudioOn', {});
    });

    it('handles all bus letters', async () => {
      const buses = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
      for (const bus of buses) {
        ctx.vmix.http.execute.mockClear();
        await muteTool.handler({ target: bus, state: 'toggle' }, ctx);
        expect(ctx.vmix.http.execute).toHaveBeenCalledWith(`Bus${bus}Audio`, {});
      }
    });
  });

  describe('schema validation', () => {
    it('requires target', () => {
      expect(muteTool.schema.safeParse({}).success).toBe(false);
    });

    it('accepts all valid states', () => {
      expect(muteTool.schema.safeParse({ target: 'Mic', state: 'on' }).success).toBe(true);
      expect(muteTool.schema.safeParse({ target: 'Mic', state: 'off' }).success).toBe(true);
      expect(muteTool.schema.safeParse({ target: 'Mic', state: 'toggle' }).success).toBe(true);
    });

    it('defaults state to toggle', () => {
      const result = muteTool.schema.parse({ target: 'Mic' });
      expect(result.state).toBe('toggle');
    });
  });
});

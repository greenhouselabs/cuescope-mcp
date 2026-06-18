/**
 * Tests for vmix_playback tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { playbackTool } from '../../../../src/tools/input/playback.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_playback', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(playbackTool.name).toBe('vmix_playback');
  });

  describe('playback actions', () => {
    it('plays video', async () => {
      await playbackTool.handler({ input: 'Video 1', action: 'play' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('Play', {
        Input: 'Video 1',
      });
    });

    it('pauses video', async () => {
      await playbackTool.handler({ input: 'Video 1', action: 'pause' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('Pause', {
        Input: 'Video 1',
      });
    });

    it('restarts video', async () => {
      await playbackTool.handler({ input: 'Video 1', action: 'restart' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('Restart', {
        Input: 'Video 1',
      });
    });

    it('toggles play/pause', async () => {
      await playbackTool.handler({ input: 'Video 1', action: 'play_pause' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('PlayPause', {
        Input: 'Video 1',
      });
    });
  });

  describe('position control', () => {
    it('sets position before action', async () => {
      await playbackTool.handler({ input: 'Video 1', action: 'play', position_ms: 5000 }, ctx);

      // Position should be set first
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetPosition', {
        Input: 'Video 1',
        Value: 5000,
      });
      // Then action
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('Play', {
        Input: 'Video 1',
      });
    });
  });

  describe('input by number', () => {
    it('handles input by number', async () => {
      await playbackTool.handler({ input: 3, action: 'play' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('Play', {
        Input: '3',
      });
    });
  });

  describe('schema validation', () => {
    it('requires input', () => {
      expect(playbackTool.schema.safeParse({ action: 'play' }).success).toBe(false);
    });

    it('requires action', () => {
      expect(playbackTool.schema.safeParse({ input: 'Video' }).success).toBe(false);
    });

    it('accepts all valid actions', () => {
      const actions = ['play', 'pause', 'restart', 'play_pause'] as const;
      for (const action of actions) {
        expect(playbackTool.schema.safeParse({ input: 'Video', action }).success).toBe(true);
      }
    });

    it('rejects invalid actions', () => {
      expect(playbackTool.schema.safeParse({ input: 'Video', action: 'stop' }).success).toBe(false);
    });

    it('position_ms is optional', () => {
      expect(playbackTool.schema.safeParse({ input: 'Video', action: 'play' }).success).toBe(true);
    });
  });

  describe('result messages', () => {
    it('returns action-specific message', async () => {
      const result = await playbackTool.handler({ input: 'Video 1', action: 'play' }, ctx);
      expect(result.content[0]?.text).toContain('play');
      expect(result.content[0]?.text).toContain('Video 1');
    });
  });
});

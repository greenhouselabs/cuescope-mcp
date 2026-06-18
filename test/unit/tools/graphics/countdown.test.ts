/**
 * Tests for vmix_title_countdown tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { countdownTool } from '../../../../src/tools/graphics/countdown.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_title_countdown', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(countdownTool.name).toBe('vmix_title_countdown');
  });

  describe('countdown actions', () => {
    it('starts countdown', async () => {
      await countdownTool.handler({ input: 'Timer', action: 'start' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('StartCountdown', {
        Input: 'Timer',
      });
    });

    it('stops countdown', async () => {
      await countdownTool.handler({ input: 'Timer', action: 'stop' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('StopCountdown', {
        Input: 'Timer',
      });
    });

    it('pauses countdown', async () => {
      await countdownTool.handler({ input: 'Timer', action: 'pause' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('PauseCountdown', {
        Input: 'Timer',
      });
    });

    it('sets countdown time', async () => {
      await countdownTool.handler({ input: 'Timer', action: 'set', value: '00:05:00' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetCountdown', {
        Input: 'Timer',
        Value: '00:05:00',
      });
    });

    it('adjusts countdown by seconds', async () => {
      await countdownTool.handler({ input: 'Timer', action: 'adjust', value: '-30' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ChangeCountdown', {
        Input: 'Timer',
        Value: '-30',
      });
    });
  });

  describe('input by number', () => {
    it('handles input by number', async () => {
      await countdownTool.handler({ input: 7, action: 'start' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('StartCountdown', {
        Input: '7',
      });
    });
  });

  describe('schema validation', () => {
    it('requires input', () => {
      expect(countdownTool.schema.safeParse({ action: 'start' }).success).toBe(false);
    });

    it('requires action', () => {
      expect(countdownTool.schema.safeParse({ input: 'Timer' }).success).toBe(false);
    });

    it('accepts all valid actions', () => {
      const actions = ['start', 'stop', 'pause', 'set', 'adjust'] as const;
      for (const action of actions) {
        expect(countdownTool.schema.safeParse({ input: 'Timer', action }).success).toBe(true);
      }
    });

    it('rejects invalid actions', () => {
      expect(countdownTool.schema.safeParse({ input: 'Timer', action: 'reset' }).success).toBe(
        false
      );
    });

    it('value is optional', () => {
      expect(countdownTool.schema.safeParse({ input: 'Timer', action: 'start' }).success).toBe(
        true
      );
    });
  });

  describe('result messages', () => {
    it('returns action-specific message', async () => {
      const result = await countdownTool.handler({ input: 'Timer', action: 'start' }, ctx);
      expect(result.content[0]?.text).toContain('start');
    });
  });
});

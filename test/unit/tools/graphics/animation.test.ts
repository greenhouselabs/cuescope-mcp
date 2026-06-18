/**
 * Tests for vmix_title_animation tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { animationTool } from '../../../../src/tools/graphics/animation.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_title_animation', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(animationTool.name).toBe('vmix_title_animation');
  });

  describe('basic operation', () => {
    it('triggers TransitionIn animation', async () => {
      await animationTool.handler({ input: 'Lower Third', animation: 'TransitionIn' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('TitleBeginAnimation', {
        Input: 'Lower Third',
        Value: 'TransitionIn',
      });
    });

    it('triggers TransitionOut animation', async () => {
      await animationTool.handler({ input: 'Title', animation: 'TransitionOut' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('TitleBeginAnimation', {
        Input: 'Title',
        Value: 'TransitionOut',
      });
    });

    it('triggers page animations', async () => {
      await animationTool.handler({ input: 'Score Bug', animation: 'Page1' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('TitleBeginAnimation', {
        Input: 'Score Bug',
        Value: 'Page1',
      });
    });

    it('handles input by number', async () => {
      await animationTool.handler({ input: 4, animation: 'Loop' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('TitleBeginAnimation', {
        Input: '4',
        Value: 'Loop',
      });
    });
  });

  describe('schema validation', () => {
    it('requires input', () => {
      expect(animationTool.schema.safeParse({ animation: 'TransitionIn' }).success).toBe(false);
    });

    it('requires animation', () => {
      expect(animationTool.schema.safeParse({ input: 'Title' }).success).toBe(false);
    });

    it('accepts string input', () => {
      expect(
        animationTool.schema.safeParse({ input: 'Title', animation: 'TransitionIn' }).success
      ).toBe(true);
    });

    it('accepts number input', () => {
      expect(animationTool.schema.safeParse({ input: 1, animation: 'TransitionIn' }).success).toBe(
        true
      );
    });
  });

  describe('result messages', () => {
    it('returns success message with animation name', async () => {
      const result = await animationTool.handler(
        { input: 'Title', animation: 'TransitionIn' },
        ctx
      );
      expect(result.content[0]?.text).toContain('TransitionIn');
    });
  });
});

/**
 * Tests for vmix_switch_transition tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { transitionTool } from '../../../../src/tools/switching/transition.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_switch_transition', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(transitionTool.name).toBe('vmix_switch_transition');
  });

  it('executes specified effect', async () => {
    const result = await transitionTool.handler(
      { input: 'Camera 1', effect: 'Zoom', duration: 1500 },
      ctx
    );

    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('Zoom', {
      Input: 'Camera 1',
      Duration: 1500,
    });
    expect(result.content[0]?.text).toContain('Zoom');
  });

  it('accepts all valid effects', () => {
    const effects = [
      'Fade', 'Zoom', 'Wipe', 'Slide', 'Fly', 'CrossZoom',
      'FlyRotate', 'Cube', 'CubeZoom', 'VerticalWipe', 'VerticalSlide',
      'Merge', 'WipeReverse', 'SlideReverse', 'VerticalWipeReverse', 'VerticalSlideReverse',
    ];

    for (const effect of effects) {
      const result = transitionTool.schema.safeParse({ input: 1, effect, duration: 1000 });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid effect', () => {
    const result = transitionTool.schema.safeParse({ input: 1, effect: 'Invalid', duration: 1000 });
    expect(result.success).toBe(false);
  });
});

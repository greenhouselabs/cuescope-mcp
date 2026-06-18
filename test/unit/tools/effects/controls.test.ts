/**
 * Tests for effects tools. Function names are runtime-composed
 * (Effect<N>, Effect<N>On/Off, SetEffect<N>Strength) — verify every slot
 * 1-4 composes to an allowlisted name.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  effectToggleTool,
  effectOnTool,
  effectOffTool,
  effectStrengthTool,
} from '../../../../src/tools/effects/controls.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';
import { expectExecutedFunctionsAllowlisted } from '../allowlist-helper.js';

describe('effects tools', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it.each([1, 2, 3, 4])('toggle composes Effect%i (allowlisted)', async (effect) => {
    await effectToggleTool.handler({ input: 1, effect }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith(`Effect${effect}`, { Input: '1' });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it.each([1, 2, 3, 4])('on composes Effect%iOn (allowlisted)', async (effect) => {
    await effectOnTool.handler({ input: 1, effect }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith(`Effect${effect}On`, { Input: '1' });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it.each([1, 2, 3, 4])('off composes Effect%iOff (allowlisted)', async (effect) => {
    await effectOffTool.handler({ input: 1, effect }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith(`Effect${effect}Off`, { Input: '1' });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it.each([1, 2, 3, 4])(
    'strength composes SetEffect%iStrength with Value (allowlisted)',
    async (effect) => {
      await effectStrengthTool.handler({ input: 'Camera 1', effect, strength: 0.75 }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith(`SetEffect${effect}Strength`, {
        Input: 'Camera 1',
        Value: '0.75',
      });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    }
  );

  it('rejects effect slots outside 1-4 in the schema', () => {
    expect(effectToggleTool.schema.safeParse({ input: 1, effect: 0 }).success).toBe(false);
    expect(effectToggleTool.schema.safeParse({ input: 1, effect: 5 }).success).toBe(false);
  });

  it('rejects strength outside 0-1 in the schema', () => {
    expect(
      effectStrengthTool.schema.safeParse({ input: 1, effect: 1, strength: 1.5 }).success
    ).toBe(false);
  });

  it('propagates vMix errors (failure path)', async () => {
    ctx.vmix.http._failOnFunction('Effect1On', new Error('effect not configured'));
    await expect(effectOnTool.handler({ input: 1, effect: 1 }, ctx)).rejects.toThrow(
      'effect not configured'
    );
  });
});

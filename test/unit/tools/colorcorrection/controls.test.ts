/**
 * Tests for color correction tools (hue, saturation, lift, gamma, gain,
 * auto, reset).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ccHueTool,
  ccSaturationTool,
  ccLiftTool,
  ccGammaTool,
  ccGainTool,
  ccAutoTool,
  ccResetTool,
} from '../../../../src/tools/colorcorrection/controls.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';
import { expectExecutedFunctionsAllowlisted } from '../allowlist-helper.js';

describe('color correction tools', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('hue executes SetCCHue', async () => {
    await ccHueTool.handler({ input: 1, value: 0.5 }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetCCHue', { Input: '1', Value: '0.5' });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it('saturation executes SetCCSaturation', async () => {
    await ccSaturationTool.handler({ input: 'Camera 1', value: -0.25 }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetCCSaturation', {
      Input: 'Camera 1',
      Value: '-0.25',
    });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it('rejects values outside -1..1 in the schema', () => {
    expect(ccHueTool.schema.safeParse({ input: 1, value: 1.5 }).success).toBe(false);
    expect(ccHueTool.schema.safeParse({ input: 1, value: -1.5 }).success).toBe(false);
  });

  describe.each([
    { label: 'lift', tool: ccLiftTool, fnPrefix: 'SetCCLift' },
    { label: 'gamma', tool: ccGammaTool, fnPrefix: 'SetCCGamma' },
    { label: 'gain', tool: ccGainTool, fnPrefix: 'SetCCGain' },
  ])('$label RGB controls', ({ tool, fnPrefix }) => {
    it('"all" sets R, G and B with the same value', async () => {
      await tool.handler({ input: 1, all: 0.2 }, ctx);

      for (const channel of ['R', 'G', 'B']) {
        expect(ctx.vmix.http.execute).toHaveBeenCalledWith(`${fnPrefix}${channel}`, {
          Input: '1',
          Value: '0.2',
        });
      }
      expect(ctx.vmix.http.execute).toHaveBeenCalledTimes(3);
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('individual channels set only the given channels', async () => {
      await tool.handler({ input: 1, r: 0.1, b: -0.1 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith(`${fnPrefix}R`, { Input: '1', Value: '0.1' });
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith(`${fnPrefix}B`, { Input: '1', Value: '-0.1' });
      expect(ctx.vmix.http.execute).toHaveBeenCalledTimes(2);
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('"all" overrides individual channel values', async () => {
      await tool.handler({ input: 1, all: 0.3, r: 0.9 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith(`${fnPrefix}R`, { Input: '1', Value: '0.3' });
      expect(ctx.vmix.http.execute).not.toHaveBeenCalledWith(`${fnPrefix}R`, {
        Input: '1',
        Value: '0.9',
      });
    });

    it('errors with no values and makes no calls', async () => {
      const result = await tool.handler({ input: 1 }, ctx);
      expect(result.isError).toBe(true);
      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    });
  });

  it('auto executes ColourCorrectionAuto (British spelling per vMix API)', async () => {
    await ccAutoTool.handler({ input: 2 }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ColourCorrectionAuto', { Input: '2' });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it('reset executes ColourCorrectionReset', async () => {
    await ccResetTool.handler({ input: 2 }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ColourCorrectionReset', { Input: '2' });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it('propagates vMix errors (failure path)', async () => {
    ctx.vmix.http._failOnFunction('SetCCHue', new Error('cc unavailable'));
    await expect(ccHueTool.handler({ input: 1, value: 0 }, ctx)).rejects.toThrow('cc unavailable');
  });
});

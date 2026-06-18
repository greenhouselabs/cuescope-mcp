/**
 * Tests for output routing tools (vmix_output_set, vmix_output_fullscreen, vmix_output_external)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  outputSetTool,
  outputFullscreenTool,
  outputExternalTool,
} from '../../../../src/tools/output/routing.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';
import { expectExecutedFunctionsAllowlisted } from '../allowlist-helper.js';

describe('vmix_output_external', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(outputExternalTool.name).toBe('vmix_output_external');
  });

  it('enables external output via StartExternal', async () => {
    await outputExternalTool.handler({ enabled: true }, ctx);

    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('StartExternal');
  });

  it('disables external output via StopExternal', async () => {
    await outputExternalTool.handler({ enabled: false }, ctx);

    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('StopExternal');
  });

  it('does not call the non-existent SetOutputExternal2On/Off functions', async () => {
    await outputExternalTool.handler({ enabled: true }, ctx);
    await outputExternalTool.handler({ enabled: false }, ctx);

    const executed = ctx.vmix.http._getExecutedFunctions();
    expect(executed).not.toContain('SetOutputExternal2On');
    expect(executed).not.toContain('SetOutputExternal2Off');
  });

  it('only executes official vMix function names', async () => {
    await outputExternalTool.handler({ enabled: true }, ctx);
    await outputExternalTool.handler({ enabled: false }, ctx);
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it('returns enabled/disabled messages', async () => {
    const on = await outputExternalTool.handler({ enabled: true }, ctx);
    expect(on.content[0]?.text).toContain('Enabled');

    const off = await outputExternalTool.handler({ enabled: false }, ctx);
    expect(off.content[0]?.text).toContain('Disabled');
  });
});

describe('vmix_output_fullscreen', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('uses FullscreenOn/FullscreenOff', async () => {
    await outputFullscreenTool.handler({ enabled: true }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('FullscreenOn');

    await outputFullscreenTool.handler({ enabled: false }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('FullscreenOff');

    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });
});

describe('vmix_output_set', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('sets output to Preview', async () => {
    await outputSetTool.handler({ output: 2, source: 'Preview' }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetOutput2', { Value: 'Preview' });
  });

  it('sets output to a specific input', async () => {
    await outputSetTool.handler({ output: 3, source: 'Input', input: 'Camera 1' }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetOutput3', {
      Value: 'Input',
      Input: 'Camera 1',
    });
  });

  it('errors when source is Input but no input given', async () => {
    const result = await outputSetTool.handler({ output: 2, source: 'Input' }, ctx);
    expect(result.isError).toBe(true);
    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
  });

  it('rejects output numbers outside 2-4', () => {
    expect(outputSetTool.schema.safeParse({ output: 1, source: 'Preview' }).success).toBe(false);
    expect(outputSetTool.schema.safeParse({ output: 5, source: 'Preview' }).success).toBe(false);
  });
});

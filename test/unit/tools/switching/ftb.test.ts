/**
 * Tests for vmix_switch_ftb tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ftbTool } from '../../../../src/tools/switching/ftb.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_switch_ftb', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(ftbTool.name).toBe('vmix_switch_ftb');
  });

  it('toggles FTB by default', async () => {
    // Parse through schema to apply defaults
    const params = ftbTool.schema.parse({});
    const result = await ftbTool.handler(params, ctx);

    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('FadeToBlack');
    expect(result.content[0]?.text).toContain('toggle');
  });

  it('turns on FTB when state is "on" and currently off', async () => {
    ctx._setStateProperty('fadeToBlack', false);

    await ftbTool.handler({ state: 'on' }, ctx);

    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('FadeToBlack');
  });

  it('does not toggle when state is "on" and already on', async () => {
    ctx._setStateProperty('fadeToBlack', true);

    await ftbTool.handler({ state: 'on' }, ctx);

    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
  });

  it('turns off FTB when state is "off" and currently on', async () => {
    ctx._setStateProperty('fadeToBlack', true);

    await ftbTool.handler({ state: 'off' }, ctx);

    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('FadeToBlack');
  });

  it('does not toggle when state is "off" and already off', async () => {
    ctx._setStateProperty('fadeToBlack', false);

    await ftbTool.handler({ state: 'off' }, ctx);

    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
  });

  it('uses default state of toggle', () => {
    const result = ftbTool.schema.parse({});
    expect(result.state).toBe('toggle');
  });
});

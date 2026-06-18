/**
 * Tests for vmix_switch_cut tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { cutTool } from '../../../../src/tools/switching/cut.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_switch_cut', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name and description', () => {
    expect(cutTool.name).toBe('vmix_switch_cut');
    expect(cutTool.description).toContain('cut');
  });

  it('executes Cut command with input name', async () => {
    const result = await cutTool.handler({ input: 'Camera 1' }, ctx);

    // API calls use the input KEY (GUID) for stability
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('Cut', {
      Input: '{guid-1}',
      Mix: undefined,
    });
    expect(result.content[0]?.text).toContain('Camera 1');
    expect(result.isError).toBeUndefined();
  });

  it('executes Cut command with input number', async () => {
    // Mock state has inputs 1 and 2
    const result = await cutTool.handler({ input: 2 }, ctx);

    // API calls use the input KEY (GUID) for stability
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('Cut', {
      Input: '{guid-2}',
      Mix: undefined,
    });
    expect(result.content[0]?.text).toContain('Camera 2');
  });

  it('includes mix parameter when specified', async () => {
    await cutTool.handler({ input: 1, mix: 2 }, ctx);

    // API calls use the input KEY (GUID) for stability
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('Cut', {
      Input: '{guid-1}',
      Mix: 2,
    });
  });

  it('returns error with suggestions for non-existent input', async () => {
    const result = await cutTool.handler({ input: 'Camra 1' }, ctx); // Typo

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Did you mean');
    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
  });

  it('matches input names case-insensitively', async () => {
    const result = await cutTool.handler({ input: 'camera 1' }, ctx); // lowercase

    // API calls use KEY regardless of how input was specified
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('Cut', {
      Input: '{guid-1}',
      Mix: undefined,
    });
    expect(result.content[0]?.text).toContain('matched case-insensitively');
  });

  it('validates input schema', () => {
    const parseResult = cutTool.schema.safeParse({ input: '' });
    expect(parseResult.success).toBe(false);
  });

  it('validates mix range', () => {
    const parseResult = cutTool.schema.safeParse({ input: 1, mix: 5 });
    expect(parseResult.success).toBe(false);
  });
});

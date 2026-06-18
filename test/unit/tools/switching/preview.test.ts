/**
 * Tests for vmix_switch_preview tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { previewTool } from '../../../../src/tools/switching/preview.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_switch_preview', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(previewTool.name).toBe('vmix_switch_preview');
  });

  it('executes PreviewInput command', async () => {
    const result = await previewTool.handler({ input: 'Camera 2' }, ctx);

    // API calls use the resolved input KEY (GUID) for stability, like cut/fade
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('PreviewInput', {
      Input: '{guid-2}',
      Mix: undefined,
    });
    expect(result.content[0]?.text).toContain('preview');
    expect(result.content[0]?.text).toContain('Camera 2');
  });

  it('includes mix when specified', async () => {
    await previewTool.handler({ input: 1, mix: 1 }, ctx);

    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('PreviewInput', {
      Input: '{guid-1}',
      Mix: 1,
    });
  });

  it('returns error with suggestions for non-existent input', async () => {
    const result = await previewTool.handler({ input: 'Camra 1' }, ctx); // Typo

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Did you mean');
    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
  });

  it('matches input names case-insensitively', async () => {
    const result = await previewTool.handler({ input: 'camera 1' }, ctx);

    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('PreviewInput', {
      Input: '{guid-1}',
      Mix: undefined,
    });
    expect(result.content[0]?.text).toContain('matched case-insensitively');
  });
});

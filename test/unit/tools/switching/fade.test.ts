/**
 * Tests for vmix_switch_fade tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { fadeTool } from '../../../../src/tools/switching/fade.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_switch_fade', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(fadeTool.name).toBe('vmix_switch_fade');
  });

  it('executes Fade command with duration', async () => {
    const result = await fadeTool.handler({ input: 'Camera 1', duration: 2000 }, ctx);

    // API calls use KEY for stability
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('Fade', {
      Input: '{guid-1}',
      Duration: 2000,
      Mix: undefined,
    });
    expect(result.content[0]?.text).toContain('2.0s');
  });

  it('uses default duration of 1000', () => {
    const parseResult = fadeTool.schema.parse({ input: 1 });
    expect(parseResult.duration).toBe(1000);
  });

  it('rejects duration over 10000', () => {
    const parseResult = fadeTool.schema.safeParse({ input: 1, duration: 15000 });
    expect(parseResult.success).toBe(false);
  });
});

/**
 * Tests for vmix_switch_stinger tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { stingerTool } from '../../../../src/tools/switching/stinger.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_switch_stinger', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(stingerTool.name).toBe('vmix_switch_stinger');
  });

  it('executes Stinger1 by default', async () => {
    // Parse through schema to apply defaults
    const params = stingerTool.schema.parse({ input: 'Camera 1' });
    const result = await stingerTool.handler(params, ctx);

    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('Stinger1', {
      Input: 'Camera 1',
    });
    expect(result.content[0]?.text).toContain('Stinger 1');
  });

  it('executes specified stinger number', async () => {
    await stingerTool.handler({ input: 'Camera 1', stinger: 3 }, ctx);

    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('Stinger3', {
      Input: 'Camera 1',
    });
  });

  it('accepts stinger 1-4', () => {
    for (let i = 1; i <= 4; i++) {
      const result = stingerTool.schema.safeParse({ input: 1, stinger: i });
      expect(result.success).toBe(true);
    }
  });

  it('rejects stinger 0 and 5', () => {
    expect(stingerTool.schema.safeParse({ input: 1, stinger: 0 }).success).toBe(false);
    expect(stingerTool.schema.safeParse({ input: 1, stinger: 5 }).success).toBe(false);
  });
});

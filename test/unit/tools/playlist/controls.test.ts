/**
 * Tests for list/playlist tools (VideoList and Photos inputs).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  listAddTool,
  listRemoveTool,
  listClearTool,
  listShuffleTool,
  listNextTool,
  listPreviousTool,
  listSelectTool,
} from '../../../../src/tools/playlist/controls.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';
import { expectExecutedFunctionsAllowlisted } from '../allowlist-helper.js';

describe('playlist/list tools', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('add executes ListAdd with the file path as Value', async () => {
    await listAddTool.handler({ input: 'Playlist', path: 'C:\\Videos\\clip.mp4' }, ctx);

    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ListAdd', {
      Input: 'Playlist',
      Value: 'C:\\Videos\\clip.mp4',
    });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it('remove executes ListRemove with the 0-based index', async () => {
    await listRemoveTool.handler({ input: 1, index: 3 }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ListRemove', { Input: '1', Value: '3' });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it('clear executes ListRemoveAll', async () => {
    await listClearTool.handler({ input: 1 }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ListRemoveAll', { Input: '1' });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it('shuffle executes ListShuffle', async () => {
    await listShuffleTool.handler({ input: 1 }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ListShuffle', { Input: '1' });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it('next/previous use NextItem / PreviousItem (not NextPicture)', async () => {
    await listNextTool.handler({ input: 1 }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('NextItem', { Input: '1' });

    await listPreviousTool.handler({ input: 1 }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('PreviousItem', { Input: '1' });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it('select executes SelectIndex with the 0-based index', async () => {
    await listSelectTool.handler({ input: 1, index: 0 }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SelectIndex', { Input: '1', Value: '0' });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it('rejects negative indexes in the schemas', () => {
    expect(listRemoveTool.schema.safeParse({ input: 1, index: -1 }).success).toBe(false);
    expect(listSelectTool.schema.safeParse({ input: 1, index: -1 }).success).toBe(false);
  });

  it('propagates vMix errors (failure path)', async () => {
    ctx.vmix.http._failOnFunction('ListAdd', new Error('not a list input'));
    await expect(listAddTool.handler({ input: 1, path: 'C:\\x.mp4' }, ctx)).rejects.toThrow(
      'not a list input'
    );
  });
});

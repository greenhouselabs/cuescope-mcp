/**
 * Tests for data source tools. The vMix API composes Value as
 * "name|table[|row]" — a "|" inside a name or table would corrupt the
 * composite, so it must be rejected before any command fires.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  dataNextTool,
  dataPreviousTool,
  dataSelectTool,
  dataAutoNextTool,
  dataPlayPauseTool,
} from '../../../../src/tools/datasource/controls.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';
import { expectExecutedFunctionsAllowlisted } from '../allowlist-helper.js';

describe('data source tools', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('next composes DataSourceNextRow with "name|table"', async () => {
    await dataNextTool.handler({ name: 'Scores', table: 'Sheet1' }, ctx);

    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('DataSourceNextRow', {
      Value: 'Scores|Sheet1',
    });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it('previous composes DataSourcePreviousRow with "name|table"', async () => {
    await dataPreviousTool.handler({ name: 'Scores', table: 'Sheet1' }, ctx);

    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('DataSourcePreviousRow', {
      Value: 'Scores|Sheet1',
    });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it('select composes DataSourceSelectRow with "name|table|row"', async () => {
    await dataSelectTool.handler({ name: 'Scores', table: 'Sheet1', row: 4 }, ctx);

    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('DataSourceSelectRow', {
      Value: 'Scores|Sheet1|4',
    });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it('auto-next maps to DataSourceAutoNextOn / DataSourceAutoNextOff', async () => {
    await dataAutoNextTool.handler({ name: 'S', table: 'T', enabled: true }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('DataSourceAutoNextOn', { Value: 'S|T' });

    await dataAutoNextTool.handler({ name: 'S', table: 'T', enabled: false }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('DataSourceAutoNextOff', { Value: 'S|T' });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it('play/pause map to DataSourcePlay / DataSourcePause (official names)', async () => {
    await dataPlayPauseTool.handler({ name: 'S', table: 'T', action: 'play' }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('DataSourcePlay', { Value: 'S|T' });

    await dataPlayPauseTool.handler({ name: 'S', table: 'T', action: 'pause' }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('DataSourcePause', { Value: 'S|T' });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  describe('separator rejection', () => {
    const tools = [
      { label: 'next', run: (n: string, t: string) => dataNextTool.handler({ name: n, table: t }, ctx) },
      { label: 'previous', run: (n: string, t: string) => dataPreviousTool.handler({ name: n, table: t }, ctx) },
      { label: 'select', run: (n: string, t: string) => dataSelectTool.handler({ name: n, table: t, row: 0 }, ctx) },
      { label: 'auto-next', run: (n: string, t: string) => dataAutoNextTool.handler({ name: n, table: t, enabled: true }, ctx) },
      { label: 'play/pause', run: (n: string, t: string) => dataPlayPauseTool.handler({ name: n, table: t, action: 'play' }, ctx) },
    ];

    it.each(tools)('$label rejects "|" in the data source name', async ({ run }) => {
      const result = await run('Bad|Name', 'Sheet1');
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('"|"');
      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    });

    it.each(tools)('$label rejects "|" in the table name', async ({ run }) => {
      const result = await run('Scores', 'Bad|Table');
      expect(result.isError).toBe(true);
      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    });
  });

  it('propagates vMix errors (failure path)', async () => {
    ctx.vmix.http._failOnFunction('DataSourceNextRow', new Error('no such data source'));
    await expect(dataNextTool.handler({ name: 'S', table: 'T' }, ctx)).rejects.toThrow(
      'no such data source'
    );
  });
});

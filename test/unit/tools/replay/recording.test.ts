/**
 * Tests for replay recording tools - in particular vmix_replay_mark_cancel,
 * which must cancel the pending mark (NOT create an event via ReplayMarkInOut).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  replayRecordTool,
  replayLiveTool,
  replayMarkInTool,
  replayMarkOutTool,
  replayMarkCancelTool,
} from '../../../../src/tools/replay/recording.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';
import { expectExecutedFunctionsAllowlisted } from '../allowlist-helper.js';

describe('vmix_replay_mark_cancel', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(replayMarkCancelTool.name).toBe('vmix_replay_mark_cancel');
  });

  it('executes ReplayMarkCancel', async () => {
    await replayMarkCancelTool.handler({}, ctx);

    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ReplayMarkCancel');
  });

  it('does NOT execute ReplayMarkInOut (which would create an event)', async () => {
    await replayMarkCancelTool.handler({}, ctx);

    expect(ctx.vmix.http._getExecutedFunctions()).not.toContain('ReplayMarkInOut');
  });

  it('returns a cancellation message', async () => {
    const result = await replayMarkCancelTool.handler({}, ctx);
    expect(result.content[0]?.text).toContain('Cancelled');
  });
});

describe('other replay recording tools', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('replay record start/stop use ReplayStartRecording/ReplayStopRecording', async () => {
    await replayRecordTool.handler({ action: 'start' }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ReplayStartRecording');

    await replayRecordTool.handler({ action: 'stop' }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ReplayStopRecording');
  });

  it('replay live uses ReplayLive', async () => {
    await replayLiveTool.handler({}, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ReplayLive');
  });

  it('mark in/out use ReplayMarkIn/ReplayMarkOut', async () => {
    await replayMarkInTool.handler({}, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ReplayMarkIn');

    await replayMarkOutTool.handler({}, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ReplayMarkOut');
  });

  it('only executes official vMix function names', async () => {
    await replayRecordTool.handler({ action: 'start' }, ctx);
    await replayRecordTool.handler({ action: 'stop' }, ctx);
    await replayLiveTool.handler({}, ctx);
    await replayMarkInTool.handler({}, ctx);
    await replayMarkOutTool.handler({}, ctx);
    await replayMarkCancelTool.handler({}, ctx);
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });
});

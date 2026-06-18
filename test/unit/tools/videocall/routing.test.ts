/**
 * Tests for vMix Call routing tools (audio/video source sent to callers).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  callAudioSourceTool,
  callVideoSourceTool,
} from '../../../../src/tools/videocall/routing.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';
import { expectExecutedFunctionsAllowlisted } from '../allowlist-helper.js';

describe('video call routing tools', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('sets caller audio via VideoCallAudioSource', async () => {
    await callAudioSourceTool.handler({ input: 'Guest 1', source: 'BusA' }, ctx);

    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('VideoCallAudioSource', {
      Input: 'Guest 1',
      Value: 'BusA',
    });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it('sets caller video via VideoCallVideoSource', async () => {
    await callVideoSourceTool.handler({ input: 1, source: 'Output2' }, ctx);

    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('VideoCallVideoSource', {
      Input: '1',
      Value: 'Output2',
    });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it('rejects unknown audio sources in the schema', () => {
    expect(callAudioSourceTool.schema.safeParse({ input: 1, source: 'BusZ' }).success).toBe(false);
    expect(callAudioSourceTool.schema.safeParse({ input: 1, source: 'Master' }).success).toBe(true);
  });

  it('rejects unknown video outputs in the schema', () => {
    expect(callVideoSourceTool.schema.safeParse({ input: 1, source: 'Output5' }).success).toBe(
      false
    );
  });

  it('propagates vMix errors (failure path)', async () => {
    ctx.vmix.http._failOnFunction('VideoCallAudioSource', new Error('not a call input'));
    await expect(
      callAudioSourceTool.handler({ input: 1, source: 'Master' }, ctx)
    ).rejects.toThrow('not a call input');
  });
});

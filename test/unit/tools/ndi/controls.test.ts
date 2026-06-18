/**
 * Tests for NDI tools: source selection (by name/index), commands, recording.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ndiSelectSourceTool,
  ndiSelectIndexTool,
  ndiCommandTool,
  ndiRecordingTool,
} from '../../../../src/tools/ndi/controls.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';
import { expectExecutedFunctionsAllowlisted } from '../allowlist-helper.js';

describe('NDI tools', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('selects a source by name via NDISelectSourceByName', async () => {
    await ndiSelectSourceTool.handler({ input: 'NDI Cam', source: 'STUDIO-PC (OBS)' }, ctx);

    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('NDISelectSourceByName', {
      Input: 'NDI Cam',
      Value: 'STUDIO-PC (OBS)',
    });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it('selects a source by 0-based index via NDISelectSourceByIndex', async () => {
    await ndiSelectIndexTool.handler({ input: 1, index: 0 }, ctx);

    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('NDISelectSourceByIndex', {
      Input: '1',
      Value: '0',
    });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it('rejects negative indexes in the schema', () => {
    expect(ndiSelectIndexTool.schema.safeParse({ input: 1, index: -1 }).success).toBe(false);
  });

  it('sends raw commands via NDICommand', async () => {
    await ndiCommandTool.handler({ input: 1, command: 'PTZ_HOME' }, ctx);

    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('NDICommand', {
      Input: '1',
      Value: 'PTZ_HOME',
    });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it('start/stop recording map to NDIStartRecording / NDIStopRecording', async () => {
    await ndiRecordingTool.handler({ input: 1, action: 'start' }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('NDIStartRecording', { Input: '1' });

    await ndiRecordingTool.handler({ input: 1, action: 'stop' }, ctx);
    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('NDIStopRecording', { Input: '1' });
    expectExecutedFunctionsAllowlisted(ctx.vmix.http);
  });

  it('propagates vMix errors (failure path)', async () => {
    ctx.vmix.http._failOnFunction('NDIStartRecording', new Error('not an NDI input'));
    await expect(ndiRecordingTool.handler({ input: 1, action: 'start' }, ctx)).rejects.toThrow(
      'not an NDI input'
    );
  });
});

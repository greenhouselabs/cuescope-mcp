/**
 * Tests for vmix_record tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { recordTool } from '../../../../src/tools/recording/record.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_record', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(recordTool.name).toBe('vmix_record');
  });

  describe('recording actions', () => {
    it('starts recording', async () => {
      await recordTool.handler({ action: 'start' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('StartRecording', {});
    });

    it('stops recording', async () => {
      await recordTool.handler({ action: 'stop' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('StopRecording', {});
    });

    it('toggles recording', async () => {
      const params = recordTool.schema.parse({});
      await recordTool.handler(params, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('StartStopRecording', {});
    });
  });

  describe('schema validation', () => {
    it('defaults action to toggle', () => {
      const result = recordTool.schema.parse({});
      expect(result.action).toBe('toggle');
    });

    it('accepts all valid actions', () => {
      expect(recordTool.schema.safeParse({ action: 'start' }).success).toBe(true);
      expect(recordTool.schema.safeParse({ action: 'stop' }).success).toBe(true);
      expect(recordTool.schema.safeParse({ action: 'toggle' }).success).toBe(true);
    });

    it('rejects invalid actions', () => {
      expect(recordTool.schema.safeParse({ action: 'pause' }).success).toBe(false);
    });
  });

  describe('result messages', () => {
    it('returns action-specific message', async () => {
      const result = await recordTool.handler({ action: 'start' }, ctx);
      expect(result.content[0]?.text).toContain('Recording started');
    });
  });
});

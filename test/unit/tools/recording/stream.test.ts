/**
 * Tests for vmix_stream tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { streamTool } from '../../../../src/tools/recording/stream.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_stream', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(streamTool.name).toBe('vmix_stream');
  });

  describe('streaming actions', () => {
    it('starts stream 0 by default', async () => {
      const params = streamTool.schema.parse({ action: 'start' });
      await streamTool.handler(params, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('StartStreaming', {
        Value: 0,
      });
    });

    it('starts specified stream', async () => {
      await streamTool.handler({ action: 'start', stream: 1 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('StartStreaming', {
        Value: 1,
      });
    });

    it('stops stream', async () => {
      await streamTool.handler({ action: 'stop', stream: 2 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('StopStreaming', {
        Value: 2,
      });
    });

    it('toggles stream', async () => {
      const params = streamTool.schema.parse({});
      await streamTool.handler(params, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('StartStopStreaming', {
        Value: 0,
      });
    });
  });

  describe('schema validation', () => {
    it('defaults action to toggle', () => {
      const result = streamTool.schema.parse({});
      expect(result.action).toBe('toggle');
    });

    it('defaults stream to 0', () => {
      const result = streamTool.schema.parse({});
      expect(result.stream).toBe(0);
    });

    it('accepts stream 0-2', () => {
      expect(streamTool.schema.safeParse({ stream: 0 }).success).toBe(true);
      expect(streamTool.schema.safeParse({ stream: 1 }).success).toBe(true);
      expect(streamTool.schema.safeParse({ stream: 2 }).success).toBe(true);
    });

    it('rejects stream < 0', () => {
      expect(streamTool.schema.safeParse({ stream: -1 }).success).toBe(false);
    });

    it('rejects stream > 2', () => {
      expect(streamTool.schema.safeParse({ stream: 3 }).success).toBe(false);
    });
  });

  describe('result messages', () => {
    it('returns action-specific message with stream number', async () => {
      const result = await streamTool.handler({ action: 'start', stream: 1 }, ctx);
      expect(result.content[0]?.text).toContain('Stream 1');
      expect(result.content[0]?.text).toContain('LIVE');
    });
  });
});

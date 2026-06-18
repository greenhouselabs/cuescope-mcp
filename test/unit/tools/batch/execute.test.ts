/**
 * Tests for vmix_batch tool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { batchTool } from '../../../../src/tools/batch/execute.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_batch', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('has correct name', () => {
    expect(batchTool.name).toBe('vmix_batch');
  });

  describe('executing commands', () => {
    it('executes a single command', async () => {
      const commands = [{ function: 'Cut', params: { Input: 'Camera 1' } }];

      const promise = batchTool.handler({ commands, stop_on_error: true }, ctx);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('Cut', { Input: 'Camera 1' });
      expect(result.content[0]?.text).toContain('Cut');
    });

    it('executes multiple commands in sequence', async () => {
      const commands = [
        { function: 'Cut', params: { Input: 'Camera 1' } },
        { function: 'SetVolume', params: { Input: 'Music', Value: 50 } },
        { function: 'OverlayInput1In', params: { Input: 'Logo' } },
      ];

      const promise = batchTool.handler({ commands, stop_on_error: true }, ctx);
      await vi.runAllTimersAsync();
      await promise;

      expect(ctx.vmix.http.execute).toHaveBeenCalledTimes(3);
      expect(ctx.vmix.http.execute).toHaveBeenNthCalledWith(1, 'Cut', { Input: 'Camera 1' });
      expect(ctx.vmix.http.execute).toHaveBeenNthCalledWith(2, 'SetVolume', {
        Input: 'Music',
        Value: 50,
      });
      expect(ctx.vmix.http.execute).toHaveBeenNthCalledWith(3, 'OverlayInput1In', {
        Input: 'Logo',
      });
    });

    it('handles commands without params', async () => {
      const commands = [{ function: 'StartRecording' }];

      const promise = batchTool.handler({ commands, stop_on_error: true }, ctx);
      await vi.runAllTimersAsync();
      await promise;

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('StartRecording', {});
    });
  });

  describe('delay handling', () => {
    it('waits after command with delay_after', async () => {
      const commands = [
        { function: 'Cut', params: { Input: 'Camera 1' }, delay_after: 1000 },
        { function: 'Cut', params: { Input: 'Camera 2' } },
      ];

      const promise = batchTool.handler({ commands, stop_on_error: true }, ctx);
      await vi.runAllTimersAsync();
      await promise;

      // Both commands should have been called
      expect(ctx.vmix.http.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('stops on error when stop_on_error is true', async () => {
      ctx.vmix.http.execute.mockRejectedValueOnce(new Error('Command failed'));

      // Function names must be real vMix functions - unknown names are rejected
      // before execution, so the failure here comes from the injected error.
      const commands = [
        { function: 'Fade' },
        { function: 'Cut', params: { Input: 'Camera 1' } },
      ];

      const promise = batchTool.handler({ commands, stop_on_error: true }, ctx);
      await vi.runAllTimersAsync();
      const result = await promise;

      // Second command should not be called
      expect(ctx.vmix.http.execute).toHaveBeenCalledTimes(1);
      expect(result.content[0]?.text).toContain('failed');
    });

    it('continues on error when stop_on_error is false', async () => {
      ctx.vmix.http.execute.mockRejectedValueOnce(new Error('Command failed'));

      const commands = [
        { function: 'Fade' },
        { function: 'Cut', params: { Input: 'Camera 1' } },
      ];

      const promise = batchTool.handler({ commands, stop_on_error: false }, ctx);
      await vi.runAllTimersAsync();
      const result = await promise;

      // Both commands should be attempted
      expect(ctx.vmix.http.execute).toHaveBeenCalledTimes(2);
      expect(result.content[0]?.text).toContain('1 error');
    });

    it('rejects unknown function names without executing anything', async () => {
      const commands = [
        { function: 'NotARealFunction' },
        { function: 'Cut', params: { Input: 'Camera 1' } },
      ];

      const promise = batchTool.handler({ commands, stop_on_error: true }, ctx);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('NotARealFunction');
    });
  });

  describe('schema validation', () => {
    it('requires commands array', () => {
      expect(batchTool.schema.safeParse({}).success).toBe(false);
    });

    it('rejects an empty commands array', () => {
      expect(batchTool.schema.safeParse({ commands: [] }).success).toBe(false);
    });

    it('rejects more than 50 commands', () => {
      const commands = Array.from({ length: 51 }, () => ({ function: 'Cut' }));
      expect(batchTool.schema.safeParse({ commands }).success).toBe(false);
    });

    it('validates command structure', () => {
      expect(
        batchTool.schema.safeParse({
          commands: [{ function: 'Cut' }],
        }).success
      ).toBe(true);
    });

    it('defaults stop_on_error to true', () => {
      const result = batchTool.schema.parse({ commands: [{ function: 'Cut' }] });
      expect(result.stop_on_error).toBe(true);
    });
  });

  describe('result messages', () => {
    it('summarizes executed commands', async () => {
      const commands = [
        { function: 'Cut', params: { Input: 'Camera 1' } },
        { function: 'SetVolume', params: { Input: 'Music', Value: 50 } },
      ];

      const promise = batchTool.handler({ commands, stop_on_error: true }, ctx);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.content[0]?.text).toContain('2');
      expect(result.content[0]?.text).toContain('Cut');
      expect(result.content[0]?.text).toContain('SetVolume');
    });
  });
});

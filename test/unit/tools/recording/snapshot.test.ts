/**
 * Tests for vmix_snapshot tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { snapshotTool } from '../../../../src/tools/recording/snapshot.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_snapshot', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(snapshotTool.name).toBe('vmix_snapshot');
  });

  describe('program output snapshot', () => {
    it('captures program output when no input specified', async () => {
      const params = snapshotTool.schema.parse({});
      await snapshotTool.handler(params, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('Snapshot', {});
    });

    it('captures program output with custom filename', async () => {
      await snapshotTool.handler({ filename: 'my-capture' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('Snapshot', {
        Value: 'my-capture',
      });
    });
  });

  describe('input snapshot', () => {
    it('captures specific input by name', async () => {
      await snapshotTool.handler({ input: 'Camera 1' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SnapshotInput', {
        Input: 'Camera 1',
      });
    });

    it('captures specific input by number', async () => {
      await snapshotTool.handler({ input: 3 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SnapshotInput', {
        Input: '3',
      });
    });

    it('captures input with custom filename', async () => {
      await snapshotTool.handler({ input: 'Camera 1', filename: 'cam1-snap' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SnapshotInput', {
        Input: 'Camera 1',
        Value: 'cam1-snap',
      });
    });
  });

  describe('schema validation', () => {
    it('input is optional', () => {
      expect(snapshotTool.schema.safeParse({}).success).toBe(true);
    });

    it('filename is optional', () => {
      expect(snapshotTool.schema.safeParse({}).success).toBe(true);
    });

    it('accepts string input', () => {
      expect(snapshotTool.schema.safeParse({ input: 'Camera 1' }).success).toBe(true);
    });

    it('accepts number input', () => {
      expect(snapshotTool.schema.safeParse({ input: 1 }).success).toBe(true);
    });
  });

  describe('result messages', () => {
    it('returns program message when no input', async () => {
      const params = snapshotTool.schema.parse({});
      const result = await snapshotTool.handler(params, ctx);
      expect(result.content[0]?.text).toContain('program');
    });

    it('returns input-specific message', async () => {
      const result = await snapshotTool.handler({ input: 'Camera 1' }, ctx);
      expect(result.content[0]?.text).toContain('Camera 1');
    });
  });
});

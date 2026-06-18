/**
 * Tests for vmix_script_stop tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { stopScriptTool } from '../../../../src/tools/scripting/stop.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_script_stop', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(stopScriptTool.name).toBe('vmix_script_stop');
  });

  describe('stopping named scripts', () => {
    it('stops a specific script by name', async () => {
      await stopScriptTool.handler({ name: 'MyScript', stop_dynamic: false }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ScriptStop', {
        Value: 'MyScript',
      });
      expect(ctx.vmix.http.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopping all scripts', () => {
    it('stops all scripts when no name specified', async () => {
      const params = stopScriptTool.schema.parse({});
      await stopScriptTool.handler(params, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ScriptStopAll', {});
    });
  });

  describe('stopping dynamic scripts', () => {
    it('also stops dynamic scripts by default', async () => {
      const params = stopScriptTool.schema.parse({});
      await stopScriptTool.handler(params, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ScriptStopDynamic', {});
    });

    it('skips dynamic stop when stop_dynamic is false', async () => {
      await stopScriptTool.handler({ stop_dynamic: false }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ScriptStopAll', {});
      expect(ctx.vmix.http.execute).not.toHaveBeenCalledWith('ScriptStopDynamic', {});
    });

    it('stops both named and dynamic scripts', async () => {
      await stopScriptTool.handler({ name: 'MyScript', stop_dynamic: true }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ScriptStop', {
        Value: 'MyScript',
      });
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ScriptStopDynamic', {});
    });
  });

  describe('schema validation', () => {
    it('name is optional', () => {
      expect(stopScriptTool.schema.safeParse({}).success).toBe(true);
    });

    it('stop_dynamic defaults to true', () => {
      const result = stopScriptTool.schema.parse({});
      expect(result.stop_dynamic).toBe(true);
    });
  });

  describe('result messages', () => {
    it('returns named script message', async () => {
      const result = await stopScriptTool.handler({ name: 'MyScript', stop_dynamic: false }, ctx);
      expect(result.content[0]?.text).toContain('MyScript');
    });

    it('returns all scripts message', async () => {
      const params = stopScriptTool.schema.parse({});
      const result = await stopScriptTool.handler(params, ctx);
      expect(result.content[0]?.text).toContain('All scripts');
    });
  });
});

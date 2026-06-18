/**
 * Tests for vmix_script_run tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { runScriptTool } from '../../../../src/tools/scripting/run.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_script_run', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(runScriptTool.name).toBe('vmix_script_run');
  });

  it('describes itself as High-Impact Control execution', () => {
    expect(runScriptTool.description).toContain('High-Impact Control only');
    expect(runScriptTool.description).toContain('vmix_generate_script');
  });

  describe('running named scripts', () => {
    it('runs a named script', async () => {
      await runScriptTool.handler({ name: 'MyScript' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ScriptStart', {
        Value: 'MyScript',
      });
    });
  });

  describe('running inline code', () => {
    it('runs valid inline VB.NET code', async () => {
      const code = 'API.Function("Cut")';
      await runScriptTool.handler({ code }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ScriptStartDynamic', {
        Value: code,
      });
    });

    it('validates code before running', async () => {
      // Valid code with potential style issues (warnings don't block execution)
      const code = 'Dim x As String\nx = "test"';
      await runScriptTool.handler({ code }, ctx);

      // Should execute since there are no errors
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ScriptStartDynamic', {
        Value: code,
      });
    });

    it('rejects invalid code with errors', async () => {
      // Loop without Sleep - this is an error
      const code = `Do While True
API.Function("Cut")
Loop`;
      const result = await runScriptTool.handler({ code }, ctx);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Sleep');
      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    });
  });

  describe('schema validation', () => {
    it('accepts name parameter', () => {
      expect(runScriptTool.schema.safeParse({ name: 'MyScript' }).success).toBe(true);
    });

    it('accepts code parameter', () => {
      expect(runScriptTool.schema.safeParse({ code: 'API.Function("Cut")' }).success).toBe(true);
    });

    it('accepts both parameters', () => {
      expect(
        runScriptTool.schema.safeParse({ name: 'MyScript', code: 'API.Function("Cut")' }).success
      ).toBe(true);
    });
  });

  describe('error handling', () => {
    it('requires at least one of name or code', async () => {
      const result = await runScriptTool.handler({}, ctx);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('name');
      expect(result.content[0]?.text).toContain('code');
    });
  });

  describe('result messages', () => {
    it('returns success message for named script', async () => {
      const result = await runScriptTool.handler({ name: 'MyScript' }, ctx);
      expect(result.content[0]?.text).toContain('MyScript');
    });

    it('returns success message for inline code', async () => {
      const result = await runScriptTool.handler({ code: 'API.Function("Cut")' }, ctx);
      expect(result.content[0]?.text).toContain('Script started');
    });
  });
});

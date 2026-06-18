/**
 * Tests for vmix_script_run_file
 * Path resolution, missing-file handling, and the validation gate that must
 * block execution of bad scripts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { runScriptFileTool } from '../../../../src/tools/scripting/run-file.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

function enoent(): NodeJS.ErrnoException {
  const err: NodeJS.ErrnoException = new Error('no such file');
  err.code = 'ENOENT';
  return err;
}

describe('vmix_script_run_file', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
    vi.clearAllMocks();
  });

  it('has correct name', () => {
    expect(runScriptFileTool.name).toBe('vmix_script_run_file');
  });

  describe('path resolution', () => {
    it('resolves a bare name to Documents/vmix-scripts/<name>.txt', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('API.Function("Cut", Input:="Camera 1")');

      await runScriptFileTool.handler({ file: 'camera-cycle' }, ctx);

      const requested = String(vi.mocked(fs.readFile).mock.calls[0]?.[0]);
      expect(requested).toContain(path.join('Documents', 'vmix-scripts'));
      expect(requested.endsWith('camera-cycle.txt')).toBe(true);
    });

    it('does not double the .txt extension', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('API.Function("Cut")');

      await runScriptFileTool.handler({ file: 'myscript.txt' }, ctx);

      const requested = String(vi.mocked(fs.readFile).mock.calls[0]?.[0]);
      expect(requested.endsWith('myscript.txt')).toBe(true);
      expect(requested.endsWith('myscript.txt.txt')).toBe(false);
    });

    it('uses a full path verbatim when separators are present', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('API.Function("Cut")');

      await runScriptFileTool.handler({ file: 'C:\\Scripts\\custom.txt' }, ctx);

      expect(vi.mocked(fs.readFile).mock.calls[0]?.[0]).toBe('C:\\Scripts\\custom.txt');
    });
  });

  describe('read failures', () => {
    it('reports a missing file without executing anything', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(enoent());

      const result = await runScriptFileTool.handler({ file: 'nope' }, ctx);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Script file not found');
      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    });

    it('reports other read errors distinctly', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await runScriptFileTool.handler({ file: 'locked' }, ctx);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Failed to read script file');
      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    });

    it('rejects a file containing only comments', async () => {
      vi.mocked(fs.readFile).mockResolvedValue("' just a header\n' nothing else\n\n");

      const result = await runScriptFileTool.handler({ file: 'comments-only' }, ctx);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('empty or contains only comments');
      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    });
  });

  describe('validation gate', () => {
    it('blocks execution when the script fails validation', async () => {
      // Infinite loop without Sleep() would freeze vMix
      vi.mocked(fs.readFile).mockResolvedValue('Do While True\nAPI.Function("Cut")\nLoop');

      const result = await runScriptFileTool.handler({ file: 'freezer' }, ctx);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('validation failed - not executed');
      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    });

    it('surfaces warnings while still running a valid script', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('Dim msg As String = "Hello " + name\nAPI.Function("Cut")');

      const result = await runScriptFileTool.handler({ file: 'warned' }, ctx);

      expect(result.isError).toBeFalsy();
      expect(result.content[0]?.text).toContain('Warnings:');
      expect(ctx.vmix.http.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('execution', () => {
    it('strips header comments and executes the remaining code via ScriptStartDynamic', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        "' vMix Script: test\n' header line\n\nAPI.Function(\"Cut\", Input:=\"Camera 1\")"
      );

      const result = await runScriptFileTool.handler({ file: 'with-header' }, ctx);

      expect(result.isError).toBeFalsy();
      const call = ctx.vmix.http._getExecutedCalls()[0]!;
      expect(call.func).toBe('ScriptStartDynamic');
      expect(call.params?.['Value']).toBe('API.Function("Cut", Input:="Camera 1")');
      expect(result.content[0]?.text).toContain('loaded and running');
    });

    it('reports vMix execution failure (failure path)', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('API.Function("Cut")');
      ctx.vmix.http._failOnFunction('ScriptStartDynamic', new Error('connection refused'));

      const result = await runScriptFileTool.handler({ file: 'ok-script' }, ctx);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Failed to execute script');
      expect(result.content[0]?.text).toContain('connection refused');
    });
  });
});

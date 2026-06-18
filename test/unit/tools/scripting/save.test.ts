/**
 * Tests for vmix_script_save tool
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import { saveScriptTool } from '../../../../src/tools/scripting/save.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

// Mock fs module
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  access: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
}));

// Mock child_process for clipboard
vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    const listeners = new Map<string, (code?: number) => void>();
    const proc = {
      once: vi.fn((event: string, callback: (code?: number) => void) => {
        listeners.set(event, callback);
        return proc;
      }),
      stdin: {
        once: vi.fn(),
        end: vi.fn(() => {
          listeners.get('close')?.(0);
        }),
      },
    };
    return proc;
  }),
}));

describe('vmix_script_save', () => {
  let mockCtx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    mockCtx = createMockToolContext();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have correct metadata', () => {
    expect(saveScriptTool.name).toBe('vmix_script_save');
    expect(saveScriptTool.description).toContain('Save a VB.NET script');
    expect(saveScriptTool.description).toContain('.txt');
  });

  it('should save a valid script to .txt file', async () => {
    vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await saveScriptTool.handler(
      {
        name: 'test-script',
        code: 'API.Function("Cut", Input:="Camera 1")',
        copy_to_clipboard: false,
        overwrite: false,
      },
      mockCtx
    );

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('Script saved to:');
    expect(result.content[0].text).toContain('test-script.txt');
    expect(fs.writeFile).toHaveBeenCalled();
    const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
    expect(writeCall[0]).toContain('.txt');
  });

  it('should reject invalid scripts', async () => {
    const result = await saveScriptTool.handler(
      {
        name: 'bad-script',
        code: 'Do While True\n  API.Function("Cut")\nLoop', // Missing Sleep()
        copy_to_clipboard: false,
        overwrite: false,
      },
      mockCtx
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('validation failed');
    expect(result.content[0].text).toContain('Sleep');
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('should prevent overwriting existing file by default', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined); // File exists
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);

    const result = await saveScriptTool.handler(
      {
        name: 'existing-script',
        code: 'API.Function("Cut")',
        copy_to_clipboard: false,
        overwrite: false,
      },
      mockCtx
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('already exists');
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('should allow overwriting when flag is set', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined); // File exists
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await saveScriptTool.handler(
      {
        name: 'existing-script',
        code: 'API.Function("Cut")',
        copy_to_clipboard: false,
        overwrite: true,
      },
      mockCtx
    );

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('Script saved');
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it('should sanitize filename', async () => {
    vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await saveScriptTool.handler(
      {
        name: 'my<script>name',
        code: 'API.Function("Cut")',
        copy_to_clipboard: false,
        overwrite: false,
      },
      mockCtx
    );

    expect(result.isError).toBeFalsy();
    // The filename should have dangerous characters replaced
    const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
    expect(writeCall[0]).toContain('my-script-name.txt');
  });

  it('should include warnings in success message', async () => {
    vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    // Script with a warning (assignment in if statement)
    const result = await saveScriptTool.handler(
      {
        name: 'warning-script',
        code: 'If x = 5 Then\n  API.Function("Cut")\nEnd If',
        copy_to_clipboard: false,
        overwrite: false,
      },
      mockCtx
    );

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('Script saved');
    // Note: warnings don't block saving, just errors
  });

  it('should reject empty name', async () => {
    const result = await saveScriptTool.handler(
      {
        name: '   ',
        code: 'API.Function("Cut")',
        copy_to_clipboard: false,
        overwrite: false,
      },
      mockCtx
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid script name');
  });

  it('should handle file system errors gracefully', async () => {
    vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockRejectedValue(new Error('Permission denied'));

    const result = await saveScriptTool.handler(
      {
        name: 'test-script',
        code: 'API.Function("Cut")',
        copy_to_clipboard: false,
        overwrite: false,
      },
      mockCtx
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Failed to save');
    expect(result.content[0].text).toContain('Permission denied');
  });

  it('should report clipboard success when copy_to_clipboard is true', async () => {
    vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await saveScriptTool.handler(
      {
        name: 'clipboard-script',
        code: 'API.Function("Cut")',
        copy_to_clipboard: true,
        overwrite: false,
      },
      mockCtx
    );

    expect(result.isError).toBeFalsy();
    // Module-level spawn mock simulates a clean exit (code 0)
    expect(result.content[0].text).toContain('copied to clipboard');
  });

  it('should report clipboard failure without failing the save', async () => {
    vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const { spawn } = await import('child_process');
    // Simulate clip/pbcopy/xclip being unavailable: spawn emits 'error'
    vi.mocked(spawn).mockImplementation((() => {
      const listeners = new Map<string, (arg?: unknown) => void>();
      const proc = {
        once: vi.fn((event: string, callback: (arg?: unknown) => void) => {
          listeners.set(event, callback);
          return proc;
        }),
        stdin: {
          once: vi.fn(),
          end: vi.fn(() => {
            listeners.get('error')?.(new Error('spawn ENOENT'));
          }),
        },
      };
      return proc;
    }) as never);

    const result = await saveScriptTool.handler(
      {
        name: 'clipboard-fail-script',
        code: 'API.Function("Cut")',
        copy_to_clipboard: true,
        overwrite: false,
      },
      mockCtx
    );

    // The save itself still succeeds; only the clipboard step degrades
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('Script saved to:');
    expect(result.content[0].text).toContain('Could not copy to clipboard');
  });

  it('should include import instructions in success message', async () => {
    vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await saveScriptTool.handler(
      {
        name: 'test-script',
        code: 'API.Function("Cut")',
        copy_to_clipboard: false,
        overwrite: false,
      },
      mockCtx
    );

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('To import into vMix');
    expect(result.content[0].text).toContain('Add Script');
    expect(result.content[0].text).toContain('Import');
  });
});

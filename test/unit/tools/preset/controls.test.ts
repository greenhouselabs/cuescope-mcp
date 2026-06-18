/**
 * Tests for preset tools: open/save (.vmix extension validation, overwrite
 * warning) and last-preset.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  presetOpenTool,
  presetSaveTool,
  presetLastTool,
} from '../../../../src/tools/preset/controls.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';
import { expectExecutedFunctionsAllowlisted } from '../allowlist-helper.js';

describe('preset tools', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  describe('vmix_preset_open', () => {
    it('executes OpenPreset with the .vmix path as Value', async () => {
      const result = await presetOpenTool.handler({ path: 'C:\\Presets\\show.vmix' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('OpenPreset', {
        Value: 'C:\\Presets\\show.vmix',
      });
      expect(result.isError).toBeUndefined();
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('accepts .vmix case-insensitively and with trailing whitespace', async () => {
      const result = await presetOpenTool.handler({ path: 'C:\\Presets\\SHOW.VMIX ' }, ctx);
      expect(result.isError).toBeUndefined();
      expect(ctx.vmix.http.execute).toHaveBeenCalledTimes(1);
    });

    it.each(['C:\\Presets\\show.xml', 'C:\\Presets\\show', 'C:\\Presets\\show.vmix.txt'])(
      'rejects non-.vmix path %s without calling vMix',
      async (path) => {
        const result = await presetOpenTool.handler({ path }, ctx);

        expect(result.isError).toBe(true);
        expect(result.content[0]?.text).toContain('.vmix');
        expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
      }
    );
  });

  describe('vmix_preset_save', () => {
    it('executes SavePreset and warns about silent overwrite', async () => {
      const result = await presetSaveTool.handler({ path: 'C:\\Presets\\backup.vmix' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SavePreset', {
        Value: 'C:\\Presets\\backup.vmix',
      });
      expect(result.isError).toBeUndefined();
      // The overwrite warning is part of the contract: vMix replaces existing
      // files at the target path without confirmation.
      expect(result.content[0]?.text).toContain('overwrote it without confirmation');
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('rejects non-.vmix paths without calling vMix', async () => {
      const result = await presetSaveTool.handler({ path: 'C:\\Presets\\backup.bak' }, ctx);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('.vmix');
      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    });
  });

  describe('vmix_preset_last', () => {
    it('executes LastPreset with no params', async () => {
      const result = await presetLastTool.handler({}, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('LastPreset');
      expect(result.isError).toBeUndefined();
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });
  });

  it('propagates vMix errors (failure path)', async () => {
    ctx.vmix.http._failOnFunction('OpenPreset', new Error('file not found'));
    await expect(presetOpenTool.handler({ path: 'C:\\p.vmix' }, ctx)).rejects.toThrow(
      'file not found'
    );
  });
});

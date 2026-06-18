/**
 * Tests for destructive/mutating input tools:
 * vmix_input_properties, vmix_input_move, vmix_input_remove,
 * vmix_input_rename, vmix_input_reset.
 *
 * These mutate live vMix in Operator/Dangerous mode — function names and
 * params must match the official vMix API exactly, and bad input references
 * must never fire a command.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { inputPropertiesTool } from '../../../../src/tools/input/properties.js';
import { moveInputTool } from '../../../../src/tools/input/move.js';
import { removeInputTool } from '../../../../src/tools/input/remove.js';
import { renameInputTool } from '../../../../src/tools/input/rename.js';
import { resetInputTool } from '../../../../src/tools/input/reset.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';
import { expectExecutedFunctionsAllowlisted } from '../allowlist-helper.js';

describe('destructive input tools', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  describe('vmix_input_properties', () => {
    it('sets each specified visual property with the correct function', async () => {
      const result = await inputPropertiesTool.handler(
        { input: 'Camera 1', zoom: 1.5, panX: 0.25, panY: -0.5, alpha: 128 },
        ctx
      );

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetZoom', { Input: 'Camera 1', Value: '1.5' });
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetPanX', { Input: 'Camera 1', Value: '0.25' });
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetPanY', { Input: 'Camera 1', Value: '-0.5' });
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetAlpha', { Input: 'Camera 1', Value: '128' });
      expect(result.isError).toBeUndefined();
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('sets all four crop edges together, defaulting unspecified edges', async () => {
      await inputPropertiesTool.handler({ input: 1, cropX1: 0.1 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetCropX1', { Input: '1', Value: '0.1' });
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetCropY1', { Input: '1', Value: '0' });
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetCropX2', { Input: '1', Value: '1' });
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetCropY2', { Input: '1', Value: '1' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('errors when no properties are specified, without any vMix call', async () => {
      const result = await inputPropertiesTool.handler({ input: 1 }, ctx);
      expect(result.isError).toBe(true);
      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    });

    it('rejects an empty input reference before any vMix call', async () => {
      await expect(inputPropertiesTool.handler({ input: '   ', zoom: 1 }, ctx)).rejects.toThrow(
        'Input reference cannot be empty'
      );
      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    });

    it('validates ranges in the schema', () => {
      expect(inputPropertiesTool.schema.safeParse({ input: 1, alpha: 300 }).success).toBe(false);
      expect(inputPropertiesTool.schema.safeParse({ input: 1, zoom: 6 }).success).toBe(false);
      expect(inputPropertiesTool.schema.safeParse({ input: 1, cropX1: 1.5 }).success).toBe(false);
    });

    it('propagates vMix errors (failure path)', async () => {
      ctx.vmix.http._failOnFunction('SetZoom', new Error('boom'));
      await expect(inputPropertiesTool.handler({ input: 1, zoom: 2 }, ctx)).rejects.toThrow('boom');
    });
  });

  describe('vmix_input_move', () => {
    it('executes MoveInput with target position as Value', async () => {
      const result = await moveInputTool.handler({ input: 'Camera 2', position: 1 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('MoveInput', {
        Input: 'Camera 2',
        Value: '1',
      });
      expect(result.isError).toBeUndefined();
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('rejects non-positive positions in the schema', () => {
      expect(moveInputTool.schema.safeParse({ input: 1, position: 0 }).success).toBe(false);
      expect(moveInputTool.schema.safeParse({ input: 1, position: 1.5 }).success).toBe(false);
    });
  });

  describe('vmix_input_remove', () => {
    it('executes RemoveInput against the given input', async () => {
      const result = await removeInputTool.handler({ input: 3 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('RemoveInput', { Input: '3' });
      expect(result.isError).toBeUndefined();
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('rejects invalid input numbers before any vMix call', async () => {
      await expect(removeInputTool.handler({ input: 0 }, ctx)).rejects.toThrow('Invalid input number');
      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    });

    it('propagates vMix errors (failure path)', async () => {
      ctx.vmix.http._failOnFunction('RemoveInput', new Error('input is in use'));
      await expect(removeInputTool.handler({ input: 1 }, ctx)).rejects.toThrow('input is in use');
    });
  });

  describe('vmix_input_rename', () => {
    it('executes SetInputName with the new name as Value', async () => {
      const result = await renameInputTool.handler({ input: 'Camera 1', name: 'Main Cam' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetInputName', {
        Input: 'Camera 1',
        Value: 'Main Cam',
      });
      expect(result.content[0]?.text).toContain('Main Cam');
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('rejects an empty new name in the schema', () => {
      expect(renameInputTool.schema.safeParse({ input: 1, name: '' }).success).toBe(false);
    });
  });

  describe('vmix_input_reset', () => {
    it('executes ResetInput against the given input', async () => {
      const result = await resetInputTool.handler({ input: '{guid-1}' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('ResetInput', { Input: '{guid-1}' });
      expect(result.isError).toBeUndefined();
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('rejects an empty input reference before any vMix call', async () => {
      await expect(resetInputTool.handler({ input: '' }, ctx)).rejects.toThrow();
      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    });
  });
});

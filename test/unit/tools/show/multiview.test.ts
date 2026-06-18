/**
 * Tests for vmix_multiview_create — composes a colour base input plus
 * SetLayer/SetLayer<N>Zoom/PanX/PanY/LayerOn calls.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { multiviewCreateTool } from '../../../../src/tools/show/multiview.js';
import { createMockToolContext, type MockToolContext } from '../../../mocks/tool-context.mock.js';
import { expectExecutedFunctionsAllowlisted } from '../allowlist-helper.js';
import type { VmixState, VmixInput } from '../../../../src/state/types.js';

function makeInput(number: number, title: string, key = `{guid-${number}}`): VmixInput {
  return {
    key,
    number,
    type: 'Capture',
    title,
    state: 'Running',
    position: 0,
    duration: 0,
    muted: false,
    loop: false,
    audioBuses: 'M',
  };
}

function makeState(inputs: VmixInput[]): VmixState {
  return {
    version: '29.0.0.0',
    edition: '4K Plus',
    active: 1,
    preview: 2,
    fadeToBlack: false,
    recording: false,
    recordingDuration: 0,
    streaming: false,
    external: false,
    inputs,
    overlays: [null, null, null, null],
    audio: { master: { volume: 100, muted: false } },
  };
}

/** Make getState reflect AddInput executions so the created-input check passes. */
function simulateGrowingState(ctx: MockToolContext): void {
  const baseInputs = [makeInput(1, 'Camera 1'), makeInput(2, 'Camera 2')];
  vi.mocked(ctx.state.getState).mockImplementation(async () => {
    const addCount = ctx.vmix.http
      ._getExecutedCalls()
      .filter((call) => call.func === 'AddInput').length;
    const inputs = [...baseInputs];
    for (let i = 0; i < addCount; i++) {
      inputs.push(makeInput(3 + i, `New Input ${i + 1}`, `{guid-new-${i + 1}}`));
    }
    return makeState(inputs);
  });
}

describe('vmix_multiview_create', () => {
  let ctx: MockToolContext;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(multiviewCreateTool.name).toBe('vmix_multiview_create');
  });

  describe('input validation (no vMix calls on failure)', () => {
    it('rejects more inputs than the layout supports', async () => {
      const result = await multiviewCreateTool.handler(
        { name: 'MV', layout: 'side-by-side', inputs: [1, 2, 3] },
        ctx
      );
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('max 2');
      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    });

    it('requires at least 2 inputs', async () => {
      const result = await multiviewCreateTool.handler(
        { name: 'MV', layout: 'quad', inputs: [1] },
        ctx
      );
      expect(result.isError).toBe(true);
      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    });

    it('fails fast when an input cannot be resolved', async () => {
      const result = await multiviewCreateTool.handler(
        { name: 'MV', layout: 'side-by-side', inputs: ['Camera 1', 'Nonexistent Cam'] },
        ctx
      );
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Nonexistent Cam');
      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    });
  });

  describe('successful build (side-by-side)', () => {
    it('creates a black colour base, names it, and configures each layer', async () => {
      simulateGrowingState(ctx);

      const result = await multiviewCreateTool.handler(
        { name: 'Dual View', layout: 'side-by-side', inputs: ['Camera 1', 'Camera 2'] },
        ctx
      );

      // Base input: opaque black colour (signed 32-bit 0xFF000000)
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AddInput', {
        Value: 'Colour|-16777216',
      });

      // Renamed to the requested multiview name, addressed by its stable key
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetInputName', {
        Input: '{guid-new-1}',
        Value: 'Dual View',
      });

      // Layers reference the source inputs BY NUMBER in the composite Value
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetLayer', {
        Input: '{guid-new-1}',
        Value: '1,1',
      });
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetLayer', {
        Input: '{guid-new-1}',
        Value: '2,2',
      });

      // Side-by-side: both halves at 50% zoom, panned left/right
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetLayer1Zoom', {
        Input: '{guid-new-1}',
        Value: '0.5',
      });
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetLayer1PanX', {
        Input: '{guid-new-1}',
        Value: '-0.5',
      });
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetLayer2PanX', {
        Input: '{guid-new-1}',
        Value: '0.5',
      });

      // Each configured layer is switched on
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('LayerOn', {
        Input: '{guid-new-1}',
        Value: '1',
      });
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('LayerOn', {
        Input: '{guid-new-1}',
        Value: '2',
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0]?.text).toContain('Multi-View Created: Dual View');
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    }, 15000);
  });

  describe('failure paths', () => {
    it('reports base-input creation failure and stops (failure path)', async () => {
      simulateGrowingState(ctx);
      ctx.vmix.http._failOnFunction('AddInput', new Error('vMix refused'));

      const result = await multiviewCreateTool.handler(
        { name: 'MV', layout: 'side-by-side', inputs: [1, 2] },
        ctx
      );

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Failed to create base input');
      // Nothing beyond the failed AddInput was attempted
      expect(ctx.vmix.http._getExecutedFunctions()).toEqual(['AddInput']);
    });

    it('reports when vMix never materializes the new input', async () => {
      // Default mock state is static — input count never grows after AddInput.
      const result = await multiviewCreateTool.handler(
        { name: 'MV', layout: 'side-by-side', inputs: [1, 2] },
        ctx
      );

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Failed to create base colour input');
    });
  });
});

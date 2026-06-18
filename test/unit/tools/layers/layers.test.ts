/**
 * Tests for layer tools: vmix_layer_set / position / size / crop and
 * visibility (on/off/toggle).
 *
 * Several functions are runtime-composed (SetLayer3Zoom, ...) — every executed
 * name is checked against the official allowlist.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  layerSetTool,
  layerPositionTool,
  layerSizeTool,
  layerCropTool,
} from '../../../../src/tools/layers/properties.js';
import {
  layerOnTool,
  layerOffTool,
  layerToggleTool,
} from '../../../../src/tools/layers/visibility.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';
import { expectExecutedFunctionsAllowlisted } from '../allowlist-helper.js';

describe('layer tools', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  describe('vmix_layer_set', () => {
    it('executes SetLayer with composite "layer,source" Value', async () => {
      const result = await layerSetTool.handler({ input: 'PiP', layer: 3, source: 2 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetLayer', {
        Input: 'PiP',
        Value: '3,2',
      });
      expect(result.isError).toBeUndefined();
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('rejects a source name containing "," (would corrupt the composite Value)', async () => {
      const result = await layerSetTool.handler(
        { input: 'PiP', layer: 1, source: 'Cam, Wide' },
        ctx
      );

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('","');
      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    });

    it('rejects layers outside 1-10 in the schema', () => {
      expect(layerSetTool.schema.safeParse({ input: 1, layer: 0, source: 2 }).success).toBe(false);
      expect(layerSetTool.schema.safeParse({ input: 1, layer: 11, source: 2 }).success).toBe(false);
    });
  });

  describe('vmix_layer_position', () => {
    it('composes SetLayer<N>PanX / SetLayer<N>PanY per axis', async () => {
      await layerPositionTool.handler({ input: 1, layer: 4, x: -0.5, y: 0.25 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetLayer4PanX', {
        Input: '1',
        Value: '-0.5',
      });
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetLayer4PanY', {
        Input: '1',
        Value: '0.25',
      });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('errors with no axes and makes no calls', async () => {
      const result = await layerPositionTool.handler({ input: 1, layer: 1 }, ctx);
      expect(result.isError).toBe(true);
      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    });
  });

  describe('vmix_layer_size', () => {
    it('zoom wins over width/height and uses SetLayer<N>Zoom', async () => {
      await layerSizeTool.handler({ input: 1, layer: 2, zoom: 0.5, width: 2, height: 2 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledTimes(1);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetLayer2Zoom', {
        Input: '1',
        Value: '0.5',
      });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('sets width and height independently when zoom is absent', async () => {
      await layerSizeTool.handler({ input: 1, layer: 10, width: 0.5, height: 0.75 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetLayer10Width', {
        Input: '1',
        Value: '0.5',
      });
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetLayer10Height', {
        Input: '1',
        Value: '0.75',
      });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('errors with no size values and makes no calls', async () => {
      const result = await layerSizeTool.handler({ input: 1, layer: 1 }, ctx);
      expect(result.isError).toBe(true);
      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    });
  });

  describe('vmix_layer_crop', () => {
    it('always sets all four crop edges with defaults for unspecified ones', async () => {
      await layerCropTool.handler({ input: 1, layer: 3, x1: 0.1 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetLayer3CropX1', { Input: '1', Value: '0.1' });
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetLayer3CropY1', { Input: '1', Value: '0' });
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetLayer3CropX2', { Input: '1', Value: '1' });
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetLayer3CropY2', { Input: '1', Value: '1' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });
  });

  describe('visibility', () => {
    it('LayerOn carries the layer number as Value', async () => {
      await layerOnTool.handler({ input: 'PiP', layer: 5 }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('LayerOn', { Input: 'PiP', Value: '5' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('LayerOff carries the layer number as Value', async () => {
      await layerOffTool.handler({ input: 2, layer: 1 }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('LayerOff', { Input: '2', Value: '1' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('toggle uses LayerOnOff', async () => {
      await layerToggleTool.handler({ input: 2, layer: 7 }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('LayerOnOff', { Input: '2', Value: '7' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('propagates vMix errors (failure path)', async () => {
      ctx.vmix.http._failOnFunction('LayerOn', new Error('layer unavailable'));
      await expect(layerOnTool.handler({ input: 1, layer: 1 }, ctx)).rejects.toThrow(
        'layer unavailable'
      );
    });
  });
});

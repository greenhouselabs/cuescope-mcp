/**
 * Tests for title graphics controls: vmix_ticker_speed,
 * vmix_title_text_color, vmix_title_text_visible, and title preset tools.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { tickerSpeedTool } from '../../../../src/tools/graphics/ticker.js';
import { textColorTool, textVisibleTool } from '../../../../src/tools/graphics/text-style.js';
import {
  titlePresetTool,
  titlePresetNextTool,
  titlePresetPrevTool,
} from '../../../../src/tools/graphics/preset.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';
import { expectExecutedFunctionsAllowlisted } from '../allowlist-helper.js';

describe('title graphics controls', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  describe('vmix_ticker_speed', () => {
    it('executes SetTickerSpeed with speed as Value', async () => {
      await tickerSpeedTool.handler({ input: 'News Ticker', speed: 250 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetTickerSpeed', {
        Input: 'News Ticker',
        Value: '250',
      });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('includes SelectedName only when a field is given', async () => {
      await tickerSpeedTool.handler({ input: 1, field: 'Ticker.Text', speed: 0 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetTickerSpeed', {
        Input: '1',
        Value: '0',
        SelectedName: 'Ticker.Text',
      });
    });

    it('rejects out-of-range speeds in the schema', () => {
      expect(tickerSpeedTool.schema.safeParse({ input: 1, speed: -1 }).success).toBe(false);
      expect(tickerSpeedTool.schema.safeParse({ input: 1, speed: 1001 }).success).toBe(false);
    });
  });

  describe('vmix_title_text_color', () => {
    it('executes SetTextColour (British spelling per vMix API) with field and color', async () => {
      await textColorTool.handler(
        { input: 'Lower Third', field: 'Headline.Text', color: '#FF0000' },
        ctx
      );

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetTextColour', {
        Input: 'Lower Third',
        SelectedName: 'Headline.Text',
        Value: '#FF0000',
      });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('accepts #AARRGGBB and rejects malformed colors in the schema', () => {
      expect(
        textColorTool.schema.safeParse({ input: 1, field: 'F', color: '#80FF0000' }).success
      ).toBe(true);
      expect(textColorTool.schema.safeParse({ input: 1, field: 'F', color: 'red' }).success).toBe(
        false
      );
      expect(
        textColorTool.schema.safeParse({ input: 1, field: 'F', color: '#FFF' }).success
      ).toBe(false);
    });
  });

  describe('vmix_title_text_visible', () => {
    it('uses SetTextVisibleOn to show', async () => {
      await textVisibleTool.handler({ input: 1, field: 'Sponsor.Text', visible: true }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetTextVisibleOn', {
        Input: '1',
        SelectedName: 'Sponsor.Text',
      });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('uses SetTextVisibleOff to hide', async () => {
      await textVisibleTool.handler({ input: 1, field: 'Sponsor.Text', visible: false }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetTextVisibleOff', {
        Input: '1',
        SelectedName: 'Sponsor.Text',
      });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });
  });

  describe('title presets', () => {
    it('selects a preset by 0-based index via SelectTitlePreset', async () => {
      await titlePresetTool.handler({ input: 'Lower Third', index: 2 }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SelectTitlePreset', {
        Input: 'Lower Third',
        Value: '2',
      });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('cycles forward via NextTitlePreset', async () => {
      await titlePresetNextTool.handler({ input: 1 }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('NextTitlePreset', { Input: '1' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('cycles backward via PreviousTitlePreset', async () => {
      await titlePresetPrevTool.handler({ input: 1 }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('PreviousTitlePreset', { Input: '1' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('rejects negative preset indexes in the schema', () => {
      expect(titlePresetTool.schema.safeParse({ input: 1, index: -1 }).success).toBe(false);
    });

    it('propagates vMix errors (failure path)', async () => {
      ctx.vmix.http._failOnFunction('SelectTitlePreset', new Error('no presets'));
      await expect(titlePresetTool.handler({ input: 1, index: 0 }, ctx)).rejects.toThrow(
        'no presets'
      );
    });
  });
});

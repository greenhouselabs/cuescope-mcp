/**
 * Tests for vmix_title_set_image tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setImageTool } from '../../../../src/tools/graphics/set-image.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_title_set_image', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(setImageTool.name).toBe('vmix_title_set_image');
  });

  describe('basic operation', () => {
    it('sets image field by input name', async () => {
      await setImageTool.handler(
        { input: 'Lower Third', field: 'Logo.Source', path: 'C:\\Images\\logo.png' },
        ctx
      );

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetImage', {
        Input: 'Lower Third',
        SelectedName: 'Logo.Source',
        Value: 'C:\\Images\\logo.png',
      });
    });

    it('sets image field by input number', async () => {
      await setImageTool.handler({ input: 3, field: 'Background.Source', path: 'D:\\bg.jpg' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetImage', {
        Input: '3',
        SelectedName: 'Background.Source',
        Value: 'D:\\bg.jpg',
      });
    });

    it('clears image with empty path', async () => {
      await setImageTool.handler({ input: 'Title', field: 'Logo.Source', path: '' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetImage', {
        Input: 'Title',
        SelectedName: 'Logo.Source',
        Value: '',
      });
    });
  });

  describe('schema validation', () => {
    it('requires input', () => {
      expect(setImageTool.schema.safeParse({ field: 'Logo', path: 'x' }).success).toBe(false);
    });

    it('requires field', () => {
      expect(setImageTool.schema.safeParse({ input: 'Title', path: 'x' }).success).toBe(false);
    });

    it('requires path', () => {
      expect(setImageTool.schema.safeParse({ input: 'Title', field: 'Logo' }).success).toBe(false);
    });

    it('accepts string input', () => {
      expect(
        setImageTool.schema.safeParse({ input: 'Title', field: 'Logo.Source', path: 'test.png' })
          .success
      ).toBe(true);
    });

    it('accepts number input', () => {
      expect(
        setImageTool.schema.safeParse({ input: 1, field: 'Logo.Source', path: 'test.png' }).success
      ).toBe(true);
    });
  });

  describe('result messages', () => {
    it('returns success message with field name', async () => {
      const result = await setImageTool.handler(
        { input: 'Title', field: 'Logo.Source', path: 'logo.png' },
        ctx
      );
      expect(result.content[0]?.text).toContain('Logo.Source');
    });
  });
});

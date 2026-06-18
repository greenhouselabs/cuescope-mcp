/**
 * Tests for vmix_title_set_text tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setTextTool } from '../../../../src/tools/graphics/set-text.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_title_set_text', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(setTextTool.name).toBe('vmix_title_set_text');
  });

  describe('basic operation', () => {
    it('sets text field by input name', async () => {
      await setTextTool.handler(
        { input: 'Lower Third', field: 'Name.Text', value: 'John Smith' },
        ctx
      );

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetText', {
        Input: 'Lower Third',
        SelectedName: 'Name.Text',
        Value: 'John Smith',
      });
    });

    it('sets text field by input number', async () => {
      await setTextTool.handler({ input: 5, field: 'Title.Text', value: 'Breaking News' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetText', {
        Input: '5',
        SelectedName: 'Title.Text',
        Value: 'Breaking News',
      });
    });

    it('handles GT title field names', async () => {
      await setTextTool.handler(
        { input: 'Score Bug', field: 'HomeTeam.Text', value: 'EAGLES' },
        ctx
      );

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetText', {
        Input: 'Score Bug',
        SelectedName: 'HomeTeam.Text',
        Value: 'EAGLES',
      });
    });

    it('handles empty value to clear text', async () => {
      await setTextTool.handler({ input: 'Title', field: 'Subtitle.Text', value: '' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetText', {
        Input: 'Title',
        SelectedName: 'Subtitle.Text',
        Value: '',
      });
    });
  });

  describe('schema validation', () => {
    it('requires input', () => {
      expect(setTextTool.schema.safeParse({ field: 'Test', value: 'x' }).success).toBe(false);
    });

    it('requires field', () => {
      expect(setTextTool.schema.safeParse({ input: 'Title', value: 'x' }).success).toBe(false);
    });

    it('requires value', () => {
      expect(setTextTool.schema.safeParse({ input: 'Title', field: 'Test' }).success).toBe(false);
    });

    it('accepts string input', () => {
      expect(
        setTextTool.schema.safeParse({ input: 'Title', field: 'Name.Text', value: 'Test' }).success
      ).toBe(true);
    });

    it('accepts number input', () => {
      expect(
        setTextTool.schema.safeParse({ input: 1, field: 'Name.Text', value: 'Test' }).success
      ).toBe(true);
    });
  });

  describe('result messages', () => {
    it('returns success message with field and value', async () => {
      const result = await setTextTool.handler(
        { input: 'Title', field: 'Name.Text', value: 'John' },
        ctx
      );
      expect(result.content[0]?.text).toContain('Name.Text');
      expect(result.content[0]?.text).toContain('John');
    });
  });
});

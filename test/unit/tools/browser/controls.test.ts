/**
 * Tests for browser input tools.
 *
 * Security-critical (CLAUDE.md rule): browser inputs must accept ONLY http
 * and https URLs — javascript:, file:, ftp:, data: must all be rejected at
 * the schema layer so they can never reach vMix.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  browserNavigateTool,
  browserReloadTool,
  browserBackTool,
  browserForwardTool,
  browserKeyboardTool,
  browserMouseTool,
} from '../../../../src/tools/browser/controls.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';
import { expectExecutedFunctionsAllowlisted } from '../allowlist-helper.js';

describe('browser tools', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  describe('vmix_browser_navigate URL scheme enforcement', () => {
    it.each(['https://example.com/page', 'http://localhost:8080/overlay'])(
      'accepts %s',
      (url) => {
        const parsed = browserNavigateTool.schema.safeParse({ input: 1, url });
        expect(parsed.success).toBe(true);
      }
    );

    it.each([
      'javascript:alert(1)',
      'file:///C:/Windows/system.ini',
      'ftp://example.com/file.txt',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'not a url at all',
    ])('rejects %s at the schema layer', (url) => {
      const parsed = browserNavigateTool.schema.safeParse({ input: 1, url });
      expect(parsed.success).toBe(false);
    });

    it('executes BrowserNavigate with the URL as Value', async () => {
      const result = await browserNavigateTool.handler(
        { input: 'Web View', url: 'https://example.com/scoreboard' },
        ctx
      );

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('BrowserNavigate', {
        Input: 'Web View',
        Value: 'https://example.com/scoreboard',
      });
      expect(result.isError).toBeUndefined();
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });
  });

  describe('navigation controls', () => {
    it('reload uses BrowserReload', async () => {
      await browserReloadTool.handler({ input: 1 }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('BrowserReload', { Input: '1' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('back uses BrowserBack', async () => {
      await browserBackTool.handler({ input: 1 }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('BrowserBack', { Input: '1' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('forward uses BrowserForward', async () => {
      await browserForwardTool.handler({ input: 1 }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('BrowserForward', { Input: '1' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });
  });

  describe('input device toggles', () => {
    it('keyboard enable/disable use distinct functions', async () => {
      await browserKeyboardTool.handler({ input: 1, enabled: true }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('BrowserKeyboardEnabled', { Input: '1' });

      await browserKeyboardTool.handler({ input: 1, enabled: false }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('BrowserKeyboardDisabled', { Input: '1' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('mouse enable/disable use distinct functions', async () => {
      await browserMouseTool.handler({ input: 1, enabled: true }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('BrowserMouseEnabled', { Input: '1' });

      await browserMouseTool.handler({ input: 1, enabled: false }, ctx);
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('BrowserMouseDisabled', { Input: '1' });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });
  });

  it('propagates vMix errors (failure path)', async () => {
    ctx.vmix.http._failOnFunction('BrowserNavigate', new Error('browser input missing'));
    await expect(
      browserNavigateTool.handler({ input: 1, url: 'https://example.com' }, ctx)
    ).rejects.toThrow('browser input missing');
  });
});

/**
 * Tests for vmix_script_template
 *
 * Core promise: every template the tool hands out must pass the project's own
 * VB.NET validator — users are told these are ready-to-review scripts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { templateTool } from '../../../../src/tools/scripting/template.js';
import { validateVmixScript } from '../../../../src/validation/script-validator.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

const ALL_TEMPLATES = [
  'camera-cycle',
  'auto-record-on-stream',
  'timed-lower-third',
  'countdown-with-switch',
  'audio-ducking',
  'video-end-switch',
  'scheduled-action',
  'recording-timer',
];

function extractScript(text: string): string {
  const match = text.match(/```vb\n([\s\S]*?)```/);
  expect(match, 'response should contain a ```vb code block').toBeTruthy();
  return match![1]!;
}

describe('vmix_script_template', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(templateTool.name).toBe('vmix_script_template');
  });

  it('never executes anything against vMix', async () => {
    await templateTool.handler({ action: 'list' }, ctx);
    await templateTool.handler({ action: 'get', template: 'camera-cycle' }, ctx);
    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
  });

  describe('list action', () => {
    it('lists every template with its description', async () => {
      const result = await templateTool.handler({ action: 'list' }, ctx);
      const text = result.content[0]?.text ?? '';

      expect(result.isError).toBeUndefined();
      for (const name of ALL_TEMPLATES) {
        expect(text).toContain(`**${name}**`);
      }
    });
  });

  describe('get action errors', () => {
    it('requires a template name', async () => {
      const result = await templateTool.handler({ action: 'get' }, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('template name is required');
    });

    it('rejects unknown templates and lists available ones', async () => {
      const result = await templateTool.handler(
        { action: 'get', template: 'no-such-template' },
        ctx
      );
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('camera-cycle');
    });

    it('rejects non-numeric values for numeric params instead of emitting NaN', async () => {
      const result = await templateTool.handler(
        {
          action: 'get',
          template: 'camera-cycle',
          params: { intervalSeconds: 'fast' },
        },
        ctx
      );
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('intervalSeconds');
      expect(result.content[0]?.text).not.toContain('NaN');
    });
  });

  describe('round-trip validation (every generated script must be valid VB.NET)', () => {
    it.each(ALL_TEMPLATES)('template "%s" with default params validates', async (template) => {
      const result = await templateTool.handler({ action: 'get', template }, ctx);
      expect(result.isError).toBeUndefined();

      const script = extractScript(result.content[0]?.text ?? '');
      const validation = validateVmixScript(script);
      expect(validation.errors, `errors for ${template}`).toEqual([]);
      expect(validation.valid, `template ${template} must validate`).toBe(true);
    });

    it('camera-cycle embeds the requested inputs and interval', async () => {
      const result = await templateTool.handler(
        {
          action: 'get',
          template: 'camera-cycle',
          params: { inputs: 'Cam A, Cam B, Cam C', intervalSeconds: '7' },
        },
        ctx
      );

      const script = extractScript(result.content[0]?.text ?? '');
      expect(script).toContain('"Cam A", "Cam B", "Cam C"');
      expect(script).toContain('Sleep(7000)');
      expect(validateVmixScript(script).valid).toBe(true);
    });

    it('timed-lower-third uses the overlay channel and duration', async () => {
      const result = await templateTool.handler(
        {
          action: 'get',
          template: 'timed-lower-third',
          params: { overlayChannel: '2', input: 'L3', durationSeconds: '8' },
        },
        ctx
      );

      const script = extractScript(result.content[0]?.text ?? '');
      expect(script).toContain('OverlayInput2In');
      expect(script).toContain('OverlayInput2Out');
      expect(script).toContain('Sleep(8000)');
      expect(validateVmixScript(script).valid).toBe(true);
    });

    it('countdown-with-switch pads seconds and targets the right inputs', async () => {
      const result = await templateTool.handler(
        {
          action: 'get',
          template: 'countdown-with-switch',
          params: { countdownInput: 'Clock', targetInput: 'Cam 1', seconds: '5' },
        },
        ctx
      );

      const script = extractScript(result.content[0]?.text ?? '');
      expect(script).toContain('Value:="00:00:05"');
      expect(script).toContain('Input:="Clock"');
      expect(script).toContain('API.Function("Cut", Input:="Cam 1")');
      expect(validateVmixScript(script).valid).toBe(true);
    });

    it('scheduled-action embeds the action, input, and zero-padded time', async () => {
      const result = await templateTool.handler(
        {
          action: 'get',
          template: 'scheduled-action',
          params: { hour: '9', minute: '5', action: 'Fade', actionInput: 'Cam 2' },
        },
        ctx
      );

      const script = extractScript(result.content[0]?.text ?? '');
      expect(script).toContain('09:05');
      expect(script).toContain('API.Function("Fade", Input:="Cam 2")');
      expect(validateVmixScript(script).valid).toBe(true);
    });

    it('audio-ducking uses the volume params', async () => {
      const result = await templateTool.handler(
        {
          action: 'get',
          template: 'audio-ducking',
          params: { micInput: 'Host', bgInput: 'Music', normalVolume: '90', duckedVolume: '20' },
        },
        ctx
      );

      const script = extractScript(result.content[0]?.text ?? '');
      expect(script).toContain('Value:="20"');
      expect(script).toContain('Value:="90"');
      expect(validateVmixScript(script).valid).toBe(true);
    });
  });
});

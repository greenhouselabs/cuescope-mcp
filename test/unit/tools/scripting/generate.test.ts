/**
 * Tests for vmix_script_generate
 *
 * Every script this tool produces is round-tripped through the project's own
 * validator and must come back valid:true — that is the product's core promise.
 */

import { describe, it, expect } from 'vitest';
import { generateTool } from '../../../../src/tools/scripting/generate.js';
import { validateVmixScript } from '../../../../src/validation/script-validator.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';
import type { VmixInput } from '../../../../src/state/types.js';

function makeInput(overrides: Partial<VmixInput> & { number: number; title: string }): VmixInput {
  return {
    key: `{guid-${overrides.number}}`,
    type: 'Capture',
    state: 'Running',
    position: 0,
    duration: 0,
    muted: false,
    loop: false,
    audioBuses: 'M',
    ...overrides,
  };
}

function extractScript(text: string): string {
  const match = text.match(/```vb\n([\s\S]*?)```/);
  expect(match, 'response should contain a ```vb code block').toBeTruthy();
  return match![1]!;
}

/** Context with a realistic mixed setup: cameras, video, GT title, mic, music. */
function richContext() {
  return createMockToolContext({
    initialState: {
      inputs: [
        makeInput({ number: 1, title: 'Camera 1' }),
        makeInput({ number: 2, title: 'Camera 2' }),
        makeInput({ number: 3, title: 'Intro Video', type: 'Video', duration: 30000 }),
        makeInput({
          number: 4,
          title: 'Lower Third',
          type: 'GT',
          fields: { 'Name.Text': 'Host', 'Title.Text': 'Anchor' },
        }),
        makeInput({ number: 5, title: 'Host Mic', type: 'Audio' }),
        makeInput({ number: 6, title: 'Background Music', type: 'AudioFile' }),
      ],
    },
  });
}

describe('vmix_script_generate', () => {
  it('has correct name', () => {
    expect(generateTool.name).toBe('vmix_script_generate');
  });

  describe('generation paths produce valid VB.NET', () => {
    const cases: { label: string; description: string; expectInScript: string }[] = [
      {
        label: 'camera cycling',
        description: 'Cycle through my cameras every 5 seconds',
        expectInScript: 'Sleep(5000)',
      },
      {
        label: 'camera cycling with fade',
        description: 'Fade between my cameras every 10 seconds',
        expectInScript: '"Fade"',
      },
      {
        label: 'timed overlay',
        description: 'Show the lower third for 5 seconds',
        expectInScript: 'OverlayInput1In',
      },
      {
        label: 'video end trigger',
        description: 'When the intro video ends, cut to Camera 1',
        expectInScript: '"Cut", Input:="Camera 1"',
      },
      {
        label: 'audio ducking',
        description: 'Duck the background music when the host mic is active',
        expectInScript: 'SetVolume',
      },
      {
        label: 'set text',
        description: 'Update the title text',
        expectInScript: 'SetText',
      },
      {
        label: 'recording control',
        description: 'Start recording',
        expectInScript: 'API.Function("StartRecording")',
      },
      {
        label: 'streaming control',
        description: 'Stop streaming',
        expectInScript: 'API.Function("StopStreaming")',
      },
      {
        label: 'generic fallback',
        description: 'Do something completely unrecognizable here',
        expectInScript: 'API.XML()',
      },
    ];

    it.each(cases)('$label: validates and contains expected code', async ({ description, expectInScript }) => {
      const ctx = richContext();
      const result = await generateTool.handler({ description, execute: false }, ctx);

      expect(result.isError).toBeFalsy();
      const script = extractScript(result.content[0]?.text ?? '');
      expect(script).toContain(expectInScript);

      const validation = validateVmixScript(script);
      expect(validation.errors).toEqual([]);
      expect(validation.valid).toBe(true);

      // Generation alone never touches vMix
      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    });

    it('escapes double quotes in input titles so generated VB stays valid', async () => {
      const ctx = createMockToolContext({
        initialState: {
          inputs: [
            makeInput({ number: 1, title: 'The "Big" Video', type: 'Video', duration: 60000 }),
            makeInput({ number: 2, title: 'Camera 1' }),
          ],
        },
      });

      const result = await generateTool.handler(
        { description: 'When the video ends, cut to Camera 1', execute: false },
        ctx
      );

      const script = extractScript(result.content[0]?.text ?? '');
      // VB escaping doubles quotes inside string literals
      expect(script).toContain('The ""Big"" Video');
      expect(validateVmixScript(script).valid).toBe(true);
    });
  });

  describe('error paths (no script can be generated)', () => {
    it('reports when there are not enough inputs to cycle', async () => {
      const ctx = createMockToolContext({
        initialState: { inputs: [makeInput({ number: 1, title: 'Camera 1' })] },
      });
      const result = await generateTool.handler(
        { description: 'Cycle through my cameras every 5 seconds', execute: false },
        ctx
      );
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Not enough inputs');
    });

    it('reports when no overlay input exists', async () => {
      const ctx = createMockToolContext(); // only 2 Capture inputs
      const result = await generateTool.handler(
        { description: 'Show the overlay graphic for 5 seconds', execute: false },
        ctx
      );
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('No suitable overlay input');
    });

    it('reports when no video input exists for end-trigger', async () => {
      const ctx = createMockToolContext();
      const result = await generateTool.handler(
        { description: 'When the video ends, cut to Camera 1', execute: false },
        ctx
      );
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('No video input found');
    });

    it('reports when mic/background inputs cannot be found for ducking', async () => {
      const ctx = createMockToolContext();
      const result = await generateTool.handler(
        { description: 'Duck the bed when someone talks', execute: false },
        ctx
      );
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Could not find mic and background audio');
    });

    it('reports when no title input with fields exists for set-text', async () => {
      const ctx = createMockToolContext();
      const result = await generateTool.handler(
        { description: 'Update the title text', execute: false },
        ctx
      );
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('No title input with text fields');
    });
  });

  describe('gated execution', () => {
    it('executes the validated script via ScriptStartDynamic when execute=true', async () => {
      const ctx = richContext();
      const result = await generateTool.handler(
        { description: 'Start recording', execute: true },
        ctx
      );

      expect(ctx.vmix.http.execute).toHaveBeenCalledTimes(1);
      const call = ctx.vmix.http._getExecutedCalls()[0]!;
      expect(call.func).toBe('ScriptStartDynamic');
      expect(String(call.params?.['Value'])).toContain('API.Function("StartRecording")');
      expect(result.content[0]?.text).toContain('executed successfully');
    });

    it('reports execution failure without throwing (failure path)', async () => {
      const ctx = richContext();
      ctx.vmix.http._failOnFunction('ScriptStartDynamic', new Error('vMix offline'));

      const result = await generateTool.handler(
        { description: 'Start recording', execute: true },
        ctx
      );

      expect(result.content[0]?.text).toContain('Execution failed');
      expect(result.content[0]?.text).toContain('vMix offline');
    });
  });
});

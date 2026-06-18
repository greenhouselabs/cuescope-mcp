/**
 * Tests for vmix_show_build
 * - dryRun must default to TRUE (review-first philosophy)
 * - the dry-run message must reference dryRun: false (not the non-existent execute: true)
 * - plan steps must be honest: [auto] steps are actually executed,
 *   [manual setup required] steps are clearly labeled and never attempted
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { showBuildTool } from '../../../../src/tools/show/build.js';
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

/** Make getState reflect AddInput executions, so count-checks succeed. */
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

const twoParticipants = [
  {
    name: 'Alice',
    camera: { type: 'existing' as const, source: 'Camera 1' },
    microphone: { type: 'embedded' as const, bus: ['M'] },
  },
  {
    name: 'Bob',
    camera: { type: 'existing' as const, source: 'Camera 2' },
    microphone: { type: 'embedded' as const, bus: ['M', 'A'] },
  },
];

describe('vmix_show_build', () => {
  let ctx: MockToolContext;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(showBuildTool.name).toBe('vmix_show_build');
  });

  describe('dry-run default (M3)', () => {
    it('schema defaults dryRun to true', () => {
      const parsed = showBuildTool.schema.parse({
        template: 'four-person-podcast',
        name: 'My Show',
        participants: twoParticipants,
      });
      expect(parsed.dryRun).toBe(true);
    });

    it('default invocation makes NO vMix calls and prints the plan', async () => {
      const params = showBuildTool.schema.parse({
        template: 'four-person-podcast',
        name: 'My Show',
        participants: twoParticipants,
      });
      const result = await showBuildTool.handler(params, ctx);

      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
      expect(result.content[0]?.text).toContain('DRY RUN');
    });

    it('dry-run message references dryRun: false, not execute: true (M4)', async () => {
      const params = showBuildTool.schema.parse({
        template: 'four-person-podcast',
        name: 'My Show',
        participants: twoParticipants,
      });
      const result = await showBuildTool.handler(params, ctx);
      const text = result.content[0]?.text ?? '';

      expect(text).toContain('dryRun: false');
      expect(text).not.toContain('execute: true');
    });
  });

  describe('plan/execution consistency (M4 + M7)', () => {
    const fullOptions = {
      lowerThirdPath: 'C:\\GFX\\lower-third.gtzip',
      logoBugPath: 'C:\\GFX\\logo.png',
      startingSoonPath: 'C:\\GFX\\starting-soon.png',
      brbPath: 'C:\\GFX\\brb.png',
      includeMusic: true,
      musicPath: 'C:\\Audio\\music.mp3',
      musicDuckLevel: 20,
      includeIntro: true,
      introPath: 'C:\\Video\\intro.mp4',
      includeOutro: true,
      outroPath: 'C:\\Video\\outro.mp4',
      includeStinger: true,
      stingerPath: 'C:\\Video\\stinger.mp4',
    };

    it('executes every [auto] plan step when dryRun is false', async () => {
      simulateGrowingState(ctx);

      const result = await showBuildTool.handler(
        {
          template: 'four-person-podcast',
          name: 'My Show',
          participants: twoParticipants,
          options: fullOptions,
          dryRun: false,
          inputDelay: 0,
        },
        ctx
      );

      const addValues = ctx.vmix.http
        ._getExecutedCalls()
        .filter((call) => call.func === 'AddInput')
        .map((call) => String(call.params?.['Value']));

      // Every graphics/media step the plan marks [auto] is actually executed
      expect(addValues).toContain('GT|C:\\GFX\\lower-third.gtzip');
      expect(addValues).toContain('Image|C:\\GFX\\logo.png');
      expect(addValues).toContain('Image|C:\\GFX\\starting-soon.png');
      expect(addValues).toContain('Image|C:\\GFX\\brb.png');
      expect(addValues).toContain('AudioFile|C:\\Audio\\music.mp3');
      expect(addValues).toContain('Video|C:\\Video\\intro.mp4');
      expect(addValues).toContain('Video|C:\\Video\\outro.mp4');
      expect(addValues).toContain('Video|C:\\Video\\stinger.mp4');
      expect(addValues).toContain('Colour|-16777216'); // Black

      const text = result.content[0]?.text ?? '';
      expect(text).toContain('Build complete');
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('plan marks audio routing, multi-views, and overlays as manual and never executes them', async () => {
      simulateGrowingState(ctx);

      const result = await showBuildTool.handler(
        {
          template: 'four-person-podcast',
          name: 'My Show',
          participants: twoParticipants,
          options: fullOptions,
          dryRun: false,
          inputDelay: 0,
        },
        ctx
      );

      const text = result.content[0]?.text ?? '';

      // Plan lines for non-automated steps carry the manual label
      const planSection = text.split('## Executing Build')[0] ?? '';
      const routingLines = planSection
        .split('\n')
        .filter((line) => line.includes('Route ') || line.includes('layout') || line.includes('Channel '));
      expect(routingLines.length).toBeGreaterThan(0);
      for (const line of routingLines) {
        expect(line).toContain('[manual setup required]');
      }

      // The execution summary repeats the outstanding manual work
      expect(text).toContain('Manual setup still required:');

      // No audio-routing / overlay / multiview functions are ever executed
      const executed = ctx.vmix.http._getExecutedFunctions();
      expect(executed.every((fn) => fn === 'AddInput' || fn === 'SetInputName')).toBe(true);
    });

    it('every executed plan step is marked [auto] in the plan', async () => {
      simulateGrowingState(ctx);

      const result = await showBuildTool.handler(
        {
          template: 'four-person-podcast',
          name: 'My Show',
          participants: twoParticipants,
          options: fullOptions,
          dryRun: false,
          inputDelay: 0,
        },
        ctx
      );

      const text = result.content[0]?.text ?? '';
      const planSection = text.split('## Executing Build')[0] ?? '';

      // Each created item corresponds to a plan line marked [auto]
      for (const label of ['Lower Third', 'Logo Bug', 'Starting Soon', 'BRB', 'Background Music', 'Intro', 'Outro', 'Stinger', 'Black']) {
        const planLine = planSection.split('\n').find((line) => line.includes(`"${label}"`) || line.includes(`: "${label}"`));
        expect(planLine, `plan line for ${label}`).toBeDefined();
        expect(planLine).toContain('[auto]');
      }
    });
  });

  describe('unsupported AddInput short-forms (M7)', () => {
    it('never sends Capture| or Audio| AddInput values; emits manual instructions instead', async () => {
      simulateGrowingState(ctx);

      const result = await showBuildTool.handler(
        {
          template: 'four-person-podcast',
          name: 'My Show',
          participants: [
            {
              name: 'Alice',
              camera: { type: 'capture', source: 'Logitech BRIO' },
              microphone: { type: 'separate', source: 'Shure SM7B (USB)', bus: ['M'] },
            },
            {
              name: 'Bob',
              camera: { type: 'webcam', source: 'Internal Webcam' },
              microphone: { type: 'embedded', bus: ['M'] },
            },
          ],
          dryRun: false,
          inputDelay: 0,
        },
        ctx
      );

      const addValues = ctx.vmix.http
        ._getExecutedCalls()
        .filter((call) => call.func === 'AddInput')
        .map((call) => String(call.params?.['Value']));

      expect(addValues.some((value) => value.startsWith('Capture|'))).toBe(false);
      expect(addValues.some((value) => value.startsWith('Audio|'))).toBe(false);

      const text = result.content[0]?.text ?? '';
      expect(text).toContain('Manual setup still required:');
      expect(text).toContain('Logitech BRIO');
      expect(text).toContain('Internal Webcam');
      expect(text).toContain('Shure SM7B (USB)');
    });

    it('adds file-based separate mics via AudioFile|', async () => {
      simulateGrowingState(ctx);

      await showBuildTool.handler(
        {
          template: 'four-person-podcast',
          name: 'My Show',
          participants: [
            {
              name: 'Alice',
              camera: { type: 'existing', source: 'Camera 1' },
              microphone: { type: 'separate', source: 'C:\\Audio\\alice-feed.wav', bus: ['M'] },
            },
            {
              name: 'Bob',
              camera: { type: 'existing', source: 'Camera 2' },
              microphone: { type: 'embedded', bus: ['M'] },
            },
          ],
          dryRun: false,
          inputDelay: 0,
        },
        ctx
      );

      const addValues = ctx.vmix.http
        ._getExecutedCalls()
        .filter((call) => call.func === 'AddInput')
        .map((call) => String(call.params?.['Value']));
      expect(addValues).toContain('AudioFile|C:\\Audio\\alice-feed.wav');
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });
  });

  describe('error handling', () => {
    it('rejects unknown templates', async () => {
      const result = await showBuildTool.handler(
        {
          template: 'no-such-template',
          name: 'My Show',
          participants: twoParticipants,
          dryRun: true,
          inputDelay: 0,
        },
        ctx
      );
      expect(result.isError).toBe(true);
    });

    it('reports AddInput failures in the Failed section (failure path)', async () => {
      simulateGrowingState(ctx);
      ctx.vmix.http._failOnFunction('AddInput', new Error('vMix rejected the input'));

      const result = await showBuildTool.handler(
        {
          template: 'four-person-podcast',
          name: 'My Show',
          participants: twoParticipants,
          options: { includeMusic: true, musicPath: 'C:\\Audio\\music.mp3' },
          dryRun: false,
          inputDelay: 0,
        },
        ctx
      );

      const text = result.content[0]?.text ?? '';
      expect(text).toContain('### Failed:');
      expect(text).toContain('vMix rejected the input');
    });
  });
});

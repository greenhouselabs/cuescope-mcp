/**
 * Tests for vmix_participant_add
 * - Audio bus routing must use single-letter Values (M, A-G), not 'Master'/'BusA'
 * - AddInput must invalidate the state cache, wait, and count-check before renaming
 * - Unsupported AddInput short-forms (capture devices, audio devices) must emit
 *   manual-setup instructions instead of calls known to fail
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { participantAddTool } from '../../../../src/tools/show/participant.js';
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

async function runWithTimers<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

describe('vmix_participant_add', () => {
  let ctx: MockToolContext;

  beforeEach(() => {
    ctx = createMockToolContext();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('has correct name', () => {
    expect(participantAddTool.name).toBe('vmix_participant_add');
  });

  describe('audio bus routing (H4)', () => {
    it('sends single-letter bus Values (M, A), not Master/BusA', async () => {
      const result = await runWithTimers(
        participantAddTool.handler(
          {
            name: 'Alice',
            camera: { type: 'existing', source: 'Camera 1' },
            microphone: { type: 'embedded', bus: ['M', 'A'] },
          },
          ctx
        )
      );

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AudioBusOn', {
        Input: '{guid-1}',
        Value: 'M',
      });
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AudioBusOn', {
        Input: '{guid-1}',
        Value: 'A',
      });

      // The old, broken composite values must never be sent
      for (const call of ctx.vmix.http._getExecutedCalls()) {
        expect(call.params?.['Value']).not.toBe('Master');
        expect(call.params?.['Value']).not.toBe('BusA');
      }

      expect(result.isError).toBeFalsy();
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('schema rejects non-letter bus values', () => {
      const base = {
        name: 'Alice',
        camera: { type: 'existing', source: 'Camera 1' },
      };
      expect(
        participantAddTool.schema.safeParse({
          ...base,
          microphone: { type: 'embedded', bus: ['Master'] },
        }).success
      ).toBe(false);
      expect(
        participantAddTool.schema.safeParse({
          ...base,
          microphone: { type: 'embedded', bus: ['BusA'] },
        }).success
      ).toBe(false);
      expect(
        participantAddTool.schema.safeParse({
          ...base,
          microphone: { type: 'embedded', bus: ['M', 'A', 'G'] },
        }).success
      ).toBe(true);
    });
  });

  describe('stale-cache protection when adding inputs (M5)', () => {
    it('invalidates cache, waits, and count-checks before renaming an NDI camera', async () => {
      const before = makeState([makeInput(1, 'Camera 1'), makeInput(2, 'Camera 2')]);
      const after = makeState([
        makeInput(1, 'Camera 1'),
        makeInput(2, 'Camera 2'),
        makeInput(3, 'NDI Source', '{guid-new}'),
      ]);

      let calls = 0;
      vi.mocked(ctx.state.getState).mockImplementation(async () => {
        calls++;
        return calls === 1 ? before : after;
      });

      await runWithTimers(
        participantAddTool.handler(
          {
            name: 'Alice',
            camera: { type: 'ndi', source: 'OBS (Webcam)' },
            microphone: { type: 'embedded', bus: ['M'] },
          },
          ctx
        )
      );

      expect(ctx.state.invalidate).toHaveBeenCalled();
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AddInput', { Value: 'NDI|OBS (Webcam)' });
      // Rename targets the input that appeared in the REFRESHED state
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetInputName', {
        Input: '{guid-new}',
        Value: 'Alice Camera',
      });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });

    it('does not rename anything when the NDI input never appeared', async () => {
      const unchanged = makeState([makeInput(1, 'Camera 1'), makeInput(2, 'Camera 2')]);
      vi.mocked(ctx.state.getState).mockResolvedValue(unchanged);

      const result = await runWithTimers(
        participantAddTool.handler(
          {
            name: 'Alice',
            camera: { type: 'ndi', source: 'Missing NDI' },
            microphone: { type: 'embedded', bus: ['M'] },
          },
          ctx
        )
      );

      const executed = ctx.vmix.http._getExecutedFunctions();
      expect(executed).not.toContain('SetInputName');
      expect(result.content[0]?.text).toContain('could not be added');
    });
  });

  describe('unsupported AddInput short-forms (M7)', () => {
    it('emits manual-setup instructions for capture cameras instead of calling AddInput', async () => {
      const result = await runWithTimers(
        participantAddTool.handler(
          {
            name: 'Bob',
            camera: { type: 'capture', source: 'Logitech BRIO' },
            microphone: { type: 'embedded', bus: ['M'] },
          },
          ctx
        )
      );

      const addInputCalls = ctx.vmix.http
        ._getExecutedCalls()
        .filter((call) => call.func === 'AddInput');
      expect(addInputCalls).toHaveLength(0);

      const text = result.content[0]?.text ?? '';
      expect(text).toContain('Manual setup required');
      expect(text).toContain('Logitech BRIO');
      expect(result.isError).toBeFalsy();
    });

    it('emits manual-setup instructions for audio-device microphones', async () => {
      const result = await runWithTimers(
        participantAddTool.handler(
          {
            name: 'Bob',
            camera: { type: 'existing', source: 'Camera 1' },
            microphone: { type: 'separate', source: 'Shure SM7B (USB)', bus: ['M'] },
          },
          ctx
        )
      );

      const values = ctx.vmix.http
        ._getExecutedCalls()
        .filter((call) => call.func === 'AddInput')
        .map((call) => call.params?.['Value']);
      expect(values).toHaveLength(0);

      const text = result.content[0]?.text ??'';
      expect(text).toContain('Manual setup required');
      expect(text).toContain('Shure SM7B (USB)');
    });

    it('adds file-based separate microphones via AddInput AudioFile|<path>', async () => {
      const before = makeState([makeInput(1, 'Camera 1')]);
      const after = makeState([makeInput(1, 'Camera 1'), makeInput(2, 'mic', '{guid-mic}')]);

      let calls = 0;
      vi.mocked(ctx.state.getState).mockImplementation(async () => {
        calls++;
        // camera 'existing' lookup uses call 1; mic before/after are calls 2/3
        return calls <= 2 ? before : after;
      });

      await runWithTimers(
        participantAddTool.handler(
          {
            name: 'Bob',
            camera: { type: 'existing', source: 'Camera 1' },
            microphone: { type: 'separate', source: 'C:\\Audio\\mic-feed.mp3', bus: ['M'] },
          },
          ctx
        )
      );

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AddInput', {
        Value: 'AudioFile|C:\\Audio\\mic-feed.mp3',
      });
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('SetInputName', {
        Input: '{guid-mic}',
        Value: 'Bob Mic',
      });
      expectExecutedFunctionsAllowlisted(ctx.vmix.http);
    });
  });

  describe('failure paths', () => {
    it('reports audio routing failures in the errors section', async () => {
      ctx.vmix.http._failOnFunction('AudioBusOn', new Error('bus routing failed'));

      const result = await runWithTimers(
        participantAddTool.handler(
          {
            name: 'Alice',
            camera: { type: 'existing', source: 'Camera 1' },
            microphone: { type: 'embedded', bus: ['M'] },
          },
          ctx
        )
      );

      const text = result.content[0]?.text ?? '';
      expect(text).toContain('Failed to route audio');
      expect(text).toContain('bus routing failed');
    });

    it('reports missing existing camera as an error', async () => {
      const result = await runWithTimers(
        participantAddTool.handler(
          {
            name: 'Alice',
            camera: { type: 'existing', source: 'No Such Camera' },
            microphone: { type: 'embedded', bus: ['M'] },
          },
          ctx
        )
      );

      const text = result.content[0]?.text ?? '';
      expect(text).toContain('not found');
      expect(result.isError).toBe(true);
    });
  });
});

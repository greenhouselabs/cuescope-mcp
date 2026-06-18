/**
 * Tests for vmix_generate_api_sequence
 */

import { describe, expect, it } from 'vitest';
import { generateApiSequenceTool } from '../../../../src/tools/brain/generate-api-sequence.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

function createApiSequenceContext() {
  return createMockToolContext({
    initialState: {
      active: 1,
      preview: 2,
      inputs: [
        {
          key: '{host-camera-key}',
          number: 1,
          type: 'Capture',
          title: 'Host Camera',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M,A',
        },
        {
          key: '{guest-camera-key}',
          number: 2,
          type: 'Capture',
          title: 'Guest Camera',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M',
        },
        {
          key: '{lower-third-key}',
          number: 3,
          type: 'GT',
          title: 'Lower Third',
          state: '',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: '',
          fields: {
            'Name.Text': 'Jane Host',
            'Title.Text': 'Producer',
          },
        },
        {
          key: '{music-bed-key}',
          number: 4,
          type: 'Audio',
          title: 'Music Bed',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M',
        },
      ],
    },
  });
}

function createPairedAudioContext() {
  return createMockToolContext({
    initialState: {
      active: 1,
      preview: 2,
      inputs: [
        {
          key: '{video-a}',
          number: 1,
          type: 'Video',
          title: 'Skate Video A',
          state: 'Running',
          position: 1000,
          duration: 30000,
          muted: true,
          loop: true,
          audioBuses: 'A',
        },
        {
          key: '{video-b}',
          number: 2,
          type: 'Video',
          title: 'Skate Video B',
          state: 'Running',
          position: 0,
          duration: 30000,
          muted: true,
          loop: true,
          audioBuses: 'B',
        },
        {
          key: '{music-a}',
          number: 9,
          type: 'Audio',
          title: 'Song A.mp3',
          state: 'Paused',
          position: 0,
          duration: 180000,
          muted: false,
          loop: false,
          audioBuses: 'A',
        },
        {
          key: '{music-b}',
          number: 10,
          type: 'Audio',
          title: 'Song B.mp3',
          state: 'Paused',
          position: 0,
          duration: 180000,
          muted: false,
          loop: false,
          audioBuses: 'B',
        },
      ],
    },
  });
}

function createCallerReturnPairedAudioContext() {
  return createMockToolContext({
    initialState: {
      active: 54,
      preview: 33,
      inputs: [
        {
          key: '{prod-1-call}',
          number: 54,
          type: 'VideoCall',
          title: 'Prod 1 Call',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'B,C,D',
        },
        {
          key: '{return-feed}',
          number: 42,
          type: 'Audio',
          title: 'Return Feed',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'C,D,E',
        },
        {
          key: '{show-open}',
          number: 33,
          type: 'Video',
          title: 'Offline - Show Open',
          state: 'Paused',
          position: 0,
          duration: 30000,
          muted: false,
          loop: false,
          audioBuses: 'M',
        },
      ],
    },
  });
}

function createBlockedPreflightContext() {
  return createMockToolContext({
    initialState: {
      streaming: true,
      fadeToBlack: true,
      audio: {
        master: { volume: 0, muted: true },
      },
    },
  });
}

describe('vmix_generate_api_sequence', () => {
  it('has the expected tool name', () => {
    expect(generateApiSequenceTool.name).toBe('vmix_generate_api_sequence');
  });

  it('generates a read-only fade sequence using stable input keys', async () => {
    const ctx = createApiSequenceContext();
    const result = await generateApiSequenceTool.handler({ goal: 'Fade to Guest Camera' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    expect(data.execution.executed).toBe(false);
    expect(data.pattern).toBe('switchInput');
    expect(data.valid).toBe(true);
    expect(data.sequence[0].function).toBe('Fade');
    expect(data.sequence[0].params.Input).toBe('{guest-camera-key}');
    expect(data.requiredInputs[0].title).toBe('Guest Camera');
  });

  it('generates a timed overlay sequence with advisory delay', async () => {
    const ctx = createApiSequenceContext();
    const result = await generateApiSequenceTool.handler(
      { goal: 'Show the lower third on overlay 2 for 5 seconds' },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('timedOverlay');
    expect(data.sequence).toHaveLength(2);
    expect(data.sequence[0].function).toBe('OverlayInput2In');
    expect(data.sequence[0].params.Input).toBe('{lower-third-key}');
    expect(data.sequence[0].delayAfterMs).toBe(5000);
    expect(data.sequence[1].function).toBe('OverlayInput2Out');
    expect(data.failureModes.join('\n')).toContain('delay is advisory');
  });

  it('generates title text update calls with exact field names', async () => {
    const ctx = createApiSequenceContext();
    const result = await generateApiSequenceTool.handler(
      { goal: 'Update title Name to Steve Director' },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('titleTextUpdate');
    expect(data.sequence[0].function).toBe('SetText');
    expect(data.sequence[0].params.Input).toBe('{lower-third-key}');
    expect(data.sequence[0].params.SelectedName).toBe('Name.Text');
    expect(data.sequence[0].params.Value).toBe('Steve Director');
    expect(data.requiredFields[0].fields).toEqual(['Name.Text']);
  });

  it('generates volume change calls with clamped numeric values', async () => {
    const ctx = createApiSequenceContext();
    const result = await generateApiSequenceTool.handler({ goal: 'Set Music Bed volume to 135' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('volumeChange');
    expect(data.sequence[0].function).toBe('SetVolume');
    expect(data.sequence[0].params.Input).toBe('{music-bed-key}');
    expect(data.sequence[0].params.Value).toBe(100);
    expect(data.assumptions.join('\n')).toContain('0-100');
  });

  it('flags recording and streaming control as high-risk review-only plans', async () => {
    const ctx = createApiSequenceContext();
    const result = await generateApiSequenceTool.handler({ goal: 'Start recording' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.valid).toBe(true);
    expect(data.pattern).toBe('recordingControl');
    expect(data.sequence[0].function).toBe('StartRecording');
    expect(data.sequence[0].risk).toBe('high');
    expect(data.issues[0].severity).toBe('warning');
    expect(data.issues[0].message).toContain('show-critical');
  });

  it('includes blocked preflight handoff on high-impact API plans', async () => {
    const ctx = createBlockedPreflightContext();
    const result = await generateApiSequenceTool.handler({ goal: 'Start streaming' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    expect(data.valid).toBe(true);
    expect(data.pattern).toBe('recordingControl');
    expect(data.automationPreflight).toMatchObject({
      status: 'blocked',
      blocksExecution: true,
      shouldReviewBeforeExecution: true,
    });
    expect(data.issues.map((issue: { message: string }) => issue.message).join('\n'))
      .toContain('Preflight is blocked before API sequence execution');
    expect(data.reviewChecklist[0]).toContain('Do not execute');
    expect(data.reviewChecklist.join('\n')).toContain('Resolve every blocked');
  });

  it('generates a one-shot paired-audio sequence for the current Program video', async () => {
    const ctx = createPairedAudioContext();
    const result = await generateApiSequenceTool.handler(
      { goal: 'Auto-play the matching music track when a video goes to Program' },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    expect(data.valid).toBe(true);
    expect(data.pattern).toBe('pairedAudioFollow');
    expect(data.sequence.map((step: { function: string }) => step.function)).toEqual([
      'Pause',
      'Restart',
      'Play',
    ]);
    expect(data.sequence[0].params.Input).toBe('{music-b}');
    expect(data.sequence[1].params.Input).toBe('{music-a}');
    expect(data.sequence).toHaveLength(3);
    expect(data.issues.map((issue: { message: string }) => issue.message).join('\n'))
      .toContain('one-shot');
    expect(data.issues.map((issue: { message: string }) => issue.message).join('\n'))
      .toContain('not routed to Master');
  });

  it('generates a paired-audio one-shot resume sequence without Restart when requested', async () => {
    const ctx = createPairedAudioContext();
    const result = await generateApiSequenceTool.handler(
      { goal: 'Resume the matching music instead of restarting it from 0:00 when a video goes to Program' },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('pairedAudioFollow');
    expect(data.sequence.map((step: { function: string }) => step.function)).toEqual([
      'Pause',
      'Play',
    ]);
    expect(data.sequence[1].params.Input).toBe('{music-a}');
    expect(data.assumptions.join('\n')).toContain('Play only');
  });

  it('does not infer paired music from vMix Call return-feed routing', async () => {
    const ctx = createCallerReturnPairedAudioContext();
    const result = await generateApiSequenceTool.handler(
      { goal: 'Auto-play the matching music track when a video goes to Program' },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    expect(data.valid).toBe(true);
    expect(data.pattern).toBe('pairedAudioFollow');
    expect(data.confidence).toBeLessThan(0.5);
    expect(data.sequence).toEqual([]);
    expect(data.requiredInputs).toEqual([]);
    expect(data.explanation).toContain('No safe video/music pair');
    expect(data.issues.map((issue: { message: string }) => issue.message).join('\n'))
      .toContain('No safe paired video/music relationship was detected');
    expect(data.reviewChecklist.join('\n')).toContain('Identify the real video inputs');
    expect(JSON.stringify(data.sequence)).not.toContain('Return Feed');
    expect(JSON.stringify(data.sequence)).not.toContain('Prod 1 Call');
  });

  it('returns a custom review template for unsupported goals', async () => {
    const ctx = createApiSequenceContext();
    const result = await generateApiSequenceTool.handler({ goal: 'Prepare my very specific custom thing' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('customSequence');
    expect(data.sequence).toEqual([]);
    expect(data.confidence).toBeLessThan(0.5);
    expect(data.issues[0].severity).toBe('info');
    expect(data.reviewChecklist.join('\n')).toContain('vmix_find_input');
  });
});

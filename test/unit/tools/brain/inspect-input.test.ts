/**
 * Tests for vmix_inspect_input
 */

import { describe, expect, it } from 'vitest';
import { inspectInputTool } from '../../../../src/tools/brain/inspect-input.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

function createInputInspectionContext() {
  return createMockToolContext({
    initialState: {
      active: 1,
      preview: 2,
      overlays: [8, null, null, null],
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
          key: '{guest-call-key}',
          number: 2,
          type: 'vMixCall',
          title: 'Remote Guest',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M',
        },
        {
          key: '{preshow-key}',
          number: 8,
          type: 'GT',
          title: 'Preshow',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M',
          fields: {
            'Topic.Text': 'Build or Buy - How to Know',
            'Countdown.Text': '00:00',
            'Description.Text': 'Pull up a chair.',
          },
        },
      ],
    },
  });
}

describe('vmix_inspect_input', () => {
  it('has the expected tool name', () => {
    expect(inspectInputTool.name).toBe('vmix_inspect_input');
  });

  it('answers basic current-input questions from live state without requesting a saved preset', async () => {
    const ctx = createInputInspectionContext();
    const result = await inspectInputTool.handler(
      { input: 8, question: 'What is Input 8 in my vMix preset?' },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(result.isError).toBeUndefined();
    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    expect(data.status).toBe('answered-from-live-state');
    expect(data.evidenceLane).toMatchObject({
      primary: 'live-state',
      savedPresetFileRead: false,
      fileSearchPerformed: false,
    });
    expect(data.liveSummary).toMatchObject({
      number: 8,
      title: 'Preshow',
      type: 'GT',
      role: 'titleGraphic',
    });
    expect(data.liveSummary.fields.values['Countdown.Text']).toBe('00:00');
    expect(data.savedPresetGuidance.neededForThisQuestion).toBe(false);
    expect(data.savedPresetGuidance.explicitRequestToUser).toContain('No saved .vmix file is needed');
    expect(data.responseGuidance).toContain('Answer directly from live state');
  });

  it('asks explicitly for a .vmix path or file content when the question needs saved-only evidence', async () => {
    const ctx = createInputInspectionContext();
    const result = await inspectInputTool.handler(
      { input: 8, question: 'What is driving the Countdown field?' },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(result.isError).toBeUndefined();
    expect(data.status).toBe('partial');
    expect(data.liveSummary.title).toBe('Preshow');
    expect(data.liveSummary.fields.values['Countdown.Text']).toBe('00:00');
    expect(data.savedPresetGuidance.neededForThisQuestion).toBe(true);
    expect(data.savedPresetGuidance.neededFor.join('\n')).toContain(
      'scripts, triggers, or data sources that may update visible fields'
    );
    expect(data.savedPresetGuidance.explicitRequestToUser).toContain(
      'absolute path to the .vmix file'
    );
    expect(data.savedPresetGuidance.explicitRequestToUser).toContain(
      'machine running CueScope'
    );
    expect(data.savedPresetGuidance.pathHandoffNote).toContain('chat-uploaded .vmix attachment');
    expect(data.savedPresetGuidance.fileSearchPerformed).toBe(false);
    expect(data.savedPresetGuidance.reasonNotAutoRead).toContain('does not scan local folders');
    expect(data.responseGuidance).toContain('Answer the live-state portion first');
  });

  it('keeps saved-preset requests out of ordinary input-not-found responses', async () => {
    const ctx = createInputInspectionContext();
    const result = await inspectInputTool.handler(
      { input: 42, question: 'What is Input 42?' },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(result.isError).toBe(true);
    expect(data.status).toBe('input-not-found');
    expect(data.liveInspection.error).toContain('Input not found');
    expect(data.savedPresetGuidance.neededForThisQuestion).toBe(false);
    expect(data.responseGuidance).toContain('Do not ask for a saved .vmix file');
  });

  it('points disconnected live-state questions to connection diagnosis before saved files', async () => {
    const ctx = createInputInspectionContext();
    ctx.state.getState = async () => {
      throw new Error('Cannot reach vMix: connection refused');
    };

    const result = await inspectInputTool.handler(
      { input: 8, question: 'What is Input 8 in my vMix preset?' },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(result.isError).toBe(true);
    expect(data.status).toBe('live-state-unavailable');
    expect(data.error).toContain('connection refused');
    expect(data.connectionGuidance.nextTool).toBe('vmix_connection_test');
    expect(data.savedPresetGuidance.neededForThisQuestion).toBe(false);
    expect(data.responseGuidance).toContain('Run vmix_connection_test before asking');
  });

  it('marks scripts and triggers as saved-only when the user asks about them', async () => {
    const ctx = createInputInspectionContext();
    const result = await inspectInputTool.handler(
      { input: 'Preshow', question: 'What triggers or scripts are attached to this input?' },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.status).toBe('partial');
    expect(data.savedPresetGuidance.neededFor).toContain('stored VB.NET scripts');
    expect(data.savedPresetGuidance.neededFor).toContain(
      'saved input triggers and shortcut-style references'
    );
    expect(data.savedPresetGuidance.reason).toContain('saved scripts, triggers');
  });
});

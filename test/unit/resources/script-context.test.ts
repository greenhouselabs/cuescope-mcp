/**
 * Tests for vmix://script/context resource
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { scriptContextResource, buildScriptContext } from '../../../src/resources/script-context.js';
import { createMockStateCache } from '../../mocks/tool-context.mock.js';
import { createMockVmixClient } from '../../mocks/vmix-client.mock.js';
import { createTestConfig } from '../../../src/config/index.js';
import type { ResourceContext } from '../../../src/resources/base.js';
import type { VmixState } from '../../../src/state/types.js';

describe('vmix://script/context', () => {
  let ctx: ResourceContext;

  beforeEach(() => {
    ctx = {
      state: createMockStateCache(),
      vmix: createMockVmixClient(),
      config: createTestConfig(),
    };
  });

  it('has correct URI', () => {
    expect(scriptContextResource.uri).toBe('vmix://script/context');
  });

  it('returns text content type', async () => {
    const result = await scriptContextResource.handler(ctx);

    expect(result.contents[0]?.mimeType).toBe('text/plain');
  });

  it('includes input list header', async () => {
    const result = await scriptContextResource.handler(ctx);
    const text = result.contents[0]?.text ?? '';

    expect(text).toContain('Available Inputs');
  });

  it('includes current state section', async () => {
    const result = await scriptContextResource.handler(ctx);
    const text = result.contents[0]?.text ?? '';

    expect(text).toContain('Current State');
    expect(text).toContain('Program:');
    expect(text).toContain('Preview:');
  });

  it('includes case-sensitivity warning', async () => {
    const result = await scriptContextResource.handler(ctx);
    const text = result.contents[0]?.text ?? '';

    expect(text).toContain('case-sensitive');
  });
});

describe('buildScriptContext', () => {
  it('lists all inputs with numbers and names', () => {
    const state: VmixState = {
      version: '27.0.0',
      edition: '4K',
      active: 1,
      preview: 2,
      fadeToBlack: false,
      recording: false,
      streaming: false,
      external: false,
      inputs: [
        {
          number: 1,
          key: 'abc123',
          title: 'Camera 1',
          type: 'Capture',
          state: 'Running',
          muted: false,
          audioBuses: 'M',
        },
        {
          number: 2,
          key: 'def456',
          title: 'Video Clip',
          type: 'Video',
          state: 'Paused',
          muted: true,
          audioBuses: 'M,A',
          position: 5000,
          duration: 60000,
        },
      ],
      overlays: [null, null, null, null],
      audio: { master: { volume: 100, muted: false } },
    };

    const context = buildScriptContext(state);

    expect(context).toContain('Input 1: "Camera 1"');
    expect(context).toContain('Input 2: "Video Clip"');
  });

  it('shows title fields when present', () => {
    const state: VmixState = {
      version: '27.0.0',
      edition: '4K',
      active: 1,
      preview: 2,
      fadeToBlack: false,
      recording: false,
      streaming: false,
      external: false,
      inputs: [
        {
          number: 1,
          key: 'abc123',
          title: 'Lower Third',
          type: 'GT',
          state: 'Running',
          muted: false,
          audioBuses: 'M',
          fields: {
            'Name.Text': 'John Smith',
            'Title.Text': 'CEO',
          },
        },
      ],
      overlays: [null, null, null, null],
      audio: { master: { volume: 100, muted: false } },
    };

    const context = buildScriptContext(state);

    expect(context).toContain('Lower Third');
    expect(context).toContain('Name.Text');
    expect(context).toContain('Title.Text');
  });

  it('includes XAML title inputs in the title fields section', () => {
    const state: VmixState = {
      version: '27.0.0',
      edition: '4K',
      active: 1,
      preview: 2,
      fadeToBlack: false,
      recording: false,
      streaming: false,
      external: false,
      inputs: [
        {
          number: 1,
          key: 'xaml-1',
          title: 'Scorebug',
          type: 'Xaml',
          state: 'Running',
          muted: false,
          audioBuses: 'M',
          fields: {
            'HomeScore.Text': '0',
            'AwayScore.Text': '0',
          },
        },
      ],
      overlays: [null, null, null, null],
      audio: { master: { volume: 100, muted: false } },
    };

    const context = buildScriptContext(state);

    expect(context).toContain('"Scorebug":');
    expect(context).toContain('HomeScore.Text');
    expect(context).not.toContain('No GT/Title/XAML title inputs found');
  });

  it('shows current program and preview', () => {
    const state: VmixState = {
      version: '27.0.0',
      edition: '4K',
      active: 3,
      preview: 5,
      fadeToBlack: false,
      recording: true,
      streaming: true,
      external: false,
      inputs: [],
      overlays: [null, null, null, null],
      audio: { master: { volume: 100, muted: false } },
    };

    const context = buildScriptContext(state);

    expect(context).toContain('Program: Input 3');
    expect(context).toContain('Preview: Input 5');
    expect(context).toContain('Recording: Yes');
    expect(context).toContain('Streaming: Yes');
  });
});

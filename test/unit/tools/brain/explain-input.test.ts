/**
 * Tests for vmix_explain_input
 */

import { describe, expect, it } from 'vitest';
import { explainInputTool } from '../../../../src/tools/brain/explain-input.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

function createExplainContext() {
  return createMockToolContext({
    initialState: {
      active: 1,
      preview: 2,
      overlays: [3, null, null, null],
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
          key: '{intro-key}',
          number: 4,
          type: 'Video',
          title: 'Intro Video',
          state: 'Paused',
          position: 1000,
          duration: 30000,
          muted: true,
          loop: false,
          audioBuses: 'M',
        },
        {
          key: '{intro-backup-key}',
          number: 5,
          type: 'Video',
          title: 'Intro Backup',
          state: 'Paused',
          position: 0,
          duration: 25000,
          muted: false,
          loop: false,
          audioBuses: 'M',
        },
      ],
    },
  });
}

function createContextWithManyMasterPeers() {
  const inputs = Array.from({ length: 16 }, (_, index) => {
    const number = index + 1;
    return {
      key: `{peer-${number}}`,
      number,
      type: 'Capture',
      title: number === 1 ? 'Host Camera' : `Peer Camera ${number}`,
      state: 'Running',
      position: 0,
      duration: 0,
      muted: number % 5 === 0,
      loop: false,
      audioBuses: 'M',
    };
  });

  return createMockToolContext({
    initialState: {
      active: 1,
      preview: 2,
      overlays: [null, null, null, null],
      inputs,
    },
  });
}

describe('vmix_explain_input', () => {
  it('has the expected tool name', () => {
    expect(explainInputTool.name).toBe('vmix_explain_input');
  });

  it('explains an input resolved by key', async () => {
    const ctx = createExplainContext();
    const result = await explainInputTool.handler({ input: '{host-camera-key}' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    expect(data.resolution.matchedBy).toBe('key');
    expect(data.input.title).toBe('Host Camera');
    expect(data.input.role).toBe('camera');
    expect(data.input.productionRole.primary.role).toBe('hostCamera');
    expect(data.references.preferred).toBe('{host-camera-key}');
    expect(data.placement.program).toBe(true);
    expect(data.placement.preview).toBe(false);
    expect(data.audio.buses).toEqual(['M', 'A']);
    expect(data.audio.busPeers[0].bus).toBe('M');
    expect(data.audio.busPeers[0].totalPeers).toBe(3);
    expect(data.audio.busPeers[0].truncated).toBe(false);
    expect(data.suggestions[0]).toContain('{host-camera-key}');
    expect(data.analysisConfidence.level).toBe('high');
    expect(data.analysisConfidence.signals.map((signal: { name: string }) => signal.name))
      .toContain('resolution');
    expect(data.assumptionDetails.length).toBeGreaterThan(0);
  });

  it('caps noisy audio bus peer lists and reports truncation metadata', async () => {
    const ctx = createContextWithManyMasterPeers();
    const result = await explainInputTool.handler({ input: '{peer-1}' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const masterPeers = data.audio.busPeers[0];

    expect(masterPeers.bus).toBe('M');
    expect(masterPeers.totalPeers).toBe(15);
    expect(masterPeers.returned).toBe(10);
    expect(masterPeers.limit).toBe(10);
    expect(masterPeers.truncated).toBe(true);
    expect(masterPeers.omittedCount).toBe(5);
    expect(masterPeers.otherInputs).toHaveLength(10);
    expect(masterPeers.roleCounts.camera).toBe(15);
    expect(masterPeers.productionRoleCounts.hostCamera).toBeGreaterThan(0);
    expect(data.outputWarnings[0]).toContain('returned 10 of 15');
  });

  it('explains title fields and overlay placement', async () => {
    const ctx = createExplainContext();
    const result = await explainInputTool.handler({ input: 'Lower Third' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.input.role).toBe('titleGraphic');
    expect(data.input.productionRole.primary.role).toBe('lowerThird');
    expect(data.placement.overlays).toEqual([1]);
    expect(data.fields.count).toBe(2);
    expect(data.fields.names).toContain('Name.Text');
    expect(data.fields.values['Name.Text']).toBe('Jane Host');
    expect(data.suggestions.join('\n')).toContain('Name.Text');
  });

  it('includes playback details and warnings for muted routed media', async () => {
    const ctx = createExplainContext();
    const result = await explainInputTool.handler({ input: 4 }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.resolution.matchedBy).toBe('number');
    expect(data.input.title).toBe('Intro Video');
    expect(data.input.productionRole.primary.role).toBe('introOutro');
    expect(data.playback.remainingMs).toBe(29000);
    expect(data.playback.progressPercent).toBe(3.3);
    expect(data.warnings).toContain('This input is muted while routed to one or more audio buses.');
  });

  it('flags an offline slate-style input when it is currently on Program', async () => {
    const ctx = createMockToolContext({
      initialState: {
        active: 19,
        preview: 2,
        overlays: [null, null, null, null],
        inputs: [
          {
            key: '{offline-slate-key}',
            number: 19,
            type: 'Placeholder',
            title: 'Offline - GFX - SHOW SLATE',
            state: 'Paused',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: '',
          },
        ],
      },
    });

    const result = await explainInputTool.handler({ input: 19 }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.placement.program).toBe(true);
    expect(data.warnings.join('\n')).toContain(
      'Program is currently an offline/slate-style input'
    );
    expect(data.productionRisks).toContainEqual(
      expect.objectContaining({
        severity: 'warning',
        category: 'program',
        message: 'Program is currently an offline/slate-style input: Offline - GFX - SHOW SLATE.',
      })
    );
  });

  it('does not guess when a partial title is ambiguous', async () => {
    const ctx = createExplainContext();
    const result = await explainInputTool.handler({ input: 'Intro' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(result.isError).toBe(true);
    expect(data.error).toContain('Input not found');
    expect(data.candidates).toHaveLength(2);
    expect(data.analysisConfidence.level).toBe('low');
  });

  it('returns helpful hints when no input matches', async () => {
    const ctx = createExplainContext();
    const result = await explainInputTool.handler({ input: 'Does Not Exist' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(result.isError).toBe(true);
    expect(data.hints.join('\n')).toContain('vmix_find_input');
    expect(data.hints.join('\n')).toContain('Available inputs');
    expect(data.assumptionDetails[0].statement).toContain('current XML cache');
  });
});

/**
 * Tests for vmix_analyze_preset
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { analyzePresetTool } from '../../../../src/tools/brain/analyze-preset.js';
import { parseVmixState } from '../../../../src/state/parser.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

function readFixtureState(name: string) {
  const xml = readFileSync(join(__dirname, '../../../mocks/fixtures', name), 'utf-8');
  return parseVmixState(xml);
}

describe('vmix_analyze_preset', () => {
  it('has the expected tool name', () => {
    expect(analyzePresetTool.name).toBe('vmix_analyze_preset');
  });

  it('defaults to a compact summary instead of a full input dump', async () => {
    const ctx = createMockToolContext({
      initialState: {
        active: 1,
        preview: 2,
        inputs: [
          {
            key: '{camera-1}',
            number: 1,
            type: 'Capture',
            title: 'Host Camera',
            state: 'Running',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: 'M',
          },
          {
            key: '{lower-third}',
            number: 2,
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
            },
          },
        ],
      },
    });

    const result = await analyzePresetTool.handler({}, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.detail).toBe('summary');
    expect(data.inputs).toBeUndefined();
    expect(data.inputIndex).toHaveLength(2);
    expect(data.inputIndexTotal).toBe(2);
    expect(data.inputIndexReturned).toBe(2);
    expect(data.inputIndexLimit).toBe(20);
    expect(data.inputIndexTruncated).toBe(false);
    expect(data.outputWarnings).toEqual([]);
    expect(data.inputIndex[0]).toMatchObject({
      number: 1,
      title: 'Host Camera',
      stableReference: '{camera-1}',
    });
    expect(data.productionSummary.inventoryCounts).toBeDefined();
    expect(data.productionSummary.inventory).toBeUndefined();
    expect(data.audio.routing).toBeUndefined();
    expect(data.audio.routingSummary).toBeDefined();
    expect(data.relationships.inputUsages).toBeUndefined();
    expect(data.fullResultHint).toContain('detail:"full"');
  });

  it('truncates the summary input index for large presets', async () => {
    const ctx = createMockToolContext({
      initialState: {
        active: 1,
        preview: 2,
        inputs: Array.from({ length: 30 }, (_, index) => ({
          key: `{input-${index + 1}}`,
          number: index + 1,
          type: index % 2 === 0 ? 'Capture' : 'GT',
          title: `Input ${index + 1}`,
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: index % 2 === 0 ? 'M' : '',
          fields: index % 2 === 0 ? undefined : { 'Message.Text': `Input ${index + 1}` },
        })),
      },
    });

    const result = await analyzePresetTool.handler({}, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.detail).toBe('summary');
    expect(data.inputs).toBeUndefined();
    expect(data.inputIndex).toHaveLength(20);
    expect(data.inputIndexTotal).toBe(30);
    expect(data.inputIndexReturned).toBe(20);
    expect(data.inputIndexLimit).toBe(20);
    expect(data.inputIndexTruncated).toBe(true);
    expect(data.outputWarnings[0]).toContain('returned 20 of 30');
    expect(data.outputWarnings[0]).toContain('detail:"full"');
  });

  it('returns a read-only production map from current state', async () => {
    const ctx = createMockToolContext({
      initialState: {
        active: 1,
        preview: 2,
        overlays: [3, null, null, null],
        inputs: [
          {
            key: '{camera-1}',
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
            key: '{guest-1}',
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
            key: '{lower-third}',
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
            key: '{intro}',
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
        ],
      },
    });

    const result = await analyzePresetTool.handler({ detail: 'full' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    expect(data.summary.inputCount).toBe(4);
    expect(data.program.inputTitle).toBe('Host Camera');
    expect(data.inputs[data.program.inputNumber].productionRole.primary.role).toBe('hostCamera');
    expect(data.preview.inputTitle).toBe('Remote Guest');
    expect(data.inputs[data.preview.inputNumber].productionRole.primary.role).toBe('callInput');
    expect(data.inputSummary.cameras).toBe(1);
    expect(data.inputSummary.remoteGuests).toBe(1);
    expect(data.inputSummary.titleGraphics).toBe(1);
    expect(data.inputSummary.mediaPlayback).toBe(1);
    expect(data.inputSummary.productionRoles.hostCamera).toBe(1);
    expect(data.inputSummary.productionRoles.callInput).toBe(1);
    expect(data.inputs[data.inputsByRole.titleGraphic[0]].fieldNames).toEqual([
      'Name.Text',
      'Title.Text',
    ]);
    expect(data.inputs[data.inputsByRole.titleGraphic[0]].productionRole.primary.role).toBe('lowerThird');
    expect(data.productionRoles.counts.lowerThird).toBe(1);
    expect(data.inputs[data.productionRoles.inputsByPrimaryRole.introOutro[0]].title).toBe('Intro Video');
    expect(data.productionSummary.showMap.program.input.title).toBe('Host Camera');
    expect(data.productionSummary.showMap.preview.input.productionRole).toBe('callInput');
    expect(data.productionSummary.outputReadiness.observed.status).toBe('idle');
    expect(data.productionSummary.outputReadiness.observed.activeOutputCount).toBe(0);
    expect(data.productionSummary.outputReadiness.unknowns).toContain(
      'which video mix feeds each output destination'
    );
    expect(data.productionSummary.preflightReport).toMatchObject({
      status: 'caution',
      summary: '1 caution item(s) need operator review before go-live or automation.',
    });
    expect(
      data.productionSummary.preflightReport.checks.find((check: { id: string }) => check.id === 'audio')
    ).toMatchObject({
      status: 'caution',
    });
    expect(data.productionSummary.preflightReport.operatorChecklist.join('\n')).toContain(
      'Confirm Program and Preview'
    );
    expect(data.productionSummary.inventory.liveSources.map((input: { title: string }) => input.title))
      .toEqual(['Host Camera', 'Remote Guest']);
    expect(data.productionSummary.inventory.graphics[0].productionRole).toBe('lowerThird');
    expect(data.productionSummary.graphicsInventory.fieldInputs[0].fieldNames).toEqual([
      'Name.Text',
      'Title.Text',
    ]);
    expect(data.productionSummary.audioRouting.buses.M.inputCount).toBe(3);
    expect(data.productionSummary.audioRouting.buses.M.likelyGuestOrCallCount).toBe(1);
    expect(data.productionSummary.audioRouting.mutedRoutedInputs[0].title).toBe('Intro Video');
    expect(data.productionSummary.overlayUsage.activeChannels[0]).toMatchObject({
      channel: 1,
      likelyGraphic: true,
    });
    expect(data.productionSummary.riskWarnings.map((risk: { message: string }) => risk.message))
      .toContain('1 routed input(s) are muted.');
    expect(data.analysisConfidence.level).toMatch(/high|medium|low/);
    expect(data.analysisConfidence.signals.map((signal: { name: string }) => signal.name))
      .toContain('productionRoleInference');
    expect(data.assumptionDetails.map((assumption: { statement: string }) => assumption.statement).join('\n'))
      .toContain('Production roles are heuristic');
    expect(data.overlays[0].inputTitle).toBe('Lower Third');
    expect(data.audio.buses.M.map((n: number) => data.inputs[n].title)).toContain('Host Camera');
    expect(data.audio.buses.A.map((n: number) => data.inputs[n].title)).toContain('Host Camera');
    expect(data.relationships.activeInput.title).toBe('Host Camera');
    expect(data.relationships.previewInput.title).toBe('Remote Guest');
    expect(data.relationships.overlays[0].input.title).toBe('Lower Third');
    expect(data.relationships.inputUsages.find((usage: { input: { title: string } }) => usage.input.title === 'Host Camera'))
      .toMatchObject({
        program: true,
        audioBuses: ['M', 'A'],
      });
    expect(data.warnings).toContain('1 routed input(s) are muted: Intro Video.');
    expect(data.assumptions[0]).toContain('read-only');
    expect(data.parserLimitations.length).toBeGreaterThan(0);
  });

  it('warns when no obvious live sources are detected', async () => {
    const ctx = createMockToolContext({
      initialState: {
        active: 1,
        preview: 1,
        inputs: [
          {
            key: '{graphic}',
            number: 1,
            type: 'GT',
            title: 'Scorebug',
            state: '',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: '',
            fields: {
              'Home.Text': '0',
              'Away.Text': '0',
            },
          },
        ],
      },
    });

    const result = await analyzePresetTool.handler({ detail: 'full' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.warnings).toContain('No obvious live camera or remote guest sources were detected.');
    expect(data.productionSummary.riskWarnings.map((risk: { message: string }) => risk.message))
      .toContain('No obvious live host, guest, or call source was detected.');
  });

  it('treats muted Program video with inferred paired music as a warning, not a critical blocker', async () => {
    const ctx = createMockToolContext({
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

    const result = await analyzePresetTool.handler({ detail: 'full' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const programAudioRisk = data.productionSummary.riskWarnings.find(
      (risk: { category: string; message: string }) =>
        risk.category === 'audio' && risk.message.includes('Skate Video A')
    );

    expect(programAudioRisk.severity).toBe('warning');
    expect(programAudioRisk.message).toContain('paired music bed');
    expect(data.productionSummary.riskSummary.critical).toBe(0);
    expect(data.productionSummary.riskWarnings.map((risk: { message: string }) => risk.message).join('\n'))
      .toContain('muted routed video input');
  });

  it('maps a paired aux-bus video show without losing timer fields or overcritical audio severity', async () => {
    const ctx = createMockToolContext({
      initialState: readFixtureState('state-paired-audio-aux-bus.xml'),
    });

    const result = await analyzePresetTool.handler({ detail: 'full' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const programAudioRisk = data.productionSummary.riskWarnings.find(
      (risk: { category: string; message: string }) =>
        risk.category === 'audio' && risk.message.includes('Skate Event - Skatercross')
    );

    expect(data.summary.inputCount).toBe(14);
    expect(data.program.inputTitle).toBe('Skate Event - Skatercross.mp4');
    expect(data.preview.inputTitle).toBe('Skate Event - Vert Jam.mp4');
    expect(data.productionSummary.showPatterns[0]).toMatchObject({
      id: 'pairedAudioVideoShow',
      label: 'Paired silent-video/music-bed show',
    });
    expect(data.productionSummary.showPatterns[0].confidence).toBeGreaterThanOrEqual(0.9);
    expect(data.productionSummary.showPatterns[0].evidence).toContain(
      '1 Skate Event - Skatercross.mp4 -> 9 Music Bed A.mp3 on Bus A'
    );
    expect(data.productionSummary.showPatterns[0].caveats.join('\n')).toContain(
      'paired music bed(s) are not routed to Master'
    );
    expect(data.productionSummary.showPatterns[0].recommendedChecks.join('\n')).toContain(
      'restart or resume'
    );
    expect(data.productionSummary.graphicsInventory.fieldInputs).toHaveLength(4);
    expect(
      data.productionSummary.graphicsInventory.fieldInputs.every(
        (input: { fieldNames: string[] }) => input.fieldNames.includes('Time.Text')
      )
    ).toBe(true);
    expect(programAudioRisk.severity).toBe('warning');
    expect(programAudioRisk.message).toContain('paired music bed');
    expect(data.productionSummary.riskSummary.critical).toBe(0);
  });

  it('identifies remote guest mix-minus style shows from a podcast fixture', async () => {
    const ctx = createMockToolContext({
      initialState: readFixtureState('state-podcast-calls.xml'),
    });

    const result = await analyzePresetTool.handler({ detail: 'full' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const remotePattern = data.productionSummary.showPatterns.find(
      (pattern: { id: string }) => pattern.id === 'remoteGuestMixMinusShow'
    );

    expect(remotePattern).toMatchObject({
      id: 'remoteGuestMixMinusShow',
      label: 'Remote guest / mix-minus show',
    });
    expect(remotePattern.confidence).toBeGreaterThanOrEqual(0.9);
    expect(remotePattern.evidence).toContain('2 Guest A Call: routed to M, A');
    expect(remotePattern.evidence).toContain('3 Guest B Call: routed to M, B');
    expect(remotePattern.caveats.join('\n')).toContain('vMix Call return-bus');
    expect(remotePattern.recommendedChecks.join('\n')).toContain('excludes their own audio');
    expect(remotePattern.docs).toContain('vmix://docs/audio-routing');
  });

  it('identifies sports replay scorebug shows from a multi-mix fixture', async () => {
    const ctx = createMockToolContext({
      initialState: readFixtureState('state-multi-mix.xml'),
    });

    const result = await analyzePresetTool.handler({ detail: 'full' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const sportsPattern = data.productionSummary.showPatterns.find(
      (pattern: { id: string }) => pattern.id === 'sportsReplayScorebugShow'
    );

    expect(sportsPattern).toMatchObject({
      id: 'sportsReplayScorebugShow',
      label: 'Sports/replay show with scorebug',
    });
    expect(sportsPattern.confidence).toBeGreaterThanOrEqual(0.85);
    expect(sportsPattern.evidence).toContain(
      '4 Scorebug: score fields Home.Score, Away.Score, Clock.Text'
    );
    expect(sportsPattern.evidence).toContain('3 Replay Roll-in: replay-like source');
    expect(sportsPattern.evidence).toContain('Scorebug is assigned to an overlay channel');
    expect(sportsPattern.evidence).toContain('5 Mix 2 Clean Feed: mix/clean-feed input');
    expect(sportsPattern.evidence).toContain('Mix 2: active 3 Replay Roll-in, preview 1 Main Camera');
    expect(sportsPattern.caveats.join('\n')).toContain('Replay internals');
    expect(sportsPattern.recommendedChecks.join('\n')).toContain('score/clock values');
    expect(data.productionSummary.outputReadiness.observed).toMatchObject({
      streaming: true,
      external: true,
      status: 'active',
    });
    expect(data.productionSummary.outputReadiness.mixDestinationAwareness).toMatchObject({
      parsedMixCount: 2,
      canMapMixDestinations: false,
    });
    expect(
      data.productionSummary.outputReadiness.risks.map((risk: { message: string }) => risk.message)
    ).toContain('Multiple mix paths are parsed, but final output destination binding is not visible.');
    expect(data.productionSummary.outputReadiness.recommendedChecks.join('\n')).toContain(
      'active output destinations'
    );
    expect(data.productionSummary.preflightReport.status).toBe('caution');
    expect(
      data.productionSummary.preflightReport.checks.find((check: { id: string }) => check.id === 'outputs')
    ).toMatchObject({
      status: 'caution',
    });
    expect(
      data.productionSummary.preflightReport.checks.find((check: { id: string }) => check.id === 'mixes')
    ).toMatchObject({
      status: 'caution',
    });
    expect(data.productionSummary.preflightReport.knownUnknowns).toContain(
      'actual visual appearance of Program, Preview, overlays, and clean feeds'
    );
    expect(data.productionSummary.showMap.mixes[1]).toMatchObject({
      number: 2,
      activeInputNumber: 3,
      activeInput: {
        title: 'Replay Roll-in',
      },
      previewInputNumber: 1,
      previewInput: {
        title: 'Main Camera',
      },
    });
  });

  it('marks preflight blocked when an active output has show-critical blockers', async () => {
    const ctx = createMockToolContext({
      initialState: {
        streaming: true,
        fadeToBlack: true,
        audio: {
          master: { volume: 0, muted: true },
        },
      },
    });

    const result = await analyzePresetTool.handler({ detail: 'full' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.productionSummary.preflightReport.status).toBe('blocked');
    expect(data.productionSummary.preflightReport.blockers.join('\n')).toContain('Fade to Black');
    expect(
      data.productionSummary.preflightReport.checks.find((check: { id: string }) => check.id === 'outputs')
    ).toMatchObject({
      status: 'blocked',
    });
    expect(data.productionSummary.preflightReport.operatorChecklist[0]).toContain('Resolve every blocked');
  });
});

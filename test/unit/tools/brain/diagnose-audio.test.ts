/**
 * Tests for vmix_diagnose_audio
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { diagnoseAudioTool } from '../../../../src/tools/brain/diagnose-audio.js';
import { parseVmixState } from '../../../../src/state/parser.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

function readFixtureState(name: string) {
  const xml = readFileSync(join(__dirname, '../../../mocks/fixtures', name), 'utf-8');
  return parseVmixState(xml);
}

function createProblemAudioContext() {
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
          muted: true,
          loop: false,
          audioBuses: 'M,A',
        },
        {
          key: '{guest-one-key}',
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
          key: '{guest-two-key}',
          number: 3,
          type: 'vMixCall',
          title: 'Remote Guest 2',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M,A',
        },
        {
          key: '{guest-three-key}',
          number: 4,
          type: 'vMixCall',
          title: 'Remote Guest 3',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M,A',
        },
        {
          key: '{music-key}',
          number: 5,
          type: 'Audio',
          title: 'Music Bed',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: '',
        },
        {
          key: '{lower-third-key}',
          number: 6,
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
      audio: {
        master: { volume: 100, muted: false },
        busA: { volume: 60, muted: true },
      },
    },
  });
}

function createCleanAudioContext() {
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
          audioBuses: 'M',
        },
        {
          key: '{guest-key}',
          number: 2,
          type: 'vMixCall',
          title: 'Remote Guest',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M,A',
        },
        {
          key: '{music-key}',
          number: 3,
          type: 'Audio',
          title: 'Music Bed',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M',
        },
        {
          key: '{lower-third-key}',
          number: 4,
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
      audio: {
        master: { volume: 100, muted: false },
        busA: { volume: 100, muted: false },
      },
    },
  });
}

const SAVED_CALL_PRESET = `<XML>
  <Version>9</Version>
  <Input
    Type="6000"
    Title="Remote Guest 2"
    Key="{guest-two-key}"
    Muted="False"
    BusMaster="False"
    BusA="True"
    BusC="True"
    VideoCallKey="SECRET_CALL_KEY"
    VideoCallReturnAudioIndex="4"
    VideoCallReturnVideoName="Output 3"></Input>
</XML>`;

describe('vmix_diagnose_audio', () => {
  it('has the expected tool name', () => {
    expect(diagnoseAudioTool.name).toBe('vmix_diagnose_audio');
  });

  it('diagnoses muted routed inputs, unrouted audio sources, bus mutes, and mix-minus risks', async () => {
    const ctx = createProblemAudioContext();
    const result = await diagnoseAudioTool.handler({}, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const issueTitles = data.issues.map((issue: { title: string }) => issue.title);
    const issueCategories = data.issues.map((issue: { category: string }) => issue.category);

    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    expect(data.summary.inputCount).toBe(6);
    expect(data.summary.remoteGuests).toBe(3);
    expect(data.summary.guestOrCallInputs).toBe(3);
    expect(data.summary.callerReturnCandidates).toBe(2);
    expect(data.summary.monitorOnlyInputs).toBe(0);
    expect(data.summary.mutedRoutedInputs).toBe(1);
    expect(data.summary.unroutedLikelyAudioSources).toBe(1);
    expect(data.summary.issueCounts.critical).toBeGreaterThan(0);
    expect(issueTitles).toContain('Host Camera is muted while routed');
    expect(issueTitles).toContain('Bus A output is muted');
    expect(issueTitles).toContain('Music Bed has no visible audio bus routing');
    expect(issueTitles).toContain('Remote Guest has no obvious mix-minus return bus');
    expect(issueTitles).toContain('Multiple remote guests share Bus A');
    expect(issueTitles).toContain('Bus A may send callers their own audio');
    expect(issueCategories).toContain('programAudio');
    expect(issueCategories).toContain('mixMinus');
    expect(issueCategories).toContain('feedbackLoop');
    expect(data.issues.find((issue: { title: string }) => issue.title === 'Bus A may send callers their own audio').inputs[0])
      .toMatchObject({
        title: 'Remote Guest 2',
        productionRole: 'callInput',
      });
    const feedbackIssue = data.issues.find(
      (issue: { title: string }) => issue.title === 'Bus A may send callers their own audio'
    );
    expect(feedbackIssue.recommendation).toContain('shared caller return');
    expect(feedbackIssue.recommendation).toContain('dedicated return buses per caller');
    expect(feedbackIssue.recommendation).not.toContain("remove each caller's own input");
    expect(data.analysisConfidence.signals.map((signal: { name: string }) => signal.name))
      .toContain('busOutputVisibility');
    expect(data.assumptionDetails.map((assumption: { statement: string }) => assumption.statement).join('\n'))
      .toContain('vMix Call return-bus');
    expect(data.recommendations.join('\n')).toContain('critical');
    expect(data.recommendations.join('\n')).toContain('self-audio');
  });

  it('returns passing checks only when requested', async () => {
    const ctx = createCleanAudioContext();
    const result = await diagnoseAudioTool.handler({}, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.summary.issueCounts.total).toBe(0);
    expect(data.analysisConfidence.level).toMatch(/high|medium/);
    expect(data.passingChecks).toEqual([]);

    const resultWithChecks = await diagnoseAudioTool.handler({ includeOk: true }, ctx);
    const dataWithChecks = JSON.parse(resultWithChecks.content[0]?.text ?? '{}');

    expect(dataWithChecks.passingChecks).toHaveLength(4);
    expect(dataWithChecks.passingChecks.every((check: { passed: boolean }) => check.passed)).toBe(true);
    expect(dataWithChecks.recommendations).toContain('No obvious audio blockers were detected from the current XML.');
  });

  it('adds redacted last-saved vMix Call return evidence from a preset file', async () => {
    const ctx = createMockToolContext({
      initialState: {
        active: 3,
        preview: 0,
        inputs: [
          {
            key: 'guest-two-key',
            number: 3,
            type: 'vMixCall',
            title: 'Remote Guest 2 Live',
            state: 'Running',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: 'M,A',
          },
        ],
        audio: {
          master: { volume: 100, muted: false },
          busA: { volume: 100, muted: false },
        },
      },
    });

    const result = await diagnoseAudioTool.handler({ presetContent: SAVED_CALL_PRESET }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const evidence = data.savedPresetAudioEvidence;

    expect(evidence.counts).toMatchObject({
      videoCallInputs: 1,
      inputsWithSavedAudio: 1,
    });
    expect(evidence.callReturns[0]).toMatchObject({
      title: 'Remote Guest 2',
      key: '{guest-two-key}',
      liveInputNumber: 3,
      savedAudioBuses: ['A', 'C'],
      savedMuted: false,
      returnAudioIndex: 4,
      returnVideoName: 'Output 3',
      hasRedactedCallKey: true,
    });
    expect(evidence.note).toContain('raw vMix preset index');
    expect(data.parserLimitations.join('\n')).toContain('last-saved');
    expect(JSON.stringify(data)).not.toContain('SECRET_CALL_KEY');
  });

  it('flags Master blockers and Program inputs missing Master routing', async () => {
    const ctx = createMockToolContext({
      initialState: {
        active: 1,
        preview: 1,
        inputs: [
          {
            key: '{guest-key}',
            number: 1,
            type: 'vMixCall',
            title: 'Remote Guest',
            state: 'Running',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: 'A',
          },
        ],
        audio: {
          master: { volume: 0, muted: true },
          busA: { volume: 100, muted: false },
        },
      },
    });

    const result = await diagnoseAudioTool.handler({}, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const issueTitles = data.issues.map((issue: { title: string }) => issue.title);

    expect(issueTitles).toContain('Master output is muted');
    expect(issueTitles).toContain('Master output volume is at zero');
    expect(issueTitles).toContain('Remote Guest is on Program but not routed to Master');
    expect(issueTitles).toContain('Aux buses have audible inputs while Master has none');
  });

  it('flags likely show audio routed only to aux buses as monitoring confusion', async () => {
    const ctx = createMockToolContext({
      initialState: {
        active: 1,
        preview: 1,
        inputs: [
          {
            key: '{lower-third-key}',
            number: 1,
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
          {
            key: '{music-key}',
            number: 2,
            type: 'Audio',
            title: 'Music Bed',
            state: 'Running',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: 'A',
          },
        ],
        audio: {
          master: { volume: 100, muted: false },
          busA: { volume: 100, muted: false },
        },
      },
    });

    const result = await diagnoseAudioTool.handler({}, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const issueTitles = data.issues.map((issue: { title: string }) => issue.title);
    const monitoringIssue = data.issues.find(
      (issue: { title: string }) => issue.title === 'Music Bed is routed only to aux buses'
    );

    expect(data.summary.monitorOnlyInputs).toBe(1);
    expect(issueTitles).toContain('Music Bed is routed only to aux buses');
    expect(issueTitles).toContain('Aux buses have audible inputs while Master has none');
    expect(monitoringIssue.category).toBe('monitoring');
    expect(monitoringIssue.inputs[0]).toMatchObject({
      title: 'Music Bed',
      productionRole: 'music',
    });
    expect(data.recommendations.join('\n')).toContain('Master routing');
  });

  it('uses title-priority roles for NDI audio and graphics feeds in audio diagnostics', async () => {
    const ctx = createMockToolContext({
      initialState: {
        active: 1,
        preview: 2,
        inputs: [
          {
            key: '{program-key}',
            number: 1,
            type: 'Capture',
            title: 'Program Camera',
            state: 'Running',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: 'M',
          },
          {
            key: '{mic-key}',
            number: 79,
            type: 'NDI',
            title: 'NDI - MIC 1 AUDIO',
            state: 'Running',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: 'A',
          },
          {
            key: '{gfx-key}',
            number: 16,
            type: 'NDI',
            title: 'NDI - HORIZONTAL GFX PLAYOUT',
            state: 'Paused',
            position: 0,
            duration: 0,
            muted: true,
            loop: false,
            audioBuses: '',
          },
          {
            key: '{cable-key}',
            number: 98,
            type: 'Placeholder',
            title: 'Offline - Audio CABLE-A Output',
            state: 'Paused',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: 'M',
          },
        ],
        audio: {
          master: { volume: 100, muted: false },
          busA: { volume: 100, muted: false },
        },
      },
    });

    const result = await diagnoseAudioTool.handler({}, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const busA = data.buses.outputs.find((bus: { bus: string }) => bus.bus === 'A');
    const master = data.buses.outputs.find((bus: { bus: string }) => bus.bus === 'M');
    const micInput = busA.inputs.find((input: { title: string }) => input.title === 'NDI - MIC 1 AUDIO');
    const cableInput = master.inputs.find(
      (input: { title: string }) => input.title === 'Offline - Audio CABLE-A Output'
    );
    const issueTitles = data.issues.map((issue: { title: string }) => issue.title);
    const micMonitoringIssue = data.issues.find(
      (issue: { title: string }) => issue.title === 'NDI - MIC 1 AUDIO is routed only to aux buses'
    );

    expect(micInput).toMatchObject({
      role: 'audioOnly',
      productionRole: 'audioSource',
    });
    expect(cableInput).toMatchObject({
      role: 'audioOnly',
      productionRole: 'audioSource',
    });
    expect(data.buses.unrouted).toContainEqual(
      expect.objectContaining({
        title: 'NDI - HORIZONTAL GFX PLAYOUT',
        role: 'imageGraphic',
        productionRole: 'graphic',
      })
    );
    expect(issueTitles).not.toContain('NDI - HORIZONTAL GFX PLAYOUT has no visible audio bus routing');
    expect(micMonitoringIssue).toMatchObject({
      severity: 'info',
      category: 'monitoring',
    });
    expect(micMonitoringIssue.recommendation).toContain('Add Master routing only if');
  });

  it('downgrades muted Program video when a same-bus music bed is inferred', async () => {
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
        audio: {
          master: { volume: 100, muted: false },
          busA: { volume: 100, muted: false },
          busB: { volume: 100, muted: false },
        },
      },
    });

    const result = await diagnoseAudioTool.handler({}, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const programIssue = data.issues.find(
      (issue: { category: string; title: string }) =>
        issue.category === 'programAudio' && issue.title.includes('Skate Video A')
    );

    expect(programIssue.severity).toBe('warning');
    expect(programIssue.title).toContain('paired music bed');
    expect(programIssue.detail).toContain('Song A.mp3');
    expect(data.summary.issueCounts.critical).toBe(0);
  });

  it('recognizes paired aux-bus video/music-bed shows from a real-world fixture', async () => {
    const ctx = createMockToolContext({
      initialState: readFixtureState('state-paired-audio-aux-bus.xml'),
    });

    const result = await diagnoseAudioTool.handler({}, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const programIssue = data.issues.find(
      (issue: { category: string; title: string }) =>
        issue.category === 'programAudio' && issue.title.includes('Skate Event - Skatercross')
    );
    const musicRoutingIssues = data.issues.filter((issue: { title: string }) =>
      issue.title.includes('Music Bed') && issue.title.includes('aux buses')
    );

    expect(data.summary.inputCount).toBe(14);
    expect(programIssue.severity).toBe('warning');
    expect(programIssue.title).toContain('paired music bed');
    expect(programIssue.detail).toContain('Music Bed A.mp3');
    expect(musicRoutingIssues).toHaveLength(4);
    expect(data.summary.issueCounts.critical).toBe(0);
  });
});

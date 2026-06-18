/**
 * Tests for vmix_generate_script
 */

import { describe, expect, it } from 'vitest';
import { generateScriptTool } from '../../../../src/tools/brain/generate-script.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

function createScriptContext() {
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
          key: '{intro-video-key}',
          number: 3,
          type: 'Video',
          title: 'Intro Video',
          state: 'Paused',
          position: 0,
          duration: 30000,
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
            'Title.Text': 'Producer',
          },
        },
        {
          key: '{music-bed-key}',
          number: 5,
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

function createSlotLowerThirdContext() {
  return createMockToolContext({
    initialState: {
      active: 10,
      preview: 11,
      inputs: [
        {
          key: '{mix-layouts-key}',
          number: 10,
          type: 'Mix',
          title: 'Mix Layouts',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: '',
        },
        {
          key: '{guest-a-key}',
          number: 11,
          type: 'Capture',
          title: 'Guest A',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M',
        },
        {
          key: '{lower-third-key}',
          number: 12,
          type: 'GT',
          title: 'Lower Third',
          state: 'Paused',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: '',
          fields: {
            'Name.Text': 'Guest A',
            'Title.Text': 'Speaker',
          },
        },
      ],
    },
  });
}

function createTalkbackContext() {
  return createMockToolContext({
    initialState: {
      active: 10,
      preview: 11,
      inputs: [
        {
          key: '{mix-layouts-key}',
          number: 10,
          type: 'Mix',
          title: 'Mix Layouts',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: '',
        },
        {
          key: '{guest-a-key}',
          number: 11,
          type: 'VideoCall',
          title: 'Guest A',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M,A',
        },
        {
          key: '{op-mic-key}',
          number: 13,
          type: 'Audio',
          title: 'OP Mic',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: '',
        },
      ],
    },
  });
}

function createLayoutCleanupContext() {
  return createMockToolContext({
    initialState: {
      active: 20,
      preview: 21,
      inputs: [
        {
          key: '{layout-key}',
          number: 20,
          type: 'Mix',
          title: 'Guest Layout',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: '',
        },
        {
          key: '{transparent-key}',
          number: 21,
          type: 'Colour',
          title: 'Transparent Clear',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: '',
        },
      ],
    },
  });
}

function createKeylessMediaContext() {
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
          key: '',
          number: 3,
          type: 'Video',
          title: 'Intro Video',
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

function createTitleHeavyContext() {
  return createMockToolContext({
    initialState: {
      active: 19,
      preview: 2,
      inputs: [
        {
          key: '{controller-a-key}',
          number: 2,
          type: 'NDI',
          title: 'NDI - CONT A',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'A,B,D',
        },
        {
          key: '{show-slate-key}',
          number: 19,
          type: 'Placeholder',
          title: 'Offline - GFX - SHOW SLATE',
          state: 'Paused',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M',
        },
        {
          key: '{ndi-cam-1-key}',
          number: 4,
          type: 'NDI',
          title: 'NDI - CAM 1',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M',
        },
        {
          key: '{ndi-cam-2-key}',
          number: 5,
          type: 'NDI',
          title: 'NDI - CAM 2',
          state: 'Paused',
          position: 0,
          duration: 0,
          muted: true,
          loop: false,
          audioBuses: '',
        },
        {
          key: '{ndi-cam-3-key}',
          number: 6,
          type: 'NDI',
          title: 'NDI - CAM 3',
          state: 'Paused',
          position: 0,
          duration: 0,
          muted: true,
          loop: false,
          audioBuses: '',
        },
        {
          key: '{ndi-cam-4-key}',
          number: 7,
          type: 'NDI',
          title: 'NDI - CAM 4',
          state: 'Paused',
          position: 0,
          duration: 0,
          muted: true,
          loop: false,
          audioBuses: '',
        },
        {
          key: '{ndi-cam-5-key}',
          number: 8,
          type: 'NDI',
          title: 'NDI - CAM 5',
          state: 'Paused',
          position: 0,
          duration: 0,
          muted: true,
          loop: false,
          audioBuses: '',
        },
        {
          key: '{stage-timer-key}',
          number: 67,
          type: 'GT',
          title: 'PROD - STAGE TIMER B',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M',
          fields: {
            'Message.Text': 'LIVE IN 1:30',
          },
        },
        {
          key: '{temp-label-cam-1-key}',
          number: 69,
          type: 'GT',
          title: 'TEMP - LABEL - CAM 1',
          state: 'Paused',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M',
          fields: {
            'Message.Text': 'OLD',
          },
        },
        {
          key: '{temp-label-cam-2-key}',
          number: 70,
          type: 'GT',
          title: 'TEMP - LABEL - CAM 2',
          state: 'Paused',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M',
          fields: {
            'Message.Text': 'OLD',
          },
        },
        {
          key: '{temp-label-cam-3-key}',
          number: 71,
          type: 'GT',
          title: 'TEMP - LABEL - CAM 3',
          state: 'Paused',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M',
          fields: {
            'Message.Text': 'OLD',
          },
        },
        {
          key: '{temp-label-cam-4-key}',
          number: 72,
          type: 'GT',
          title: 'TEMP - LABEL - CAM 4',
          state: 'Paused',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M',
          fields: {
            'Message.Text': 'OLD',
          },
        },
        {
          key: '{temp-label-cam-5-key}',
          number: 73,
          type: 'GT',
          title: 'TEMP - LABEL - CAM 5',
          state: 'Paused',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M',
          fields: {
            'Message.Text': 'OLD',
          },
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

describe('vmix_generate_script', () => {
  it('has the expected tool name', () => {
    expect(generateScriptTool.name).toBe('vmix_generate_script');
  });

  it('generates a read-only camera cycle artifact using stable input keys', async () => {
    const ctx = createScriptContext();
    const result = await generateScriptTool.handler(
      { goal: 'Cycle through my cameras every 7 seconds with fade' },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    expect(data.execution.executed).toBe(false);
    expect(data.goalSummary.matchedPattern).toBe('cameraCycle');
    expect(data.goalSummary.supportedPattern).toBe(true);
    expect(data.compilerWorkflow.artifactType).toBe('vbnet-script');
    expect(data.compilerWorkflow.readOnlyGeneration).toBe(true);
    expect(data.reviewStatus).toBe('readyForReview');
    expect(data.executionBoundary).toMatchObject({
      currentMode: 'review',
      executed: false,
      controlModeFlag: 'VMIX_CONTROL_MODE=true',
      fullPolicy: 'vmix://server/status',
    });
    expect(data.pattern).toBe('cameraCycle');
    expect(data.deliverable.copyReady).toBe(true);
    expect(data.deliverable.code.length).toBeGreaterThan(0);
    expect(data.referencePlan.preferenceOrder[0]).toBe('key');
    expect(data.referencePlan.policy.fuzzyTitles).toBe('suggestions-only-never-committed');
    expect(data.referencePlan.audit.status).toBe('compliant');
    expect(data.referencePlan.audit.checkedReferences.every(
      (reference: { referencedInScript: boolean }) => reference.referencedInScript
    )).toBe(true);
    expect(data.referencePlan.resolvedInputs[0].referenceKind).toBe('key');
    expect(data.deliverable.code).toContain('API.Function("Fade"');
    expect(data.deliverable.code).toContain('"{host-camera-key}"');
    expect(data.deliverable.code).toContain('"{guest-camera-key}"');
    expect(data.deliverable.code).toContain('Sleep(7000)');
    expect(data.validationResult.baseValidation.valid).toBe(true);
    expect(data.validationResult.valid).toBe(true);
    expect(data.validationResult.validator).toBe('state-aware-vmix-script-validator');
    expect(data.stateAwareValidation.valid).toBe(true);
    expect(data.stateAwareValidation.issueSummary.warnings).toBeGreaterThanOrEqual(1);
    expect(data.stateAwareValidation.scriptingDiagnostics.fragileReferences.count)
      .toBeGreaterThanOrEqual(1);
    expect(data.stateAwareValidation.apiCalls[0].functionName).toBe('Fade');
    expect(data.analysisConfidence.signals.map((signal: { name: string }) => signal.name))
      .toContain('stateAwareValidation');
    expect(data.analysisConfidence.signals.map((signal: { name: string }) => signal.name))
      .toContain('referencePolicyCompliance');
    expect(data.assumptionDetails.length).toBeGreaterThan(0);
    expect(data.requiredInputs).toHaveLength(2);
    expect(data.productionReview).toMatchObject({
      isPersistentLoop: true,
      hasHighImpactActions: true,
      liveImpactIfRun: 'high',
    });
    expect(data.warnings.join('\n')).toContain('Persistent watcher or loop');
    expect(data.warnings.join('\n')).toContain('High live-impact automation');
    expect(data.setupSteps.join('\n')).toContain('Confirm no other copy of this watcher');
    expect(data.testSteps.join('\n')).toContain('Stop the script manually');
  });

  it('keeps blocked-preflight scripts reviewable but not copy-ready', async () => {
    const ctx = createBlockedPreflightContext();
    const result = await generateScriptTool.handler({ goal: 'Start streaming' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    expect(data.pattern).toBe('recordingControl');
    expect(data.reviewStatus).toBe('blocked');
    expect(data.deliverable.copyReady).toBe(false);
    expect(data.automationPreflight).toMatchObject({
      status: 'blocked',
      blocksExecution: true,
    });
    expect(data.compilerWorkflow.stages.find((stage: { name: string }) => stage.name === 'preflightReview'))
      .toMatchObject({
        status: 'blocked',
      });
    expect(data.setupSteps[0]).toContain('Do not execute');
    expect(data.productionReview.hasHighImpactActions).toBe(true);
    expect(data.productionReview.highImpactEvidence.join('\n')).toContain('StartStreaming is show-critical');
    expect(data.warnings.join('\n')).toContain('Preflight is blocked before script execution');
    expect(data.failureModes.join('\n')).toContain('preflight is blocked');
  });

  it('generates a timed overlay artifact with setup and failure notes', async () => {
    const ctx = createScriptContext();
    const result = await generateScriptTool.handler(
      { goal: 'Show the lower third on overlay 2 for 5 seconds' },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('timedOverlay');
    expect(data.goalSummary.liveImpactIfRun).toBe('medium');
    expect(data.deliverable.code).toContain('OverlayInput2In');
    expect(data.deliverable.code).toContain('Input:="{lower-third-key}"');
    expect(data.setupSteps.length).toBeGreaterThan(0);
    expect(data.failureModes.join('\n')).toContain('same channel');
    expect(data.validationResult.baseValidation.valid).toBe(true);
  });

  it('generates a slot-driven lower-third review scaffold with safe guards', async () => {
    const ctx = createSlotLowerThirdContext();
    const result = await generateScriptTool.handler(
      {
        goal:
          'Show the lower third for the assigned participant in Mix Layouts slot 1 using a data source row map on overlay 2 for 4 seconds',
      },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('slotLowerThird');
    expect(data.goalSummary.supportedPattern).toBe(true);
    expect(data.goalSummary.liveImpactIfRun).toBe('medium');
    expect(data.reviewStatus).toBe('needsHumanEdits');
    expect(data.deliverable.copyReady).toBe(false);
    expect(data.referencePlan.audit.status).toBe('compliant');
    expect(data.requiredInputs.map((input: { title: string }) => input.title))
      .toEqual(['Mix Layouts', 'Lower Third']);
    expect(data.deliverable.code).toContain('Dim slotMapSelector As String = "//input[@key=\'{mix-layouts-key}\']"');
    expect(data.deliverable.code).toContain('Dim lowerThirdInput As String = "{lower-third-key}"');
    expect(data.deliverable.code).toContain('Dim slotIndex As Integer = 0');
    expect(data.deliverable.code).toContain('overlayNodes.Count > slotIndex');
    expect(data.deliverable.code).toContain('Select Case assignedTitle');
    expect(data.deliverable.code).toContain('DataSourceSelectRow');
    expect(data.deliverable.code).toContain('REPLACE_WITH_PARTICIPANT_TITLE');
    expect(data.deliverable.code).toContain('OverlayInput2In');
    expect(data.deliverable.code).toContain('Sleep(displayMs)');
    expect(data.warnings.join('\n')).toContain('Row-map placeholders must be replaced');
    expect(data.setupSteps.join('\n')).toContain('Replace REPLACE_WITH_PARTICIPANT_TITLE');
    expect(data.validationResult.valid).toBe(true);
    expect(data.stateAwareValidation.issueSummary.errors).toBe(0);
  });

  it('generates a slot-driven talkback return scaffold without assuming bus roles', async () => {
    const ctx = createTalkbackContext();
    const result = await generateScriptTool.handler(
      {
        goal: 'Turn talkback on for the caller assigned to Mix Layouts slot 1 using OP Mic',
      },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('talkbackReturn');
    expect(data.goalSummary.liveImpactIfRun).toBe('high');
    expect(data.reviewStatus).toBe('needsHumanEdits');
    expect(data.deliverable.copyReady).toBe(false);
    expect(data.referencePlan.audit.status).toBe('compliant');
    expect(data.requiredInputs.map((input: { title: string }) => input.title))
      .toEqual(['Mix Layouts', 'OP Mic']);
    expect(data.deliverable.code).toContain('VideoCallAudioSource');
    expect(data.deliverable.code).toContain('Value:=callerTalkbackReturn');
    expect(data.deliverable.code).toContain('AudioBusOn');
    expect(data.deliverable.code).toContain('Input:=operatorMicInput');
    expect(data.deliverable.code).toContain('Value:=operatorMicBus');
    expect(data.deliverable.code).toContain('REPLACE_WITH_CALLER_TALKBACK_SOURCE');
    expect(data.deliverable.code).toContain('REPLACE_WITH_TALKBACK_BUS_LETTER');
    expect(data.deliverable.code).not.toContain('BusE');
    expect(data.warnings.join('\n')).toContain('Talkback return source and bus placeholders must be replaced');
    expect(data.productionReview.hasHighImpactActions).toBe(true);
    expect(data.validationResult.valid).toBe(true);
    expect(data.stateAwareValidation.issueSummary.errors).toBe(0);
  });

  it('generates a sparse layout cleanup scaffold with reviewed clear input', async () => {
    const ctx = createLayoutCleanupContext();
    const result = await generateScriptTool.handler(
      { goal: 'Fill missing layers 1-4 in Guest Layout with Transparent Clear' },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('layoutCleanup');
    expect(data.goalSummary.liveImpactIfRun).toBe('high');
    expect(data.reviewStatus).toBe('needsHumanEdits');
    expect(data.deliverable.copyReady).toBe(false);
    expect(data.referencePlan.audit.status).toBe('compliant');
    expect(data.requiredInputs.map((input: { title: string }) => input.title))
      .toEqual(['Guest Layout', 'Transparent Clear']);
    expect(data.deliverable.code).toContain('Dim layoutInput As String = "{layout-key}"');
    expect(data.deliverable.code).toContain('Dim clearInput As String = "{transparent-key}"');
    expect(data.deliverable.code).toContain('Dim expectedLayers() As Integer = {1, 2, 3, 4}');
    expect(data.deliverable.code).toContain('overlayNodes.Count > layerIndex');
    expect(data.deliverable.code).toContain('API.Function("SetLayer"');
    expect(data.deliverable.code).toContain('Value:=CStr(layerNumber) & "," & clearInput');
    expect(data.warnings.join('\n')).toContain('Layer cleanup is preset-specific');
    expect(data.productionReview.hasHighImpactActions).toBe(true);
    expect(data.validationResult.valid).toBe(true);
    expect(data.stateAwareValidation.issueSummary.errors).toBe(0);
  });

  it('generates a title text update artifact with exact field names', async () => {
    const ctx = createScriptContext();
    const result = await generateScriptTool.handler(
      { goal: 'Update title Name to Steve Director' },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('titleTextUpdate');
    expect(data.deliverable.code).toContain('SetText');
    expect(data.deliverable.code).toContain('Input:="{lower-third-key}"');
    expect(data.deliverable.code).toContain('SelectedName:="Name.Text"');
    expect(data.deliverable.code).toContain('Value:="Steve Director"');
    expect(data.requiredFields[0].fields).toEqual(['Name.Text']);
    expect(data.validationResult.baseValidation.valid).toBe(true);
    expect(data.stateAwareValidation.scriptingDiagnostics.titleFields.errors).toBe(0);
    expect(data.stateAwareValidation.issues.map((issue: { category: string }) => issue.category))
      .not.toContain('titleField');
  });

  it('honors explicit title input, field, value, and wait in title update goals', async () => {
    const ctx = createTitleHeavyContext();
    const result = await generateScriptTool.handler(
      {
        goal:
          'Set field Message.Text on title input TEMP - LABEL - CAM 1 to CAM 1, then wait 500ms',
      },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('titleTextUpdate');
    expect(data.explanation).toContain('TEMP - LABEL - CAM 1');
    expect(data.deliverable.code).toContain('#69 TEMP - LABEL - CAM 1');
    expect(data.deliverable.code).toContain('Input:="{temp-label-cam-1-key}"');
    expect(data.deliverable.code).toContain('SelectedName:="Message.Text"');
    expect(data.deliverable.code).toContain('Value:="CAM 1"');
    expect(data.deliverable.code).toContain('Sleep(500)');
    expect(data.deliverable.code).not.toContain('{stage-timer-key}');
    expect(data.deliverable.code).not.toContain('New Message.Text value');
    expect(data.requiredFields[0].fields).toEqual(['Message.Text']);
    expect(data.validationResult.baseValidation.valid).toBe(true);
    expect(data.stateAwareValidation.scriptingDiagnostics.titleFields.errors).toBe(0);
  });

  it('extracts title field values from value-of phrasing', async () => {
    const ctx = createTitleHeavyContext();
    const result = await generateScriptTool.handler(
      {
        goal:
          'Set the value of Message.Text on title input TEMP - LABEL - CAM 1 to CAM 1, then wait 500ms',
      },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('titleTextUpdate');
    expect(data.deliverable.code).toContain('Input:="{temp-label-cam-1-key}"');
    expect(data.deliverable.code).toContain('SelectedName:="Message.Text"');
    expect(data.deliverable.code).toContain('Value:="CAM 1"');
    expect(data.deliverable.code).toContain('Sleep(500)');
    expect(data.deliverable.code).not.toContain('New Message.Text value');
  });

  it('generates batch title updates for ranged title inputs with respectively values', async () => {
    const ctx = createTitleHeavyContext();
    const result = await generateScriptTool.handler(
      {
        goal:
          'Generate a reviewable VB.NET vMix script that updates the TEMP - LABEL - CAM 1 through TEMP - LABEL - CAM 5 title inputs. Set field Message.Text to CAM 1, CAM 2, CAM 3, CAM 4, and CAM 5 respectively. Use stable input keys from the current state. Include readable comments with input numbers and input names for ease of use. Add Sleep(50) between SetText calls. Do not change Program, Preview, recording, streaming, overlays, or outputs.',
      },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('titleTextUpdate');
    expect(data.explanation).toContain('5 title input');
    expect(data.requiredInputs).toHaveLength(5);
    expect(data.requiredFields).toHaveLength(5);
    expect(data.referencePlan.audit.status).toBe('compliant');
    expect(data.deliverable.copyReady).toBe(true);
    expect(data.deliverable.code).toContain('#69 TEMP - LABEL - CAM 1');
    expect(data.deliverable.code).toContain('#73 TEMP - LABEL - CAM 5');
    expect(data.deliverable.code).toContain('Input:="{temp-label-cam-1-key}"');
    expect(data.deliverable.code).toContain('Input:="{temp-label-cam-5-key}"');
    expect(data.deliverable.code).toContain('Value:="CAM 1"');
    expect(data.deliverable.code).toContain('Value:="CAM 5"');
    expect(data.deliverable.code).not.toContain('{stage-timer-key}');
    expect(data.deliverable.code).not.toContain('New Message.Text value');
    expect(data.deliverable.code.match(/Sleep\(50\)/g)).toHaveLength(4);
    expect(data.validationResult.valid).toBe(true);
    expect(data.stateAwareValidation.issueSummary.errors).toBe(0);
    expect(data.stateAwareValidation.issueSummary.warnings).toBe(0);
  });

  it('generates a Program watcher that drives a title field from live state', async () => {
    const ctx = createTitleHeavyContext();
    const result = await generateScriptTool.handler(
      {
        goal:
          'Generate a reviewable VB.NET vMix script that watches Program and updates the title input TEMP - LABEL - CAM 1 whenever NDI - CAM 1 is live. Use the current vMix state to resolve stable input keys for both NDI - CAM 1 and TEMP - LABEL - CAM 1. When NDI - CAM 1 is in Program, set Message.Text on TEMP - LABEL - CAM 1 to ON AIR. When NDI - CAM 1 is not in Program, set Message.Text to STANDBY. The script should poll API.XML() safely, use VB.NET syntax, include Dim declarations, compare with =, concatenate strings with &, and include Sleep(200) inside the loop. Do not change Program, Preview, recording, streaming, overlays, outputs, audio routing, or any inputs other than the Message.Text field on TEMP - LABEL - CAM 1.',
      },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('programTitleWatcher');
    expect(data.goalSummary.matchedPattern).toBe('programTitleWatcher');
    expect(data.explanation).toContain('NDI - CAM 1');
    expect(data.explanation).toContain('TEMP - LABEL - CAM 1');
    expect(data.requiredInputs).toHaveLength(2);
    expect(data.requiredFields[0].fields).toEqual(['Message.Text']);
    expect(data.referencePlan.audit.status).toBe('compliant');
    expect(data.deliverable.code).toContain('Do While True');
    expect(data.deliverable.code).toContain('Dim xml As String = API.XML()');
    expect(data.deliverable.code).toContain('SelectSingleNode("/vmix/active")');
    expect(data.deliverable.code).toContain('//input[@key=\'{ndi-cam-1-key}\']');
    expect(data.deliverable.code).toContain('Input:="{temp-label-cam-1-key}"');
    expect(data.deliverable.code).toContain('SelectedName:="Message.Text"');
    expect(data.deliverable.code).toContain('Value:=desiredText');
    expect(data.deliverable.code).toContain('desiredText = "ON AIR"');
    expect(data.deliverable.code).toContain('Dim desiredText As String = "STANDBY"');
    expect(data.deliverable.code).toContain('Sleep(200)');
    expect(data.deliverable.code).toContain('Catch ex As Exception');
    expect(data.deliverable.code).not.toContain('New Message.Text value');
    expect(data.validationResult.valid).toBe(true);
    expect(data.stateAwareValidation.issueSummary.errors).toBe(0);
    expect(data.stateAwareValidation.issueSummary.warnings).toBe(0);
    expect(data.productionReview).toMatchObject({
      isPersistentLoop: true,
      hasHighImpactActions: false,
      liveImpactIfRun: 'medium',
    });
    expect(data.productionReview.warnings.join('\n')).toContain('Persistent watcher or loop');
  });

  it('generates a multi-pair Program watcher with dynamic Program source labels', async () => {
    const ctx = createTitleHeavyContext();
    const result = await generateScriptTool.handler(
      {
        goal:
          'Use vmix_generate_script to generate a reviewable VB.NET script, but do not execute anything. Goal: For inputs TEMP - LABEL - CAM 1 through TEMP - LABEL - CAM 5, set Message.Text to the current Program source label when the corresponding NDI - CAM 1 through NDI - CAM 5 input is live, otherwise set it to STANDBY. Use stable input keys from current state. Poll API.XML() safely. Use VB.NET syntax with Dim, = comparisons, & concatenation if needed, Try/Catch, null guards, change-only SetText calls, and Sleep(200) inside the loop. Do not change Program, Preview, recording, streaming, overlays, outputs, audio routing, or any fields except those five Message.Text fields.',
      },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('programTitleWatcher');
    expect(data.goalSummary.matchedPattern).toBe('programTitleWatcher');
    expect(data.explanation).toContain('5 source/label pair');
    expect(data.requiredInputs).toHaveLength(10);
    expect(data.requiredFields).toHaveLength(5);
    expect(data.referencePlan.audit.status).toBe('compliant');
    expect(data.deliverable.code).toContain('Program watcher -> multi-title text driver');
    expect(data.deliverable.code).toContain('programLabel = activeInputNode.Attributes("title").Value');
    expect(data.deliverable.code).toContain('activeInputXPath As String = "//input[@number=\'" & activeNumber & "\']"');
    expect(data.deliverable.code).toContain('//input[@key=\'{ndi-cam-1-key}\']');
    expect(data.deliverable.code).toContain('//input[@key=\'{ndi-cam-5-key}\']');
    expect(data.deliverable.code).toContain('Input:="{temp-label-cam-1-key}"');
    expect(data.deliverable.code).toContain('Input:="{temp-label-cam-5-key}"');
    expect(data.deliverable.code).toContain('SelectedName:="Message.Text"');
    expect(data.deliverable.code.match(/API\.Function\("SetText"/g)).toHaveLength(5);
    expect(data.deliverable.code.match(/Dim lastApplied\d As String = ""/g)).toHaveLength(5);
    expect(data.deliverable.code).toContain('desiredText1 = programLabel');
    expect(data.deliverable.code).toContain('desiredText5 = programLabel');
    expect(data.deliverable.code).toContain('Dim desiredText1 As String = "STANDBY"');
    expect(data.deliverable.code).not.toContain('desiredText = "the current Program source"');
    expect(data.deliverable.code).not.toContain('PROD - STAGE TIMER B');
    expect(data.deliverable.code).toContain('Sleep(200)');
    expect(data.deliverable.code).toContain('Catch ex As Exception');
    expect(data.validationResult.valid).toBe(true);
    expect(data.stateAwareValidation.issueSummary.errors).toBe(0);
  });

  it('treats current Program input title as a dynamic watcher value', async () => {
    const ctx = createTitleHeavyContext();
    const result = await generateScriptTool.handler(
      {
        goal:
          'For each pair: NDI - CAM 1 -> TEMP - LABEL - CAM 1, NDI - CAM 2 -> TEMP - LABEL - CAM 2, NDI - CAM 3 -> TEMP - LABEL - CAM 3, NDI - CAM 4 -> TEMP - LABEL - CAM 4, NDI - CAM 5 -> TEMP - LABEL - CAM 5. Continuously monitor Program. If one of those NDI CAM inputs is currently live on Program, set the matching title input field Message.Text to the current Program input title. If it is not live on Program, set that matching title field to STANDBY. Use one consolidated script, change-only SetText calls, Sleep(200), and stable input keys. Do not change Program, Preview, recording, streaming, overlays, audio, outputs, or execute anything.',
      },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('programTitleWatcher');
    expect(data.requiredInputs).toHaveLength(10);
    expect(data.requiredFields).toHaveLength(5);
    expect(data.deliverable.code).toContain('Program watcher -> multi-title text driver');
    expect(data.deliverable.code).toContain('programLabel = activeInputNode.Attributes("title").Value');
    expect(data.deliverable.code).toContain('desiredText1 = programLabel');
    expect(data.deliverable.code).toContain('desiredText5 = programLabel');
    expect(data.deliverable.code).toContain('Dim desiredText1 As String = "STANDBY"');
    expect(data.deliverable.code).toContain('Dim desiredText5 As String = "STANDBY"');
    expect(data.deliverable.code).toContain('API.Function("SetText", _');
    expect(data.deliverable.code).not.toContain('desiredText1 = "ON AIR"');
    expect(data.deliverable.code).not.toContain('desiredText1 = "the current Program input');
    expect(data.deliverable.code).not.toContain('.Replace(');
    expect(
      data.deliverable.code
        .split(/\r?\n/)
        .filter((line: string) => line.length > 110)
    ).toEqual([]);
    expect(data.deliverable.code.match(/API\.Function\("SetText"/g)).toHaveLength(5);
    expect(data.validationResult.valid).toBe(true);
    expect(data.stateAwareValidation.issueSummary.errors).toBe(0);
  });

  it('generates a one-shot video end trigger using XML and Sleep in the loop', async () => {
    const ctx = createScriptContext();
    const result = await generateScriptTool.handler(
      { goal: 'When the intro video ends cut to Host Camera' },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('videoEndTrigger');
    expect(data.deliverable.code).toContain("//input[@key='{intro-video-key}']");
    expect(data.deliverable.code).toContain('Input:="{host-camera-key}"');
    expect(data.deliverable.code).toContain('Exit Do');
    expect(data.deliverable.code).toContain('Sleep(100)');
    expect(data.validationResult.baseValidation.valid).toBe(true);
    expect(data.stateAwareValidation.scriptingDiagnostics.xpath.errors).toBe(0);
    expect(data.stateAwareValidation.scriptingDiagnostics.polling.errors).toBe(0);
  });

  it('falls back to number-based XPath when an input has no stable key', async () => {
    const ctx = createKeylessMediaContext();
    const result = await generateScriptTool.handler(
      { goal: 'When the intro video ends cut to Host Camera' },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('videoEndTrigger');
    expect(data.deliverable.code).toContain("//input[@number='3']");
    expect(data.deliverable.code).not.toContain("//input[@key='3']");
    expect(data.referencePlan.audit.status).toBe('fallbackUsed');
    expect(data.referencePlan.audit.fallbackReferences[0]).toMatchObject({
      title: 'Intro Video',
      referenceKind: 'number',
    });
    expect(data.referencePlan.resolvedInputs.map((input: { referenceKind: string }) => input.referenceKind))
      .toContain('number');
    expect(data.stateAwareValidation.valid).toBe(true);
    expect(data.stateAwareValidation.issues.map(
      (issue: { message: string; detail?: string }) => `${issue.message} ${issue.detail ?? ''}`
    ).join('\n'))
      .toContain('No stable key is visible for Intro Video');
  });

  it('generates a paired-audio Program follow artifact from same-bus video/music pairs', async () => {
    const ctx = createPairedAudioContext();
    const result = await generateScriptTool.handler(
      { goal: 'Auto-play the matching music track when a video goes to Program' },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    expect(data.pattern).toBe('pairedAudioFollow');
    expect(data.goalSummary.supportedPattern).toBe(true);
    expect(data.goalSummary.liveImpactIfRun).toBe('high');
    expect(data.deliverable.code).toContain('If programKey = "{video-a}" Then');
    expect(data.deliverable.code).toContain('ElseIf programKey = "{video-b}" Then');
    expect(data.deliverable.code).toContain('API.Function("Pause", Input:="{music-b}")');
    expect(data.deliverable.code).toContain('API.Function("Restart", Input:="{music-a}")');
    expect(data.deliverable.code).not.toContain('Input:=musicKeys');
    expect(data.deliverable.code).not.toContain('Unmapped Program input - pause every paired music track');
    expect(data.deliverable.code).toContain('Sleep(200)');
    expect(data.validationResult.valid).toBe(true);
    expect(data.stateAwareValidation.valid).toBe(true);
    expect(data.stateAwareValidation.issues.map((issue: { category: string }) => issue.category))
      .not.toContain('dynamic');
    expect(data.reviewStatus).toBe('needsHumanEdits');
    expect(data.warnings.join('\n')).toContain('not routed to Master');
  });

  it('generates paired-audio pause-all behavior for unmapped Program inputs when requested', async () => {
    const ctx = createPairedAudioContext();
    const result = await generateScriptTool.handler(
      { goal: 'Auto-play matching music when a video goes to Program, and pause all music when Program goes to an unmapped input' },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('pairedAudioFollow');
    expect(data.explanation).toContain('unmapped Program inputs pause all paired music');
    expect(data.deliverable.code).toContain('Else');
    expect(data.deliverable.code).toContain('Unmapped Program input - pause every paired music track');
    expect(data.deliverable.code).toContain('API.Function("Pause", Input:="{music-a}")');
    expect(data.deliverable.code).toContain('API.Function("Pause", Input:="{music-b}")');
    expect(data.stateAwareValidation.valid).toBe(true);
    expect(data.stateAwareValidation.issues.map((issue: { category: string }) => issue.category))
      .not.toContain('dynamic');
    expect(data.assumptionDetails.map((a: { statement: string }) => a.statement).join('\n')).toContain('every paired music track is paused');
    expect(data.testSteps.join('\n')).toContain('all paired music pauses once');
  });

  it('generates paired-audio resume behavior without Restart when requested', async () => {
    const ctx = createPairedAudioContext();
    const result = await generateScriptTool.handler(
      { goal: 'Generate the same script, but resume the matching music instead of restarting it from 0:00' },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('pairedAudioFollow');
    expect(data.explanation).toContain('resumes');
    expect(data.deliverable.code).toContain('Playback behavior: resume');
    expect(data.deliverable.code).toContain('API.Function("Play", Input:="{music-a}")');
    expect(data.deliverable.code).not.toContain('API.Function("Restart"');
    expect(data.validationResult.valid).toBe(true);
    expect(data.stateAwareValidation.valid).toBe(true);
    expect(data.stateAwareValidation.issues.map((issue: { category: string }) => issue.category))
      .not.toContain('dynamic');
    expect(data.assumptionDetails.map((a: { statement: string }) => a.statement).join('\n')).toContain('current position');
  });

  it('does not infer paired music from vMix Call return-feed routing', async () => {
    const ctx = createCallerReturnPairedAudioContext();
    const result = await generateScriptTool.handler(
      { goal: 'Auto-play the matching music track when a video goes to Program' },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    expect(data.pattern).toBe('pairedAudioFollow');
    expect(data.confidence).toBeLessThan(0.5);
    expect(data.reviewStatus).toBe('needsHumanEdits');
    expect(data.requiredInputs).toEqual([]);
    expect(data.deliverable.code).toContain('explicit mapping required');
    expect(data.deliverable.code).toContain('PUT-VIDEO-KEY-HERE');
    expect(data.deliverable.code).toContain('PUT-MUSIC-BED-KEY-HERE');
    expect(data.deliverable.code).not.toContain('Prod 1 Call');
    expect(data.deliverable.code).not.toContain('Prod 1 Call -> Return Feed');
    expect(data.deliverable.code).not.toContain('API.Function("Restart"');
    expect(data.deliverable.code).not.toContain('API.Function("Play"');
    expect(data.warnings.join('\n')).toContain('No playback automation was generated');
    expect(data.assumptionDetails.map((a: { statement: string }) => a.statement).join('\n'))
      .toContain('Caller returns');
  });

  it('keeps fuzzy switch targets as suggestions instead of committed references', async () => {
    const ctx = createScriptContext();
    const result = await generateScriptTool.handler(
      { goal: 'When the intro video ends cut to Host' },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('customTemplate');
    expect(data.reviewStatus).toBe('needsHumanEdits');
    expect(data.referencePlan.explicitGoalReferences[0]).toMatchObject({
      text: 'Host',
      matched: false,
      matchedBy: null,
    });
    expect(data.referencePlan.explicitGoalReferences[0].suggestions.join('\n'))
      .toContain('Host Camera');
    expect(data.referencePlan.unresolvedReferences).toContain('Host');
    expect(data.referencePlan.audit.status).toBe('reviewRequired');
  });

  it('returns placeholders and warnings when a title update omits exact values', async () => {
    const ctx = createScriptContext();
    const result = await generateScriptTool.handler({ goal: 'Update the scoreboard title text' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('titleTextUpdate');
    expect(data.reviewStatus).toBe('needsHumanEdits');
    expect(data.deliverable.copyReady).toBe(false);
    expect(data.warnings.join('\n')).toContain('placeholders');
    expect(data.deliverable.code).toContain('New Name.Text value');
    expect(data.validationResult.baseValidation.valid).toBe(true);
  });

  it('falls back to a custom template for unsupported requests', async () => {
    const ctx = createScriptContext();
    const result = await generateScriptTool.handler({ goal: 'Do a very specific custom thing later' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.pattern).toBe('customTemplate');
    expect(data.goalSummary.supportedPattern).toBe(false);
    expect(data.reviewStatus).toBe('needsHumanEdits');
    expect(data.deliverable.copyReady).toBe(false);
    expect(data.confidence).toBeLessThan(0.5);
    expect(data.deliverable.code).toContain('Custom vMix script starting point');
    expect(data.deliverable.code).toContain('{host-camera-key}');
    expect(data.warnings.join('\n')).toContain('template');
    expect(data.validationResult.baseValidation.valid).toBe(true);
  });
});

/**
 * Tests for vmix_show_review
 */

import { describe, expect, it } from 'vitest';
import { showReviewTool } from '../../../../src/tools/brain/show-review.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

const SAVED_CALL_PRESET = `<XML>
  <Version>9</Version>
  <Input
    Type="6000"
    Title="Prod 1 Call"
    Key="{prod-one-key}"
    Muted="False"
    BusMaster="False"
    BusB="True"
    BusC="True"
    VideoCallKey="SECRET_CALL_KEY"
    VideoCallReturnAudioIndex="4"
    VideoCallReturnVideoName="Output 3"
    Triggers="&lt;?xml version=&quot;1.0&quot; encoding=&quot;utf-16&quot;?&gt;&lt;ArrayOfInputTrigger&gt;&lt;InputTrigger&gt;&lt;Value&gt;&lt;/Value&gt;&lt;Function&gt;VerticalWipeReverse&lt;/Function&gt;&lt;Duration&gt;500&lt;/Duration&gt;&lt;Input&gt;&lt;Key&gt;aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee&lt;/Key&gt;&lt;Number&gt;999&lt;/Number&gt;&lt;/Input&gt;&lt;Mix&gt;1&lt;/Mix&gt;&lt;Delay&gt;0&lt;/Delay&gt;&lt;Trigger&gt;OnCompletion&lt;/Trigger&gt;&lt;/InputTrigger&gt;&lt;/ArrayOfInputTrigger&gt;"></Input>
</XML>`;

function createShowReviewContext() {
  return createMockToolContext({
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
          key: '{preview-key}',
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
        {
          key: '{prod-one-key}',
          number: 54,
          type: 'vMixCall',
          title: 'Prod 1 Call',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'B,C',
        },
        {
          key: '{prod-two-key}',
          number: 55,
          type: 'vMixCall',
          title: 'Prod 2 Call',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'B,C',
        },
      ],
      audio: {
        master: { volume: 100, muted: false },
        busB: { volume: 80, muted: false },
        busC: { volume: 80, muted: false },
      },
      overlays: [null, null, null, null],
    },
  });
}

describe('vmix_show_review', () => {
  it('has the expected tool name', () => {
    expect(showReviewTool.name).toBe('vmix_show_review');
  });

  it('orchestrates live review, audio, output readiness, preflight, and checklist without mutating vMix', async () => {
    const ctx = createShowReviewContext();
    const result = await showReviewTool.handler({}, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    expect(data.mode).toBe('readOnlyShowReview');
    expect(data.execution.executed).toBe(false);
    expect(data.intent).toBe('showReview');
    expect(data.presentationGuidance).toMatchObject({
      statusLabel: 'caution',
      headline: 'Caution: no blockers found, but priority checks need operator review.',
      blockedCategories: [],
      sectionLabels: {
        priorityChecks: 'Priority checks',
        cautions: 'Cautions',
      },
    });
    expect(data.presentationGuidance.severityGuidance).toMatch(/Do not use blocker/i);
    expect(data.presentationGuidance.severityGuidance).toMatch(/no blocked categories/i);
    expect(data.source).toMatchObject({
      inputCount: 4,
      program: { inputNumber: 1, title: 'Program Camera' },
      preview: { inputNumber: 2, title: 'Lower Third' },
    });
    expect(data.presetContext).toMatchObject({
      requested: false,
      savedAudioEvidenceIncluded: false,
      savedPresetAuditIncluded: false,
    });
    expect(data.presetAudit.status).toBe('notRequested');
    expect(data.preflight.status).toBe('available');
    expect(data.audio.status).toBe('available');
    expect(data.outputReadiness).toMatchObject({
      status: 'available',
      overallStatus: 'review',
      readinessSummary: {
        disposition: 'notArmed',
        headline: 'Outputs are not armed yet; visible state is ready for operator verification.',
      },
    });
    expect(data.checklist.status).toBe('available');
    expect(data.underlyingWorkflow.map((step: { tool: string }) => step.tool)).toEqual([
      'vmix_preflight',
      'vmix_diagnose_audio',
      'vmix_diagnose_outputs',
      'vmix_generate_show_checklist',
    ]);
  });

  it('passes explicit saved preset context through audio diagnosis and redacts call keys', async () => {
    const ctx = createShowReviewContext();
    const result = await showReviewTool.handler(
      { intent: 'goLive', presetContent: SAVED_CALL_PRESET },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.intent).toBe('goLive');
    expect(data.presetContext).toMatchObject({
      requested: true,
      source: 'presetContent',
      savedAudioEvidenceIncluded: true,
      savedPresetAuditIncluded: true,
    });
    expect(data.audio.savedPresetAudioEvidence).toMatchObject({
      counts: {
        videoCallInputs: 1,
        inputsWithSavedAudio: 1,
      },
      callReturns: [
        {
          title: 'Prod 1 Call',
          liveInputNumber: 54,
          savedAudioBuses: ['B', 'C'],
          savedMuted: false,
          returnAudioIndex: 4,
          returnVideoName: 'Output 3',
          hasRedactedCallKey: true,
        },
      ],
    });
    expect(data.presetAudit).toMatchObject({
      status: 'available',
      findingSummary: {
        total: 1,
        errors: 0,
        warnings: 1,
        info: 0,
      },
      reviewFindings: [
        {
          severity: 'warning',
          category: 'trigger',
          message: 'Trigger on "Prod 1 Call" targets an input key absent from live state.',
          detail: 'Event "OnCompletion" -> VerticalWipeReverse.',
        },
      ],
    });
    expect(data.underlyingWorkflow.map((step: { tool: string }) => step.tool)).toContain(
      'vmix_audit_preset_file'
    );
    expect(JSON.stringify(data)).not.toContain('SECRET_CALL_KEY');
  });

  it('uses recovery checklist scenario for recovery intent', async () => {
    const ctx = createShowReviewContext();
    const result = await showReviewTool.handler({ intent: 'recovery' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.checklist.scenario).toBe('recovery');
    expect(data.underlyingWorkflow.find((step: { tool: string }) => step.tool === 'vmix_generate_show_checklist'))
      .toMatchObject({
        scenario: 'recovery',
      });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { join } from 'path';
import { auditPresetFileTool } from '../../../../src/tools/brain/audit-preset-file.js';
import type { ToolContext } from '../../../../src/tools/base.js';

const FIXTURE = join(__dirname, '../../../mocks/fixtures/preset-sample.vmix');
const TARGET_REFERENCE_PRESET = `<XML>
  <Version>9</Version>
  <Input Type="9000" Title="Master Timer" Key="8f6a9976-00d3-413f-99ed-d0d31a7a5894"></Input>
  <Input Type="Colour" Title="Control Button" Key="11111111-1111-1111-1111-111111111111" Triggers="&lt;ArrayOfInputTrigger&gt;&lt;InputTrigger&gt;&lt;Value&gt;Clock Script&lt;/Value&gt;&lt;Function&gt;ScriptStart&lt;/Function&gt;&lt;Duration&gt;0&lt;/Duration&gt;&lt;Input&gt;&lt;Key&gt;00000000-0000-0000-0000-000000000000&lt;/Key&gt;&lt;Number&gt;0&lt;/Number&gt;&lt;/Input&gt;&lt;Mix&gt;1&lt;/Mix&gt;&lt;Delay&gt;0&lt;/Delay&gt;&lt;Trigger&gt;OnTransitionIn&lt;/Trigger&gt;&lt;/InputTrigger&gt;&lt;/ArrayOfInputTrigger&gt;"></Input>
  <Scripting>
    <ArrayOfScript>
      <Script><Code>API.Function(&quot;SetText&quot;, Input:=&quot;Master Timer&quot;, SelectedName:=&quot;SegmentTimer.Text&quot;, Value:=&quot;07:00&quot;)</Code><Name>Clock Script</Name></Script>
    </ArrayOfScript>
  </Scripting>
</XML>`;

describe('vmix_audit_preset_file', () => {
  it('describes targetInput as the fast path for one-input reference questions', () => {
    expect(auditPresetFileTool.description).toContain('Use targetInput as the first choice');
    expect(auditPresetFileTool.description).toContain('avoids broad script dumps');
  });

  it('cross-references saved preset against live state and labels freshness', async () => {
    const ctx = { state: { getState: vi.fn().mockResolvedValue({ inputs: [] }) } } as unknown as ToolContext;
    const res = await auditPresetFileTool.handler({ path: FIXTURE }, ctx);
    const payload = JSON.parse(res.content[0]!.text);
    expect(payload.source).toBe('saved preset file');
    expect(Array.isArray(payload.findings)).toBe(true);
    expect(payload.findingSummary).toBeDefined();
    // With an empty live state, saved inputs surface as drift.
    expect(payload.findings.some((f: { category: string }) => f.category === 'drift')).toBe(true);
  });

  it('summarizes target input triggers and inbound script references', async () => {
    const ctx = {
      state: {
        getState: vi.fn().mockResolvedValue({
          inputs: [
            { number: 44, key: '8f6a9976-00d3-413f-99ed-d0d31a7a5894', title: 'Master Timer', type: 'GT' },
            { number: 2, key: '11111111-1111-1111-1111-111111111111', title: 'Control Button', type: 'Colour' },
          ],
        }),
      },
    } as unknown as ToolContext;
    const res = await auditPresetFileTool.handler({ content: TARGET_REFERENCE_PRESET, targetInput: 44 }, ctx);
    const payload = JSON.parse(res.content[0]!.text);

    expect(payload.targetInputReferenceSummary.status).toBe('resolved');
    expect(payload.targetInputReferenceSummary.target).toMatchObject({
      number: 44,
      title: 'Master Timer',
      key: '8f6a9976-00d3-413f-99ed-d0d31a7a5894',
    });
    expect(payload.targetInputReferenceSummary.summary).toMatchObject({
      ownTriggerCount: 0,
      directInboundTriggerReferenceCount: 0,
      scriptsReferencingTargetCount: 1,
      scriptStartTriggersForReferencingScripts: 1,
    });
    expect(payload.targetInputReferenceSummary.summary.referenceStyle).toMatchObject({
      scriptsByTitle: 1,
      scriptsByStableKey: 0,
      scriptsByInputNumber: 0,
    });
    expect(payload.targetInputReferenceSummary.scriptsReferencingTarget[0]).toMatchObject({
      scriptName: 'Clock Script',
      matchBy: ['title'],
    });
    expect(payload.targetInputReferenceSummary.scriptStartTriggersForReferencingScripts[0]).toMatchObject({
      inputTitle: 'Control Button',
      startedScript: 'Clock Script',
    });
    expect(payload.targetInputReferenceSummary.responseGuidance).toContain('plain language');
    expect(payload.targetInputReferenceSummary.responseGuidance).toContain('input triggers that start those referencing scripts');
    expect(payload.targetInputReferenceSummary.summary.headline).toContain(
      '1 saved trigger(s) start those referencing scripts'
    );
  });
});

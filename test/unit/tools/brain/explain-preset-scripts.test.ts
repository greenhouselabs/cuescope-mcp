import { describe, it, expect, vi } from 'vitest';
import { join } from 'path';
import { explainPresetScriptsTool } from '../../../../src/tools/brain/explain-preset-scripts.js';
import type { ToolContext } from '../../../../src/tools/base.js';

const FIXTURE = join(__dirname, '../../../mocks/fixtures/preset-sample.vmix');
const SCRIPT_SET_RISK_FIXTURE = join(__dirname, '../../../mocks/fixtures/preset-script-set-risk.vmix');
const TALKBACK_PAIR_FIXTURE = join(__dirname, '../../../mocks/fixtures/preset-talkback-pair.vmix');

function ctxWithInputs(): ToolContext {
  return { state: { getState: vi.fn().mockResolvedValue({ inputs: [] }) } } as unknown as ToolContext;
}

describe('vmix_explain_preset_scripts', () => {
  it('returns one validated review entry per script, labeled as saved', async () => {
    const res = await explainPresetScriptsTool.handler({ path: FIXTURE }, ctxWithInputs());
    const payload = JSON.parse(res.content[0]!.text);
    expect(payload.source).toBe('saved preset file');
    expect(payload.scripts.length).toBe(3);
    expect(payload.scripts.every((s: { name: string; diagnostics: unknown }) => typeof s.name === 'string' && s.diagnostics)).toBe(true);
    expect(payload.scriptSetReview.findingCount).toBe(0);
  });

  it('can scope to a single script by name', async () => {
    const res = await explainPresetScriptsTool.handler({ path: FIXTURE, scriptName: 'Mix 1 Audio In' }, ctxWithInputs());
    const payload = JSON.parse(res.content[0]!.text);
    expect(payload.scripts).toHaveLength(1);
    expect(payload.scripts[0]!.name).toBe('Mix 1 Audio In');
  });

  it('flags batch-level slot precompute, paired script drift, and row-map drift', async () => {
    const res = await explainPresetScriptsTool.handler({ path: SCRIPT_SET_RISK_FIXTURE }, ctxWithInputs());
    const payload = JSON.parse(res.content[0]!.text);
    const messages = payload.scriptSetReview.findings
      .map((finding: { message: string }) => finding.message)
      .join('\n');

    expect(payload.scriptCount).toBe(4);
    expect(payload.scriptSetReview.warnings).toBeGreaterThanOrEqual(4);
    expect(messages).toContain('Mix 1 Talkback On appears to target one slot');
    expect(messages).toContain('Mix 1 Talkback Off appears to target one slot');
    expect(messages).toContain('Paired On/Off scripts resolve live slot occupants independently');
    expect(messages).toContain('Sibling scripts use different data-source row maps');
    expect(payload.scriptSetReview.findings[0]).toMatchObject({
      severity: 'warning',
      category: 'slotPrecompute',
    });
    expect(payload.scriptSetReview.findings.some(
      (finding: { category: string; detail: string }) =>
        finding.category === 'rowMapDrift' && finding.detail.includes('Host B') && finding.detail.includes('Host C')
    )).toBe(true);
  });

  it('flags talkback pair bus syntax, slot drift, and shared mic-bus risks', async () => {
    const res = await explainPresetScriptsTool.handler({ path: TALKBACK_PAIR_FIXTURE }, ctxWithInputs());
    const payload = JSON.parse(res.content[0]!.text);
    const setMessages = payload.scriptSetReview.findings
      .map((finding: { message: string }) => finding.message)
      .join('\n');
    const issueMessages = payload.scripts
      .flatMap((script: { issues: Array<{ message: string }> }) => script.issues)
      .map((issue: { message: string }) => issue.message)
      .join('\n');

    expect(payload.scriptCount).toBe(2);
    expect(payload.scriptSetReview.warnings).toBeGreaterThanOrEqual(2);
    expect(setMessages).toContain('Paired On/Off scripts resolve live slot occupants independently');
    expect(setMessages).toContain('Paired talkback scripts toggle a shared operator mic bus: E');
    expect(payload.scriptSetReview.findings.some(
      (finding: { category: string }) => finding.category === 'sharedTalkbackBus'
    )).toBe(true);
    expect(issueMessages).toContain('VideoCallAudioSource value "E" looks like an AudioBusOn/Off bus letter');
    expect(issueMessages).not.toContain('Invalid audio bus "E"');
  });
});

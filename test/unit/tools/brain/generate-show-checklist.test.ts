/**
 * Tests for vmix_generate_show_checklist
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { generateShowChecklistTool } from '../../../../src/tools/brain/generate-show-checklist.js';
import { parseVmixState } from '../../../../src/state/parser.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

function readFixtureState(name: string) {
  const xml = readFileSync(join(__dirname, '../../../mocks/fixtures', name), 'utf-8');
  return parseVmixState(xml);
}

describe('vmix_generate_show_checklist', () => {
  it('has the expected tool name', () => {
    expect(generateShowChecklistTool.name).toBe('vmix_generate_show_checklist');
  });

  it('generates a go-live handoff from the current preflight report without execution', async () => {
    const ctx = createMockToolContext({
      initialState: readFixtureState('state-multi-mix.xml'),
    });

    const result = await generateShowChecklistTool.handler({ scenario: 'goLive' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const sectionTitles = data.handoff.sections.map((section: { title: string }) => section.title);

    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    expect(data.mode).toBe('readOnlyShowChecklist');
    expect(data.execution.executed).toBe(false);
    expect(data.scenario).toBe('goLive');
    expect(data.handoff.title).toBe('Go-Live Operator Handoff');
    expect(data.preflight.status).toBe('caution');
    expect(data.source.streaming).toBe(true);
    expect(sectionTitles).toContain('Outputs');
    expect(sectionTitles).toContain('Mixes / Clean Feeds');
    expect(
      data.handoff.sections
        .find((section: { id: string }) => section.id === 'goLiveFlow')
        .items.join('\n')
    ).toContain('Confirm stream destinations');
    expect(
      data.handoff.sections
        .find((section: { id: string }) => section.id === 'goLiveFlow')
        .items.join('\n')
    ).toContain('explicit Mix targets');
    expect(data.assumptions.join('\n')).toContain('Review Mode does not execute');
  });

  it('can include passing preflight checks in a rehearsal handoff', async () => {
    const ctx = createMockToolContext();

    const result = await generateShowChecklistTool.handler(
      { scenario: 'rehearsal', includePassedChecks: true },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const sections = data.handoff.sections as Array<{ id: string; status: string; items: string[] }>;

    expect(data.handoff.title).toBe('Rehearsal Operator Handoff');
    expect(sections.some((section) => section.id === 'preflight-automationSafety')).toBe(true);
    expect(sections.find((section) => section.id === 'preflight-automationSafety')?.status).toBe('ready');
    expect(sections.find((section) => section.id === 'rehearsalFlow')?.items.join('\n'))
      .toContain('vmix_compare_xml_snapshots');
  });

  it('marks the handoff blocked when active outputs have show-critical blockers', async () => {
    const ctx = createMockToolContext({
      initialState: {
        streaming: true,
        fadeToBlack: true,
        audio: {
          master: { volume: 0, muted: true },
        },
      },
    });

    const result = await generateShowChecklistTool.handler({ scenario: 'goLive' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.preflight.status).toBe('blocked');
    expect(data.handoff.recommendedDisposition).toContain('Do not proceed');
    expect(
      data.handoff.sections
        .filter((section: { status: string }) => section.status === 'blocked')
        .map((section: { title: string }) => section.title)
    ).toEqual(expect.arrayContaining(['Program / Preview', 'Audio', 'Outputs']));
    expect(data.preflight.blockers.join('\n')).toContain('Fade to Black');
  });
});

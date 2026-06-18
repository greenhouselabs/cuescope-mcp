/**
 * Tests for vmix_compare_xml_snapshots
 */

import { describe, expect, it } from 'vitest';
import { compareXmlSnapshotsTool } from '../../../../src/tools/brain/compare-xml-snapshots.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

const beforeXml = `<?xml version="1.0" encoding="utf-8"?>
<vmix>
  <version>29.0.0.0</version>
  <edition>4K Plus</edition>
  <inputs>
    <input key="{host-camera-key}" number="1" type="Capture" title="Host Camera" state="Running" position="0" duration="0" muted="False" loop="False" audiobusses="M,A"></input>
    <input key="{guest-camera-key}" number="2" type="Capture" title="Guest Camera" state="Running" position="0" duration="0" muted="False" loop="False" audiobusses="M"></input>
    <input key="{lower-third-key}" number="3" type="GT" title="Lower Third" state="" position="0" duration="0" muted="False" loop="False" audiobusses="">
      <text name="Name.Text">Jane Host</text>
      <text name="Title.Text">Producer</text>
    </input>
    <input key="{unused-key}" number="4" type="Video" title="Unused Video" state="Paused" position="1000" duration="30000" muted="False" loop="False" audiobusses="M"></input>
  </inputs>
  <overlays>
    <overlay number="1"></overlay>
    <overlay number="2"></overlay>
    <overlay number="3"></overlay>
    <overlay number="4"></overlay>
  </overlays>
  <mixes>
    <mix number="1">
      <active>1</active>
      <preview>2</preview>
    </mix>
    <mix number="2">
      <active>2</active>
      <preview>1</preview>
    </mix>
  </mixes>
  <preview>2</preview>
  <active>1</active>
  <fadeToBlack>False</fadeToBlack>
  <recording>False</recording>
  <streaming>False</streaming>
  <external>False</external>
  <audio>
    <master volume="100" muted="False"/>
    <busa volume="80" muted="False"/>
  </audio>
</vmix>`;

const afterXml = `<?xml version="1.0" encoding="utf-8"?>
<vmix>
  <version>29.0.0.0</version>
  <edition>4K Plus</edition>
  <inputs>
    <input key="{host-camera-key}" number="1" type="Capture" title="Host Cam Renamed" state="Running" position="0" duration="0" muted="True" loop="False" audiobusses="M"></input>
    <input key="{guest-camera-key}" number="2" type="Capture" title="Guest Camera" state="Running" position="0" duration="0" muted="False" loop="False" audiobusses="M"></input>
    <input key="{lower-third-key}" number="3" type="GT" title="Lower Third" state="" position="0" duration="0" muted="False" loop="False" audiobusses="">
      <text name="Name.Text">Steve Director</text>
      <text name="Company.Text">Studio</text>
    </input>
    <input key="{music-key}" number="5" type="Audio" title="Music Bed" state="Running" position="0" duration="0" muted="False" loop="False" audiobusses="M"></input>
  </inputs>
  <overlays>
    <overlay number="1">3</overlay>
    <overlay number="2"></overlay>
    <overlay number="3"></overlay>
    <overlay number="4"></overlay>
  </overlays>
  <mixes>
    <mix number="1">
      <active>2</active>
      <preview>1</preview>
    </mix>
    <mix number="2">
      <active>1</active>
      <preview>2</preview>
    </mix>
  </mixes>
  <preview>1</preview>
  <active>2</active>
  <fadeToBlack>True</fadeToBlack>
  <recording>True</recording>
  <streaming>True</streaming>
  <external>False</external>
  <audio>
    <master volume="70" muted="False"/>
    <busa volume="80" muted="True"/>
    <busb volume="50" muted="False"/>
  </audio>
</vmix>`;

describe('vmix_compare_xml_snapshots', () => {
  it('has the expected tool name', () => {
    expect(compareXmlSnapshotsTool.name).toBe('vmix_compare_xml_snapshots');
  });

  it('compares parsed show, input, overlay, audio, and title-field changes without execution', async () => {
    const ctx = createMockToolContext();
    const result = await compareXmlSnapshotsTool.handler(
      {
        beforeXml,
        afterXml,
        beforeLabel: 'before rehearsal',
        afterLabel: 'after rehearsal',
      },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const labels = data.changes.map((change: { label: string }) => change.label);

    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    expect(data.execution.executed).toBe(false);
    expect(data.valid).toBe(true);
    expect(data.labels.before).toBe('before rehearsal');
    expect(data.labels.after).toBe('after rehearsal');
    expect(data.summary.before.inputCount).toBe(4);
    expect(data.summary.after.inputCount).toBe(4);
    expect(data.summary.before.mixes).toHaveLength(2);
    expect(data.summary.after.mixes[0].activeInput.title).toBe('Guest Camera');
    expect(data.summary.changes.total).toBeGreaterThan(10);
    expect(data.summary.changes.bySeverity.critical).toBe(1);
    expect(labels).toContain('Program input changed');
    expect(labels).toContain('Mix 1 active input changed');
    expect(labels).toContain('Mix 2 preview input changed');
    expect(labels).toContain('Fade to Black state changed');
    expect(labels).toContain('Input added');
    expect(labels).toContain('Input removed');
    expect(labels).toContain('Input title changed');
    expect(labels).toContain('Input mute state changed');
    expect(labels).toContain('Input audio bus routing changed');
    expect(labels).toContain('Overlay channel 1 changed');
    expect(labels).toContain('Master volume changed');
    expect(labels).toContain('Bus A mute state changed');
    expect(labels).toContain('Title field value changed');
    expect(labels).toContain('Title field added');
    expect(labels).toContain('Title field removed');
    expect(data.analysisConfidence.signals.map((signal: { name: string }) => signal.name))
      .toContain('inputIdentityCoverage');
    expect(data.assumptionDetails.map((assumption: { statement: string }) => assumption.statement).join('\n'))
      .toContain('normalized state comparison');
    expect(data.recommendations.join('\n')).toContain('Program and Preview');
    expect(data.recommendations.join('\n')).toContain('explicit Mix parameter');
  });

  it('returns no changes for identical snapshots', async () => {
    const ctx = createMockToolContext();
    const result = await compareXmlSnapshotsTool.handler({ beforeXml, afterXml: beforeXml }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.valid).toBe(true);
    expect(data.summary.changes.total).toBe(0);
    expect(data.analysisConfidence.level).toBe('high');
    expect(data.changes).toEqual([]);
    expect(data.recommendations).toContain('No parsed vMix state differences were detected.');
  });

  it('returns parse errors for non-vMix XML input', async () => {
    const ctx = createMockToolContext();
    const result = await compareXmlSnapshotsTool.handler({
      beforeXml: '<not-vmix></not-vmix>',
      afterXml,
    }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(result.isError).toBe(true);
    expect(data.valid).toBe(false);
    expect(data.errors[0]).toContain('<vmix>');
    expect(data.analysisConfidence.level).toBe('low');
  });
});

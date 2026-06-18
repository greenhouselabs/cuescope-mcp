import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { loadPresetFile } from '../../../../src/state/preset/preset-loader.js';
import { parsePresetFile } from '../../../../src/state/preset/preset-parser.js';

const FIXTURE = join(__dirname, '../../../mocks/fixtures/preset-sample.vmix');

const SAVED_CALL_PRESET = `<XML>
  <Version>9</Version>
  <Input
    Type="6000"
    Title="Remote Guest 2"
    Key="{guest-two-key}"
    Muted="False"
    BusMaster="False"
    BusA="True"
    BusB="False"
    BusC="True"
    VideoCallKey="SECRET_CALL_KEY"
    VideoCallReturnAudioIndex="4"
    VideoCallReturnVideoName="Output 3"
    VideoCallServerMode="True"
    VideoCallBandwidthProfile="HD"
    VideoCallGuestBandwidth="1200"></Input>
</XML>`;

describe('parsePresetFile', () => {
  const preset = parsePresetFile(loadPresetFile({ path: FIXTURE }));

  it('labels source/freshness and reads the preset version', () => {
    expect(preset.meta.source).toBe('saved preset file');
    expect(preset.meta.freshnessNote).toMatch(/last saved/i);
    expect(preset.meta.presetVersion).toBe('9');
  });

  it('extracts named scripts with decoded source (& and smart quotes preserved)', () => {
    expect(preset.scripts.length).toBe(3);
    expect(preset.scripts.map((s) => s.name)).toContain('Mix 1 Audio In');
    expect(preset.scripts.some((s) => /Do\s+While/i.test(s.source) && /Sleep\s*\(/i.test(s.source))).toBe(true);
    expect(preset.scripts.some((s) => s.source.includes('\n') && /[""&]/.test(s.source))).toBe(true);
  });

  it('extracts only real inputs (those with a Title), not shortcut refs', () => {
    expect(preset.inputs.length).toBe(3);
    expect(preset.inputs.map((i) => i.title)).toContain('Mix 1 1-Up');
    expect(preset.inputs.every((i) => i.key && i.key.length > 0)).toBe(true);
  });

  it('decodes the two OnTransitionIn ScriptStart triggers on Mix 1 1-Up', () => {
    const mix1 = preset.inputs.find((i) => i.title === 'Mix 1 1-Up')!;
    expect(mix1.triggers).toHaveLength(2);
    expect(mix1.triggers.every((t) => t.event === 'OnTransitionIn' && t.function === 'ScriptStart')).toBe(true);
    expect(mix1.triggers.map((t) => t.value)).toEqual(expect.arrayContaining(['Mix 1 Audio In', 'Menu Merge']));
    expect(mix1.triggers[0]!.duration).toBe(500);
  });

  it('parses an input whose Title legally contains a raw ">"', () => {
    const xml =
      '<XML><Version>9</Version><Input Type="Capture" Title="Cam 1 -> Wide" Key="33333333-3333-3333-3333-333333333333"></Input></XML>';
    const parsed = parsePresetFile(loadPresetFile({ content: xml }));
    expect(parsed.inputs.map((i) => i.title)).toContain('Cam 1 -> Wide');
    expect(parsed.inputs[0]!.key).toBe('33333333-3333-3333-3333-333333333333');
  });

  it('extracts saved audio flags and vMix Call return metadata', () => {
    const parsed = parsePresetFile(loadPresetFile({ content: SAVED_CALL_PRESET }));
    const input = parsed.inputs[0]!;

    expect(input.title).toBe('Remote Guest 2');
    expect(input.audio).toMatchObject({
      muted: false,
      busMaster: false,
      buses: ['A', 'C'],
      busFlags: {
        A: true,
        B: false,
        C: true,
      },
    });
    expect(input.videoCall).toMatchObject({
      key: 'SECRET_CALL_KEY',
      hasKey: true,
      returnAudioIndex: 4,
      returnVideoName: 'Output 3',
      serverMode: 'True',
      bandwidthProfile: 'HD',
      guestBandwidth: '1200',
    });
  });

  it('extracts data sources with provider and tables', () => {
    expect(preset.dataSources.map((d) => d.provider)).toEqual(expect.arrayContaining(['Google Sheets', 'XML']));
    const gs = preset.dataSources.find((d) => d.provider === 'Google Sheets')!;
    expect(gs.tables.length).toBeGreaterThanOrEqual(1);
    expect(gs.tables[0]!.name.length).toBeGreaterThan(0);
  });
});

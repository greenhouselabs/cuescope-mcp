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

const TITLE_METADATA_PRESET = `<XML>
  <Version>9</Version>
  <Input
    Type="22"
    Title="Preshow"
    Key="{preshow-key}"
    CountdownXML="&lt;ArrayOfCountdownSettings&gt;&lt;CountdownSettings&gt;&lt;FieldName&gt;Countdown.Text&lt;/FieldName&gt;&lt;StartTime&gt;00:00:00&lt;/StartTime&gt;&lt;AutoStart&gt;False&lt;/AutoStart&gt;&lt;Loop&gt;False&lt;/Loop&gt;&lt;ActionAtEnd&gt;None&lt;/ActionAtEnd&gt;&lt;/CountdownSettings&gt;&lt;/ArrayOfCountdownSettings&gt;"
    DataSourcesXML="&lt;ArrayOfDataSourceMapping&gt;&lt;DataSourceMapping&gt;&lt;FieldName&gt;Countdown.Text&lt;/FieldName&gt;&lt;DataSource&gt;Default&lt;/DataSource&gt;&lt;Table&gt;Default&lt;/Table&gt;&lt;Column&gt;Auto&lt;/Column&gt;&lt;Row&gt;-1&lt;/Row&gt;&lt;/DataSourceMapping&gt;&lt;/ArrayOfDataSourceMapping&gt;"></Input>
  <DataSources><datasources /></DataSources>
</XML>`;

const ATTRIBUTE_TITLE_METADATA_PRESET = `<XML>
  <Version>9</Version>
  <Input
    Type="9000"
    Title="Master Timer"
    Key="{timer-key}"
    DataSourcesXML="&lt;ArrayOfDataSourceMapper&gt;&lt;Mapper name=&quot;SegmentTimer.Text&quot; instanceId=&quot;a29e8ddd-fa9e-4b3c-89d9-ef197f156e4f&quot; table=&quot;Title Presets&quot; column=&quot;Segment Time&quot; row=&quot;-1&quot; /&gt;&lt;/ArrayOfDataSourceMapper&gt;"></Input>
  <DataSources>
    <datasources>
      <datasource friendlyName="Google Sheets">
        <instance id="a29e8ddd-fa9e-4b3c-89d9-ef197f156e4f" title="Rundown">
          <tables><table name="Title Presets" index="0" /></tables>
        </instance>
      </datasource>
    </datasources>
  </DataSources>
</XML>`;

const NESTED_MAPPER_TITLE_METADATA_PRESET = `<XML>
  <Version>9</Version>
  <Input
    Type="9000"
    Title="Master Timer"
    Key="{timer-key}"
    CountdownXML="&lt;ArrayOfCountdownSettings&gt;&lt;CountdownSettings&gt;&lt;StartString&gt;00:00:00&lt;/StartString&gt;&lt;DurationString&gt;00:01:30&lt;/DurationString&gt;&lt;Format&gt;mm:ss&lt;/Format&gt;&lt;Reverse&gt;false&lt;/Reverse&gt;&lt;ReverseDisplay&gt;true&lt;/ReverseDisplay&gt;&lt;/CountdownSettings&gt;&lt;/ArrayOfCountdownSettings&gt;"
    DataSourcesXML="&lt;dataSources&gt;&lt;dataSource name=&quot;SegmentTimer.Text&quot;&gt;&lt;mapper instanceId=&quot;a29e8ddd-fa9e-4b3c-89d9-ef197f156e4f&quot; table=&quot;Title Presets&quot; column=&quot;Segment Time&quot; format=&quot;{0}&quot; row=&quot;-1&quot; /&gt;&lt;/dataSource&gt;&lt;dataSource name=&quot;ActiveTimer.Text&quot;&gt;&lt;mapper table=&quot;Default&quot; column=&quot;Auto&quot; format=&quot;{0}&quot; row=&quot;-1&quot; /&gt;&lt;/dataSource&gt;&lt;/dataSources&gt;"></Input>
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

  it('extracts embedded title countdown and data-source metadata', () => {
    const parsed = parsePresetFile(loadPresetFile({ content: TITLE_METADATA_PRESET }));
    const input = parsed.inputs[0]!;

    expect(input.title).toBe('Preshow');
    expect(input.titleMetadata).toMatchObject({
      hasCountdownXml: true,
      hasDataSourcesXml: true,
    });
    expect(input.titleMetadata?.countdownSettings[0]).toMatchObject({
      fieldName: 'Countdown.Text',
      startTime: '00:00:00',
      autoStart: false,
      loop: false,
      actionAtEnd: 'None',
    });
    expect(input.titleMetadata?.dataSourceBindings[0]).toMatchObject({
      fieldName: 'Countdown.Text',
      instanceId: null,
      dataSource: 'Default',
      table: 'Default',
      column: 'Auto',
      row: -1,
    });
  });

  it('extracts attribute-shaped title data-source mapper records', () => {
    const parsed = parsePresetFile(loadPresetFile({ content: ATTRIBUTE_TITLE_METADATA_PRESET }));
    const input = parsed.inputs[0]!;

    expect(input.titleMetadata?.dataSourceBindings[0]).toMatchObject({
      fieldName: 'SegmentTimer.Text',
      instanceId: 'a29e8ddd-fa9e-4b3c-89d9-ef197f156e4f',
      table: 'Title Presets',
      column: 'Segment Time',
      row: -1,
    });
    expect(parsed.dataSources[0]).toMatchObject({
      id: 'a29e8ddd-fa9e-4b3c-89d9-ef197f156e4f',
      provider: 'Google Sheets',
      title: 'Rundown',
    });
  });

  it('joins nested title data-source parent field names with child mapper attributes', () => {
    const parsed = parsePresetFile(loadPresetFile({ content: NESTED_MAPPER_TITLE_METADATA_PRESET }));
    const input = parsed.inputs[0]!;

    expect(input.titleMetadata?.countdownSettings[0]).toMatchObject({
      startTime: '00:00:00',
      duration: '00:01:30',
      format: 'mm:ss',
      reverse: false,
      reverseDisplay: true,
    });
    expect(input.titleMetadata?.dataSourceBindings).toHaveLength(2);
    expect(input.titleMetadata?.dataSourceBindings[0]).toMatchObject({
      fieldName: 'SegmentTimer.Text',
      instanceId: 'a29e8ddd-fa9e-4b3c-89d9-ef197f156e4f',
      table: 'Title Presets',
      column: 'Segment Time',
      row: -1,
    });
    expect(input.titleMetadata?.dataSourceBindings[1]).toMatchObject({
      fieldName: 'ActiveTimer.Text',
      instanceId: null,
      table: 'Default',
      column: 'Auto',
      row: -1,
    });
  });

  it('extracts data sources with provider and tables', () => {
    expect(preset.dataSources.map((d) => d.provider)).toEqual(expect.arrayContaining(['Google Sheets', 'XML']));
    const gs = preset.dataSources.find((d) => d.provider === 'Google Sheets')!;
    expect(gs.id).toBe('a29e8ddd-fa9e-4b3c-89d9-ef197f156e4f');
    expect(gs.tables.length).toBeGreaterThanOrEqual(1);
    expect(gs.tables[0]!.name.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { readPresetFileTool } from '../../../../src/tools/brain/read-preset-file.js';
import type { ToolContext } from '../../../../src/tools/base.js';

const FIXTURE = join(__dirname, '../../../mocks/fixtures/preset-sample.vmix');
const ctx = {} as ToolContext; // reads the filesystem, not vMix state
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

const TITLE_METADATA_PRESET = `<XML>
  <Version>9</Version>
  <Input
    Type="22"
    Title="Preshow"
    Key="{preshow-key}"
    CountdownXML="&lt;ArrayOfCountdownSettings&gt;&lt;CountdownSettings&gt;&lt;FieldName&gt;Countdown.Text&lt;/FieldName&gt;&lt;StartTime&gt;00:00:00&lt;/StartTime&gt;&lt;AutoStart&gt;False&lt;/AutoStart&gt;&lt;Loop&gt;False&lt;/Loop&gt;&lt;/CountdownSettings&gt;&lt;/ArrayOfCountdownSettings&gt;"
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

describe('vmix_read_preset_file', () => {
  it('guides clients toward compact summaries before full preset dumps', () => {
    expect(readPresetFileTool.description).toContain('use summary first');
    expect(readPresetFileTool.description).toContain('Use detailMode="full" only');
  });

  it('returns a redacted, labeled inventory with counts', async () => {
    const res = await readPresetFileTool.handler({ path: FIXTURE }, ctx);
    const payload = JSON.parse(res.content[0]!.text);
    expect(payload.detailMode).toBe('summary');
    expect(payload.source).toBe('saved preset file');
    expect(payload.freshnessNote).toMatch(/last saved/i);
    expect(payload.counts.scripts).toBe(3);
    expect(payload.counts.scriptSourceCharacters).toBeGreaterThan(0);
    expect(payload.counts.inputs).toBe(3);
    expect(payload.counts.triggers).toBeGreaterThanOrEqual(2);
    expect(payload.counts.dataSources).toBe(2);
    expect(payload.scripts[0].source).toBeUndefined();
    expect(payload.scripts[0]).toMatchObject({
      name: expect.any(String),
      sourceLength: expect.any(Number),
      lineCount: expect.any(Number),
    });
    expect(payload.inputs[0]).toMatchObject({
      title: expect.any(String),
      triggerCount: expect.any(Number),
    });
    expect(payload.inputs[0].triggers).toBeUndefined();
    expect(payload.omitted.reason).toContain('detailMode="full"');
    expect(payload.omitted.reason).toContain('Use this compact summary first');
    expect(JSON.stringify(payload)).not.toMatch(/FAKE_API_KEY/); // sanitized secret still redacted
  });

  it('returns full redacted preset data only when detailMode is full', async () => {
    const res = await readPresetFileTool.handler({ path: FIXTURE, detailMode: 'full' }, ctx);
    const payload = JSON.parse(res.content[0]!.text);

    expect(payload.detailMode).toBe('full');
    expect(payload.scripts[0].source).toEqual(expect.any(String));
    expect(payload.inputs[0].triggers).toEqual(expect.any(Array));
    expect(payload.omitted).toBeUndefined();
    expect(JSON.stringify(payload)).not.toMatch(/FAKE_API_KEY/);
  });

  it('errors clearly when neither path nor content is given', async () => {
    const res = await readPresetFileTool.handler({}, ctx);
    expect(res.isError).toBe(true);
  });

  it('returns redacted saved audio and vMix Call metadata from content', async () => {
    const res = await readPresetFileTool.handler({ content: SAVED_CALL_PRESET }, ctx);
    const payload = JSON.parse(res.content[0]!.text);

    expect(payload.counts.inputsWithSavedAudio).toBe(1);
    expect(payload.counts.videoCallInputs).toBe(1);
    expect(payload.inputs[0].audio).toMatchObject({
      muted: false,
      buses: ['A', 'C'],
    });
    expect(payload.inputs[0].videoCall).toMatchObject({
      hasKey: true,
      returnAudioIndex: 4,
      returnVideoName: 'Output 3',
    });
    expect(payload.inputs[0].videoCall).not.toHaveProperty('key');
    expect(JSON.stringify(payload)).not.toContain('SECRET_CALL_KEY');
  });

  it('summarizes embedded title countdown and data-source metadata', async () => {
    const res = await readPresetFileTool.handler({ content: TITLE_METADATA_PRESET }, ctx);
    const payload = JSON.parse(res.content[0]!.text);

    expect(payload.counts.titleMetadataInputs).toBe(1);
    expect(payload.counts.titleCountdownSettings).toBe(1);
    expect(payload.counts.titleDataSourceBindings).toBe(1);
    expect(payload.inputs[0].titleMetadata).toMatchObject({
      hasCountdownXml: true,
      hasDataSourcesXml: true,
      countdownSettingCount: 1,
      dataSourceBindingCount: 1,
    });
    expect(payload.inputs[0].titleMetadata.countdownSettings[0]).toMatchObject({
      fieldName: 'Countdown.Text',
      startTime: '00:00:00',
      autoStart: false,
      loop: false,
    });
    expect(payload.inputs[0].titleMetadata.dataSourceBindings[0]).toMatchObject({
      fieldName: 'Countdown.Text',
      instanceId: null,
      dataSource: 'Default',
      table: 'Default',
      column: 'Auto',
      row: -1,
    });
  });

  it('summarizes attribute-shaped title data-source mapper records', async () => {
    const res = await readPresetFileTool.handler({ content: ATTRIBUTE_TITLE_METADATA_PRESET }, ctx);
    const payload = JSON.parse(res.content[0]!.text);

    expect(payload.counts.titleDataSourceBindings).toBe(1);
    expect(payload.inputs[0].titleMetadata.dataSourceBindings[0]).toMatchObject({
      fieldName: 'SegmentTimer.Text',
      instanceId: 'a29e8ddd-fa9e-4b3c-89d9-ef197f156e4f',
      table: 'Title Presets',
      column: 'Segment Time',
      row: -1,
    });
    expect(payload.dataSources[0]).toMatchObject({
      id: 'a29e8ddd-fa9e-4b3c-89d9-ef197f156e4f',
      provider: 'Google Sheets',
      title: 'Rundown',
    });
  });

  it('summarizes nested title data-source mapper records as joined field bindings', async () => {
    const res = await readPresetFileTool.handler({ content: NESTED_MAPPER_TITLE_METADATA_PRESET }, ctx);
    const payload = JSON.parse(res.content[0]!.text);

    expect(payload.counts.titleCountdownSettings).toBe(1);
    expect(payload.counts.titleDataSourceBindings).toBe(2);
    expect(payload.inputs[0].titleMetadata.countdownSettings[0]).toMatchObject({
      startTime: '00:00:00',
      duration: '00:01:30',
      format: 'mm:ss',
      reverse: false,
      reverseDisplay: true,
    });
    expect(payload.inputs[0].titleMetadata.dataSourceBindings[0]).toMatchObject({
      fieldName: 'SegmentTimer.Text',
      instanceId: 'a29e8ddd-fa9e-4b3c-89d9-ef197f156e4f',
      table: 'Title Presets',
      column: 'Segment Time',
      row: -1,
    });
  });

  it('keeps saved vMix Call keys redacted in full mode', async () => {
    const res = await readPresetFileTool.handler({ content: SAVED_CALL_PRESET, detailMode: 'full' }, ctx);
    const payload = JSON.parse(res.content[0]!.text);

    expect(payload.inputs[0].videoCall).toMatchObject({
      key: '[redacted]',
      hasKey: true,
      returnAudioIndex: 4,
      returnVideoName: 'Output 3',
    });
    expect(JSON.stringify(payload)).not.toContain('SECRET_CALL_KEY');
  });
});

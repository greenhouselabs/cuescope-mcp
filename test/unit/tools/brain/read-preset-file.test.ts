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

describe('vmix_read_preset_file', () => {
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

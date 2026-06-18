/**
 * Tests for state parser
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseVmixState, findInput } from '../../../src/state/parser.js';

// Helper to read fixture files
function readFixture(name: string): string {
  return readFileSync(
    join(__dirname, '../../mocks/fixtures', name),
    'utf-8'
  );
}

describe('parseVmixState', () => {
  describe('basic state', () => {
    it('parses version and edition', () => {
      const xml = readFixture('state-basic.xml');
      const state = parseVmixState(xml);

      expect(state.version).toBe('29.0.0.0');
      expect(state.edition).toBe('4K Plus');
    });

    it('parses active and preview', () => {
      const xml = readFixture('state-basic.xml');
      const state = parseVmixState(xml);

      expect(state.active).toBe(1);
      expect(state.preview).toBe(2);
    });

    it('parses status flags', () => {
      const xml = readFixture('state-basic.xml');
      const state = parseVmixState(xml);

      expect(state.fadeToBlack).toBe(false);
      expect(state.recording).toBe(false);
      expect(state.streaming).toBe(false);
      expect(state.external).toBe(false);
    });

    it('parses inputs', () => {
      const xml = readFixture('state-basic.xml');
      const state = parseVmixState(xml);

      expect(state.inputs).toHaveLength(3);

      const camera1 = state.inputs[0];
      expect(camera1?.number).toBe(1);
      expect(camera1?.title).toBe('Camera 1');
      expect(camera1?.type).toBe('Capture');
      expect(camera1?.state).toBe('Running');
      expect(camera1?.muted).toBe(false);
      expect(camera1?.audioBuses).toBe('M');

      const camera2 = state.inputs[1];
      expect(camera2?.muted).toBe(true);
      expect(camera2?.audioBuses).toBe('M,A');

      const video = state.inputs[2];
      expect(video?.type).toBe('Video');
      expect(video?.state).toBe('Paused');
      expect(video?.position).toBe(5000);
      expect(video?.duration).toBe(30000);
      expect(video?.loop).toBe(true);
    });

    it('parses empty overlays', () => {
      const xml = readFixture('state-basic.xml');
      const state = parseVmixState(xml);

      expect(state.overlays).toHaveLength(4);
      expect(state.overlays.every((o) => o === null)).toBe(true);
    });

    it('parses master audio', () => {
      const xml = readFixture('state-basic.xml');
      const state = parseVmixState(xml);

      expect(state.audio.master.volume).toBe(100);
      expect(state.audio.master.muted).toBe(false);
    });
  });

  describe('state with titles', () => {
    it('parses title fields', () => {
      const xml = readFixture('state-with-titles.xml');
      const state = parseVmixState(xml);

      const lowerThird = state.inputs.find((i) => i.title === 'Lower Third');
      expect(lowerThird?.fields).toBeDefined();
      expect(lowerThird?.fields?.['Name.Text']).toBe('John Smith');
      expect(lowerThird?.fields?.['Title.Text']).toBe('CEO, Example Corp');
      expect(lowerThird?.fields?.['Logo.Source']).toBe('C:\\Graphics\\logo.png');
    });

    it('parses title fields regardless of attribute order', () => {
      const xml = `<vmix>
        <version>29.0.0.0</version>
        <edition>4K</edition>
        <active>1</active>
        <preview>1</preview>
        <fadeToBlack>False</fadeToBlack>
        <recording>False</recording>
        <streaming>False</streaming>
        <external>False</external>
        <inputs>
          <input key="{title}" number="1" type="GT" title="Timer" state="" position="0" duration="0" muted="False" loop="False" audiobusses="">
            <text index="0" name="Headline.Text">Ready</text>
            <image index="1" name="Logo.Source">C:\\Graphics\\logo.png</image>
          </input>
        </inputs>
        <overlays></overlays>
        <audio><master volume="100" muted="False" /></audio>
      </vmix>`;
      const state = parseVmixState(xml);

      expect(state.inputs[0]?.fields?.['Headline.Text']).toBe('Ready');
      expect(state.inputs[0]?.fields?.['Logo.Source']).toBe('C:\\Graphics\\logo.png');
    });

    it('parses recording/streaming state', () => {
      const xml = readFixture('state-with-titles.xml');
      const state = parseVmixState(xml);

      expect(state.recording).toBe(true);
      expect(state.streaming).toBe(true);
    });

    it('parses overlay with input', () => {
      const xml = readFixture('state-with-titles.xml');
      const state = parseVmixState(xml);

      expect(state.overlays[0]).toBe(2);
      expect(state.overlays[1]).toBeNull();
    });

    it('parses audio buses', () => {
      const xml = readFixture('state-with-titles.xml');
      const state = parseVmixState(xml);

      expect(state.audio.busA?.volume).toBe(80);
      expect(state.audio.busA?.muted).toBe(false);
      expect(state.audio.busB?.volume).toBe(50);
      expect(state.audio.busB?.muted).toBe(true);
    });
  });

  describe('rich input details', () => {
    it('builds normalized input lookup maps', () => {
      const xml = readFixture('state-rich-input.xml');
      const state = parseVmixState(xml);

      expect(state.inputLookup?.byNumber['2']?.title).toBe('Camera 1');
      // byKey is stored normalized: braces stripped, lower-cased
      expect(state.inputLookup?.byKey['camera-key']?.number).toBe(2);
      expect(state.inputLookup?.byExactTitle['Lower Third']?.[0]?.number).toBe(3);
      expect(state.inputLookup?.byExactTitle['lower third']).toBeUndefined();
      expect(state.inputLookup?.byType['videolist']?.[0]?.title).toBe('Segment Playlist');
      expect(state.inputLookup?.byRole.mediaPlayback.map((input) => input.title)).toContain(
        'Segment Playlist'
      );
      expect(state.inputLookup?.byRole.camera.map((input) => input.title)).toContain('Camera 1');
      expect(state.inputLookup?.byRole.titleGraphic.map((input) => input.title)).toContain(
        'Lower Third'
      );
    });

    it('builds normalized overlay channels', () => {
      const xml = readFixture('state-with-titles.xml');
      const state = parseVmixState(xml);

      expect(state.overlayChannels).toEqual([
        {
          channel: 1,
          inputNumber: 2,
          inputKey: 'abc12300-0002-0002-0002-000000000002',
          inputTitle: 'Lower Third',
          active: true,
        },
        { channel: 2, inputNumber: null, active: false },
        { channel: 3, inputNumber: null, active: false },
        { channel: 4, inputNumber: null, active: false },
      ]);
    });

    it('builds normalized audio routing', () => {
      const xml = readFixture('state-rich-input.xml');
      const state = parseVmixState(xml);

      const playlist = state.inputs.find((i) => i.title === 'Segment Playlist');
      const camera = state.inputs.find((i) => i.title === 'Camera 1');
      const lowerThird = state.inputs.find((i) => i.title === 'Lower Third');

      expect(playlist?.audioBusList).toEqual(['M']);
      expect(camera?.audioBusList).toEqual(['M', 'A']);
      expect(lowerThird?.audioBuses).toBe('');
      expect(lowerThird?.audioBusList).toEqual([]);
      expect(state.audioRouting?.buses.M.inputs.map((input) => input.title)).toEqual([
        'Segment Playlist',
        'Camera 1',
      ]);
      expect(state.audioRouting?.buses.A.inputs.map((input) => input.title)).toEqual(['Camera 1']);
      expect(state.audioRouting?.buses.M.output).toEqual({
        parsed: true,
        volume: 100,
        muted: false,
      });
      expect(state.audioRouting?.buses.B.output).toEqual({
        parsed: false,
        volume: null,
        muted: null,
      });
      expect(state.audioRouting?.unrouted.map((input) => input.title)).toEqual(['Lower Third']);
    });

    it('builds normalized state relationships', () => {
      const xml = readFixture('state-rich-input.xml');
      const state = parseVmixState(xml);

      expect(state.relationships?.activeInput?.title).toBe('Segment Playlist');
      expect(state.relationships?.previewInput?.title).toBe('Camera 1');
      expect(state.relationships?.buses.M.inputs.map((input) => input.title)).toEqual([
        'Segment Playlist',
        'Camera 1',
      ]);
      expect(state.relationships?.titleInputs[0]).toMatchObject({
        input: {
          title: 'Lower Third',
          role: 'titleGraphic',
        },
        fieldNames: ['Name.Text'],
        fields: {
          'Name.Text': 'Jane Host',
        },
      });
      expect(
        state.relationships?.inputUsages.find((usage) => usage.input.title === 'Segment Playlist')
      ).toMatchObject({
        program: true,
        audioBuses: ['M'],
        layerCount: 2,
        likelyUsage: expect.arrayContaining([
          'program',
          'audio',
          'layeredComposition',
          'playback',
          'mediaPlayback',
        ]),
      });
    });

    it('parses selected index and input meters', () => {
      const xml = readFixture('state-rich-input.xml');
      const state = parseVmixState(xml);

      const playlist = state.inputs.find((i) => i.title === 'Segment Playlist');
      expect(playlist?.selectedIndex).toBe(2);
      expect(playlist?.meters).toEqual({
        f1: 0.12,
        f2: 0.34,
      });
    });

    it('parses nested input layers', () => {
      const xml = readFixture('state-rich-input.xml');
      const state = parseVmixState(xml);

      const playlist = state.inputs.find((i) => i.title === 'Segment Playlist');
      expect(playlist?.layers).toHaveLength(2);
      expect(playlist?.layers?.[0]).toMatchObject({
        index: 1,
        input: 2,
        key: '{camera-key}',
        title: 'Camera 1',
        panX: 0.1,
        panY: -0.2,
        zoom: 1.25,
        width: 0.5,
        height: 0.6,
        cropX1: 0.01,
        cropY1: 0.02,
        cropX2: 0.99,
        cropY2: 0.98,
      });
      expect(playlist?.layers?.[1]).toMatchObject({
        index: 2,
        input: 3,
        title: 'Lower Third',
        zoom: 0.75,
      });
    });

    it('uses nulls and empty arrays when rich attributes are absent', () => {
      const xml = readFixture('state-basic.xml');
      const state = parseVmixState(xml);

      expect(state.inputs[0]?.selectedIndex).toBeNull();
      expect(state.inputs[0]?.meters).toEqual({
        f1: null,
        f2: null,
      });
      expect(state.inputs[0]?.layers).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('handles missing values gracefully', () => {
      const xml = '<vmix><version></version><inputs></inputs><overlays></overlays><audio></audio></vmix>';
      const state = parseVmixState(xml);

      expect(state.version).toBe('');
      expect(state.active).toBe(0);
      expect(state.inputs).toHaveLength(0);
    });

    it('returns an empty-shaped state for non-XML garbage', () => {
      const state = parseVmixState('not xml at all {');

      expect(state.version).toBe('');
      expect(state.edition).toBe('');
      expect(state.active).toBe(0);
      expect(state.preview).toBe(0);
      expect(state.recording).toBe(false);
      expect(state.streaming).toBe(false);
      expect(state.inputs).toEqual([]);
      expect(state.overlays).toEqual([null, null, null, null]);
      expect(state.relationships?.inputUsages).toEqual([]);
    });

    it('drops a truncated input open tag instead of throwing', () => {
      const truncated =
        '<vmix><version>29.0.0.0</version><inputs><input key="abc12300-0001-0001-0001-000000000001" number="1" title="Camera 1';
      const state = parseVmixState(truncated);

      expect(state.version).toBe('29.0.0.0');
      expect(state.inputs).toEqual([]);
    });
  });

  describe('live XML quirks (entities, attributed status tags, raw > in attributes)', () => {
    it('decodes XML entities in input titles so exact-title lookup works', () => {
      const xml = readFixture('state-live-quirks.xml');
      const state = parseVmixState(xml);

      const panel = state.inputs[0];
      expect(panel?.title).toBe('Q&A "Panel" <Live>');
      expect(state.inputLookup?.byExactTitle['Q&A "Panel" <Live>']?.[0]?.number).toBe(1);
      expect(findInput(state, 'Q&A "Panel" <Live>')?.number).toBe(1);
    });

    it('decodes XML entities in title field text', () => {
      const xml = readFixture('state-live-quirks.xml');
      const state = parseVmixState(xml);

      const lowerThird = state.inputs.find((i) => i.title === 'Lower Third');
      expect(lowerThird?.fields?.['Name.Text']).toBe('Smith & Jones');
    });

    it('parses attributed <recording> and <streaming> status tags as true', () => {
      const xml = readFixture('state-live-quirks.xml');
      const state = parseVmixState(xml);

      expect(state.recording).toBe(true);
      expect(state.recordingDuration).toBe(125); // seconds, as vMix reports
      expect(state.streaming).toBe(true);
    });

    it('keeps an input whose title contains a legal raw ">" intact', () => {
      const xml = readFixture('state-live-quirks.xml');
      const state = parseVmixState(xml);

      expect(state.inputs).toHaveLength(3);
      const cam = state.inputs.find((i) => i.number === 2);
      expect(cam?.title).toBe('Cam 1 -> Wide');
      expect(cam?.audioBuses).toBe('M');
      expect(cam?.layers?.[0]?.title).toBe('Bug -> Corner');
    });

    it('parses audio elements regardless of attribute order', () => {
      const xml = readFixture('state-live-quirks.xml');
      const state = parseVmixState(xml);

      expect(state.audio.master).toEqual({ volume: 75, muted: true });
      expect(state.audio.busA).toEqual({ volume: 60, muted: false });
      expect(state.audioRouting?.buses.M.output).toEqual({
        parsed: true,
        volume: 75,
        muted: true,
      });
    });

    it('reports bus M as unparsed when no <master> element exists', () => {
      const xml =
        '<vmix><version>29.0.0.0</version><inputs></inputs><overlays></overlays><audio></audio></vmix>';
      const state = parseVmixState(xml);

      expect(state.audio.masterParsed).toBe(false);
      expect(state.audioRouting?.buses.M.output).toEqual({
        parsed: false,
        volume: null,
        muted: null,
      });
    });

    it('falls back to an empty input state for unknown state strings', () => {
      const xml = readFixture('state-live-quirks.xml');
      const state = parseVmixState(xml);

      const lowerThird = state.inputs.find((i) => i.title === 'Lower Third');
      expect(lowerThird?.state).toBe(''); // state="Garbage" is not a known InputState
    });
  });
});

describe('findInput', () => {
  it('finds input by number', () => {
    const xml = readFixture('state-basic.xml');
    const state = parseVmixState(xml);

    const input = findInput(state, 1);
    expect(input?.title).toBe('Camera 1');
  });

  it('finds input by string number', () => {
    const xml = readFixture('state-basic.xml');
    const state = parseVmixState(xml);

    const input = findInput(state, '2');
    expect(input?.title).toBe('Camera 2');
  });

  it('finds input by name (case-sensitive)', () => {
    const xml = readFixture('state-basic.xml');
    const state = parseVmixState(xml);

    expect(findInput(state, 'Camera 1')?.number).toBe(1);
    expect(findInput(state, 'camera 1')).toBeUndefined(); // Case mismatch
  });

  it('finds input by unbraced GUID (as real vMix emits keys)', () => {
    const xml = readFixture('state-basic.xml');
    const state = parseVmixState(xml);

    const input = findInput(state, 'abc12300-0001-0001-0001-000000000001');
    expect(input?.title).toBe('Camera 1');
  });

  it('finds input by braced GUID against unbraced state keys', () => {
    const xml = readFixture('state-basic.xml');
    const state = parseVmixState(xml);

    const input = findInput(state, '{abc12300-0001-0001-0001-000000000001}');
    expect(input?.title).toBe('Camera 1');
  });

  it('finds input by GUID case-insensitively through normalized lookup', () => {
    const xml = readFixture('state-basic.xml');
    const state = parseVmixState(xml);

    expect(findInput(state, 'ABC12300-0001-0001-0001-000000000001')?.title).toBe('Camera 1');
    expect(findInput(state, '{ABC12300-0001-0001-0001-000000000001}')?.title).toBe('Camera 1');
  });

  it('returns undefined for non-existent input', () => {
    const xml = readFixture('state-basic.xml');
    const state = parseVmixState(xml);

    expect(findInput(state, 'Does Not Exist')).toBeUndefined();
    expect(findInput(state, 99)).toBeUndefined();
  });
});

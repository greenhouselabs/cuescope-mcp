/**
 * Real-world-ish vMix XML fixture coverage
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseVmixState } from '../../../src/state/parser.js';

function readFixture(name: string): string {
  return readFileSync(join(__dirname, '../../mocks/fixtures', name), 'utf-8');
}

const realWorldFixtures = [
  'state-podcast-calls.xml',
  'state-multi-mix.xml',
  'state-virtual-set.xml',
  'state-title-heavy.xml',
  'state-audio-mix-minus.xml',
  'state-playlist-playback.xml',
  'state-paired-audio-aux-bus.xml',
];

describe('real-world XML fixtures', () => {
  it('parses every scenario fixture without dropping normalized relationships', () => {
    for (const fixture of realWorldFixtures) {
      const state = parseVmixState(readFixture(fixture));

      expect(state.inputs.length, fixture).toBeGreaterThan(0);
      expect(state.inputLookup, fixture).toBeDefined();
      expect(state.overlayChannels, fixture).toHaveLength(4);
      expect(state.audioRouting, fixture).toBeDefined();
      expect(state.relationships, fixture).toBeDefined();
      expect(state.relationships?.inputUsages, fixture).toHaveLength(state.inputs.length);
    }
  });

  it('models a podcast with remote calls, composite layers, lower third, and return buses', () => {
    const state = parseVmixState(readFixture('state-podcast-calls.xml'));

    expect(state.inputs).toHaveLength(7);
    expect(state.relationships?.activeInput?.title).toBe('Podcast Quad View');
    expect(state.inputLookup?.byRole.remoteGuest.map((input) => input.title)).toEqual([
      'Guest A Call',
      'Guest B Call',
    ]);
    expect(state.inputs.find((input) => input.title === 'Podcast Quad View')?.layers).toHaveLength(3);
    expect(state.relationships?.overlays[0].input?.title).toBe('Podcast Lower Third');
    expect(state.relationships?.buses.A.inputs.map((input) => input.title)).toEqual(['Guest A Call']);
    expect(state.relationships?.buses.B.inputs.map((input) => input.title)).toEqual(['Guest B Call']);
    expect(state.relationships?.buses.C.inputs.map((input) => input.title)).toEqual(['Music Bed']);
  });

  it('keeps multi-mix XML parseable while preserving known inputs and overlays', () => {
    const state = parseVmixState(readFixture('state-multi-mix.xml'));

    expect(state.active).toBe(1);
    expect(state.preview).toBe(2);
    expect(state.mixes).toEqual([
      { number: 1, active: 1, preview: 2 },
      { number: 2, active: 3, preview: 1 },
    ]);
    expect(state.relationships?.mixes[1]).toMatchObject({
      number: 2,
      activeInputNumber: 3,
      activeInput: {
        title: 'Replay Roll-in',
      },
      previewInputNumber: 1,
      previewInput: {
        title: 'Main Camera',
      },
    });
    expect(state.inputLookup?.byType.mix?.[0]?.title).toBe('Mix 2 Clean Feed');
    expect(state.relationships?.overlays[0].input?.title).toBe('Scorebug');
    expect(state.relationships?.titleInputs[0].fieldNames).toEqual([
      'Home.Score',
      'Away.Score',
      'Clock.Text',
    ]);
  });

  it('models virtual set inputs as layered virtual-set usage', () => {
    const state = parseVmixState(readFixture('state-virtual-set.xml'));
    const virtualSet = state.inputs.find((input) => input.title === 'Studio Virtual Set');
    const virtualSetUsage = state.relationships?.inputUsages.find(
      (usage) => usage.input.title === 'Studio Virtual Set'
    );

    expect(virtualSet?.layers).toHaveLength(3);
    expect(state.inputLookup?.byRole.virtualSet.map((input) => input.title)).toEqual([
      'Studio Virtual Set',
    ]);
    expect(virtualSetUsage).toMatchObject({
      program: true,
      layerCount: 3,
      likelyUsage: expect.arrayContaining(['program', 'layeredComposition', 'virtualSet']),
    });
  });

  it('models title-heavy shows with multiple field-bearing graphics', () => {
    const state = parseVmixState(readFixture('state-title-heavy.xml'));

    expect(state.relationships?.titleInputs.map((title) => title.input.title)).toEqual([
      'Lower Third Package',
      'Scorebug Package',
      'Full Screen Topic',
      'Ticker',
    ]);
    expect(state.relationships?.overlays.map((overlay) => overlay.input?.title ?? null)).toEqual([
      'Lower Third Package',
      'Scorebug Package',
      'Ticker',
      null,
    ]);
    expect(
      state.relationships?.titleInputs.find((title) => title.input.title === 'Scorebug Package')
        ?.fieldNames
    ).toEqual(['Home.Name', 'Away.Name', 'Home.Score', 'Away.Score']);
  });

  it('models mix-minus-style audio routing with callers on separate return buses', () => {
    const state = parseVmixState(readFixture('state-audio-mix-minus.xml'));

    expect(state.inputLookup?.byRole.remoteGuest.map((input) => input.title)).toEqual([
      'Caller One',
      'Caller Two',
    ]);
    expect(state.relationships?.buses.M.inputs.map((input) => input.title)).toEqual([
      'Host Mic',
      'Caller One',
      'Caller Two',
      'Music Return',
    ]);
    expect(state.relationships?.buses.A.inputs.map((input) => input.title)).toEqual([
      'Host Mic',
      'Caller One',
    ]);
    expect(state.relationships?.buses.B.inputs.map((input) => input.title)).toEqual([
      'Host Mic',
      'Caller Two',
    ]);
    expect(state.audioRouting?.unrouted.map((input) => input.title)).toEqual(['Silent Bumper']);
    expect(state.audio.busC).toEqual({
      volume: 0,
      muted: true,
    });
  });

  it('models playlist playback state with selected index, meters, and overlay usage', () => {
    const state = parseVmixState(readFixture('state-playlist-playback.xml'));
    const playlist = state.inputs.find((input) => input.title === 'Show Open Playlist');
    const playlistUsage = state.relationships?.inputUsages.find(
      (usage) => usage.input.title === 'Show Open Playlist'
    );

    expect(playlist?.selectedIndex).toBe(3);
    expect(playlist?.meters).toEqual({
      f1: 0.42,
      f2: 0.39,
    });
    expect(state.relationships?.activeInput?.title).toBe('Show Open Playlist');
    expect(state.relationships?.previewInput?.title).toBe('Main Camera');
    expect(state.relationships?.overlays[3].input?.title).toBe('End Card');
    expect(playlistUsage).toMatchObject({
      program: true,
      audioBuses: ['M'],
      likelyUsage: expect.arrayContaining(['program', 'audio', 'playback', 'mediaPlayback']),
    });
  });

  it('models paired silent-video/music-bed routing with duplicate timer titles', () => {
    const state = parseVmixState(readFixture('state-paired-audio-aux-bus.xml'));

    expect(state.inputs).toHaveLength(14);
    expect(state.relationships?.activeInput?.title).toBe('Skate Event - Skatercross.mp4');
    expect(state.relationships?.previewInput?.title).toBe('Skate Event - Vert Jam.mp4');
    expect(state.inputLookup?.byExactTitle['Timer Centre.gtzip']).toHaveLength(4);
    expect(state.relationships?.titleInputs.map((title) => title.input.number)).toEqual([
      5,
      6,
      7,
      8,
    ]);
    expect(
      state.relationships?.titleInputs.every((title) =>
        title.fieldNames.includes('Time.Text')
      )
    ).toBe(true);
    expect(state.relationships?.buses.A.inputs.map((input) => input.title)).toEqual([
      'Skate Event - Skatercross.mp4',
      'Music Bed A.mp3',
    ]);
    expect(state.relationships?.buses.B.inputs.map((input) => input.title)).toEqual([
      'Skate Event - Bowl Jam.mp4',
      'Music Bed B.mp3',
    ]);
    expect(state.relationships?.buses.C.inputs.map((input) => input.title)).toEqual([
      'Skate Event - Street Jam.mp4',
      'Music Bed C.mp3',
    ]);
    expect(state.relationships?.buses.D.inputs.map((input) => input.title)).toEqual([
      'Skate Event - Vert Jam.mp4',
      'Music Bed D.mp3',
    ]);
    expect(state.relationships?.buses.M.inputs.map((input) => input.title)).toEqual([
      'Timer Centre.gtzip',
      'Timer Centre.gtzip',
      'Timer Centre.gtzip',
      'Timer Centre.gtzip',
      'Production Mic',
      'Desktop Capture',
    ]);
  });
});

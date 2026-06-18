/**
 * Tests for Review Mode production-role inference
 */

import { describe, expect, it } from 'vitest';
import type { VmixInput } from '../../../../src/state/types.js';
import { inferProductionRoles } from '../../../../src/tools/brain/production-roles.js';

function input(overrides: Partial<VmixInput>): VmixInput {
  return {
    key: '{input}',
    number: 1,
    type: 'Unknown',
    title: 'Input',
    state: '',
    position: 0,
    duration: 0,
    muted: false,
    loop: false,
    audioBuses: '',
    ...overrides,
  };
}

describe('production-role inference', () => {
  it('detects host cameras from camera-like inputs and titles', () => {
    const result = inferProductionRoles(
      input({
        type: 'Capture',
        title: 'Host Camera',
        audioBuses: 'M,A',
      })
    );

    expect(result.primary.role).toBe('hostCamera');
    expect(result.primary.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.primary.evidence.join('\n')).toContain('host');
  });

  it('detects vMix Call inputs separately from generic guest cameras', () => {
    const result = inferProductionRoles(
      input({
        type: 'vMixCall',
        title: 'Remote Guest',
        audioBuses: 'M',
      })
    );

    expect(result.primary.role).toBe('callInput');
    expect(result.matches.map((match) => match.role)).toContain('guestCamera');
  });

  it('detects lower thirds from titles and fields', () => {
    const result = inferProductionRoles(
      input({
        type: 'GT',
        title: 'Lower Third',
        fields: {
          'Name.Text': 'Jane Host',
          'Title.Text': 'Producer',
        },
      })
    );

    expect(result.primary.role).toBe('lowerThird');
    expect(result.matches.map((match) => match.role)).toContain('graphic');
  });

  it('detects scorebugs from title and scoring fields', () => {
    const result = inferProductionRoles(
      input({
        type: 'GT',
        title: 'Scorebug',
        fields: {
          'Home.Score': '0',
          'Away.Score': '0',
          'Clock.Text': '12:00',
        },
      })
    );

    expect(result.primary.role).toBe('scorebug');
    expect(result.primary.evidence.join('\n')).toContain('scorebug');
  });

  it('detects music/audio beds', () => {
    const result = inferProductionRoles(
      input({
        type: 'AudioFile',
        title: 'Music Bed',
        audioBuses: 'M',
      })
    );

    expect(result.primary.role).toBe('music');
  });

  it('treats NDI microphone/audio feeds as audio sources instead of host cameras', () => {
    const result = inferProductionRoles(
      input({
        type: 'NDI',
        title: 'NDI - MIC 1 AUDIO',
        audioBuses: 'A',
      })
    );

    expect(result.primary.role).toBe('audioSource');
    expect(result.primary.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.matches.map((match) => match.role)).not.toContain('hostCamera');
  });

  it('treats NDI graphics playout feeds as graphics instead of host cameras', () => {
    const result = inferProductionRoles(
      input({
        type: 'NDI',
        title: 'NDI - HORIZONTAL GFX PLAYOUT',
        muted: true,
      })
    );

    expect(result.primary.role).toBe('graphic');
    expect(result.matches.map((match) => match.role)).not.toContain('hostCamera');
  });

  it('detects intro/outro packaging media', () => {
    const result = inferProductionRoles(
      input({
        type: 'Video',
        title: 'Intro Video',
        duration: 30000,
        audioBuses: 'M',
      })
    );

    expect(result.primary.role).toBe('introOutro');
    expect(result.matches.map((match) => match.role)).toContain('mediaPlayback');
  });

  it('detects replay sources', () => {
    const result = inferProductionRoles(
      input({
        type: 'Replay',
        title: 'Instant Replay',
      })
    );

    expect(result.primary.role).toBe('replay');
  });

  it('detects virtual sets', () => {
    const result = inferProductionRoles(
      input({
        type: 'VirtualSet',
        title: 'Virtual Studio',
      })
    );

    expect(result.primary.role).toBe('virtualSet');
  });

  it('detects mix inputs and clean feeds', () => {
    const result = inferProductionRoles(
      input({
        type: 'Mix',
        title: 'Clean Feed Mix',
      })
    );

    expect(result.primary.role).toBe('mixInput');
  });

  it('falls back to unknown with low confidence when no signal matches', () => {
    const result = inferProductionRoles(
      input({
        type: 'DeckLink',
        title: 'Input 9',
      })
    );

    expect(result.primary).toMatchObject({
      role: 'unknown',
      confidence: 0.2,
    });
  });
});

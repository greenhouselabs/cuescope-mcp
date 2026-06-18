/**
 * Tests for validation schemas
 */

import { describe, it, expect } from 'vitest';
import {
  InputReferenceSchema,
  MixSchema,
  OverlayChannelSchema,
  AudioBusSchema,
  VolumeSchema,
  DurationSchema,
  TransitionEffectSchema,
  StingerNumberSchema,
  StreamNumberSchema,
} from '../../../src/validation/index.js';

describe('InputReferenceSchema', () => {
  it('accepts positive numbers', () => {
    expect(InputReferenceSchema.parse(1)).toBe(1);
    expect(InputReferenceSchema.parse(42)).toBe(42);
  });

  it('accepts non-empty strings', () => {
    expect(InputReferenceSchema.parse('Camera 1')).toBe('Camera 1');
    expect(InputReferenceSchema.parse('{guid}')).toBe('{guid}');
  });

  it('rejects zero and negative numbers', () => {
    expect(() => InputReferenceSchema.parse(0)).toThrow();
    expect(() => InputReferenceSchema.parse(-1)).toThrow();
  });

  it('rejects empty strings', () => {
    expect(() => InputReferenceSchema.parse('')).toThrow();
  });
});

describe('MixSchema', () => {
  it('accepts 0-3', () => {
    expect(MixSchema.parse(0)).toBe(0);
    expect(MixSchema.parse(3)).toBe(3);
  });

  it('accepts undefined', () => {
    expect(MixSchema.parse(undefined)).toBeUndefined();
  });

  it('rejects out of range', () => {
    expect(() => MixSchema.parse(-1)).toThrow();
    expect(() => MixSchema.parse(4)).toThrow();
  });
});

describe('OverlayChannelSchema', () => {
  it('accepts 1-4', () => {
    expect(OverlayChannelSchema.parse(1)).toBe(1);
    expect(OverlayChannelSchema.parse(4)).toBe(4);
  });

  it('rejects out of range', () => {
    expect(() => OverlayChannelSchema.parse(0)).toThrow();
    expect(() => OverlayChannelSchema.parse(5)).toThrow();
  });
});

describe('AudioBusSchema', () => {
  it('accepts M and A-G', () => {
    expect(AudioBusSchema.parse('M')).toBe('M');
    expect(AudioBusSchema.parse('A')).toBe('A');
    expect(AudioBusSchema.parse('G')).toBe('G');
  });

  it('rejects invalid buses', () => {
    expect(() => AudioBusSchema.parse('H')).toThrow();
    expect(() => AudioBusSchema.parse('m')).toThrow(); // Case sensitive
    expect(() => AudioBusSchema.parse('')).toThrow();
  });
});

describe('VolumeSchema', () => {
  it('accepts 0-200', () => {
    expect(VolumeSchema.parse(0)).toBe(0);
    expect(VolumeSchema.parse(100)).toBe(100);
    expect(VolumeSchema.parse(200)).toBe(200);
  });

  it('accepts decimals', () => {
    expect(VolumeSchema.parse(50.5)).toBe(50.5);
  });

  it('rejects out of range', () => {
    expect(() => VolumeSchema.parse(-1)).toThrow();
    expect(() => VolumeSchema.parse(201)).toThrow();
  });
});

describe('DurationSchema', () => {
  it('accepts 0-10000', () => {
    expect(DurationSchema.parse(0)).toBe(0);
    expect(DurationSchema.parse(1000)).toBe(1000);
    expect(DurationSchema.parse(10000)).toBe(10000);
  });

  it('has default of 1000', () => {
    expect(DurationSchema.parse(undefined)).toBe(1000);
  });

  it('rejects out of range', () => {
    expect(() => DurationSchema.parse(-1)).toThrow();
    expect(() => DurationSchema.parse(10001)).toThrow();
  });
});

describe('TransitionEffectSchema', () => {
  it('accepts valid effects', () => {
    expect(TransitionEffectSchema.parse('Fade')).toBe('Fade');
    expect(TransitionEffectSchema.parse('Zoom')).toBe('Zoom');
    expect(TransitionEffectSchema.parse('CrossZoom')).toBe('CrossZoom');
  });

  it('rejects invalid effects', () => {
    expect(() => TransitionEffectSchema.parse('fade')).toThrow(); // Case sensitive
    expect(() => TransitionEffectSchema.parse('Invalid')).toThrow();
  });
});

describe('StingerNumberSchema', () => {
  it('accepts 1-4', () => {
    expect(StingerNumberSchema.parse(1)).toBe(1);
    expect(StingerNumberSchema.parse(4)).toBe(4);
  });

  it('has default of 1', () => {
    expect(StingerNumberSchema.parse(undefined)).toBe(1);
  });

  it('rejects out of range', () => {
    expect(() => StingerNumberSchema.parse(0)).toThrow();
    expect(() => StingerNumberSchema.parse(5)).toThrow();
  });
});

describe('StreamNumberSchema', () => {
  it('accepts 0-2', () => {
    expect(StreamNumberSchema.parse(0)).toBe(0);
    expect(StreamNumberSchema.parse(2)).toBe(2);
  });

  it('has default of 0', () => {
    expect(StreamNumberSchema.parse(undefined)).toBe(0);
  });

  it('rejects out of range', () => {
    expect(() => StreamNumberSchema.parse(-1)).toThrow();
    expect(() => StreamNumberSchema.parse(3)).toThrow();
  });
});

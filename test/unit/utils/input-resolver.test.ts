/**
 * Tests for the smart input resolver
 */

import { describe, it, expect } from 'vitest';
import {
  resolveInput,
  resolveInputOrThrow,
  escapeXPath,
} from '../../../src/utils/input-resolver.js';
import type { VmixState, VmixInput } from '../../../src/state/types.js';

// Helper to create a mock state with inputs
function createMockState(inputs: Partial<VmixInput>[]): VmixState {
  return {
    version: '27.0',
    edition: 'HD',
    active: 1,
    preview: 2,
    fadeToBlack: false,
    recording: false,
    streaming: false,
    external: false,
    playList: false,
    multiCorder: false,
    fullscreen: false,
    audio: [],
    inputs: inputs.map((input, i) => ({
      key: input.key ?? `key-${i + 1}`,
      number: input.number ?? i + 1,
      type: input.type ?? 'Video',
      title: input.title ?? `Input ${i + 1}`,
      state: input.state ?? 'Paused',
      position: input.position ?? 0,
      duration: input.duration ?? 0,
      loop: input.loop ?? false,
      muted: input.muted ?? false,
      volume: input.volume ?? 100,
      audioBuses: input.audioBuses ?? [],
      overlays: input.overlays ?? {},
      fields: input.fields ?? {},
    })),
  };
}

describe('resolveInput', () => {
  describe('exact matching', () => {
    it('should resolve by exact name match', () => {
      const state = createMockState([
        { title: 'Camera 1', key: '{test-key-1}' },
        { title: 'Camera 2', key: '{test-key-2}' },
      ]);

      const result = resolveInput(state, 'Camera 1');
      expect(result.success).toBe(true);
      expect(result.input?.title).toBe('Camera 1');
      expect(result.key).toBe('{test-key-1}');
      expect(result.fuzzyMatch).toBeUndefined();
    });

    it('should resolve by input number', () => {
      const state = createMockState([
        { title: 'Camera 1', number: 1 },
        { title: 'Camera 2', number: 2 },
      ]);

      const result = resolveInput(state, 2);
      expect(result.success).toBe(true);
      expect(result.input?.title).toBe('Camera 2');
    });

    it('should resolve by numeric string', () => {
      const state = createMockState([
        { title: 'Camera 1', number: 1 },
        { title: 'Camera 2', number: 2 },
      ]);

      const result = resolveInput(state, '2');
      expect(result.success).toBe(true);
      expect(result.input?.title).toBe('Camera 2');
    });

    it('should resolve by GUID (case-insensitive)', () => {
      const state = createMockState([
        { title: 'Camera 1', key: '{ABC12345-DEF4-5678-9ABC-DEF012345678}' },
      ]);

      const result = resolveInput(state, '{abc12345-def4-5678-9abc-def012345678}');
      expect(result.success).toBe(true);
      expect(result.input?.title).toBe('Camera 1');
    });

    it('should resolve an unbraced GUID against unbraced state keys (real vMix format)', () => {
      const state = createMockState([
        { title: 'Camera 1', key: '8e211845-684d-43cd-b5af-cabb00e4a00f' },
      ]);

      const result = resolveInput(state, '8E211845-684D-43CD-B5AF-CABB00E4A00F');
      expect(result.success).toBe(true);
      expect(result.input?.title).toBe('Camera 1');
      expect(result.key).toBe('8e211845-684d-43cd-b5af-cabb00e4a00f');
    });

    it('should resolve a braced user reference against unbraced state keys', () => {
      const state = createMockState([
        { title: 'Camera 1', key: '8e211845-684d-43cd-b5af-cabb00e4a00f' },
      ]);

      const result = resolveInput(state, '{8e211845-684d-43cd-b5af-cabb00e4a00f}');
      expect(result.success).toBe(true);
      expect(result.input?.title).toBe('Camera 1');
    });

    it('should resolve an unbraced user reference against braced state keys', () => {
      const state = createMockState([
        { title: 'Camera 1', key: '{8e211845-684d-43cd-b5af-cabb00e4a00f}' },
      ]);

      const result = resolveInput(state, '8e211845-684d-43cd-b5af-cabb00e4a00f');
      expect(result.success).toBe(true);
      expect(result.input?.title).toBe('Camera 1');
    });

    it('should report a not-found error for an unknown GUID', () => {
      const state = createMockState([
        { title: 'Camera 1', key: '8e211845-684d-43cd-b5af-cabb00e4a00f' },
      ]);

      const result = resolveInput(state, '00000000-0000-0000-0000-000000000000');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('case-insensitive matching', () => {
    it('should match case-insensitively and flag as fuzzy', () => {
      const state = createMockState([
        { title: 'Camera 1' },
        { title: 'Lower Third' },
      ]);

      const result = resolveInput(state, 'camera 1');
      expect(result.success).toBe(true);
      expect(result.input?.title).toBe('Camera 1');
      expect(result.fuzzyMatch).toBe(true);
      expect(result.normalizedRef).toBe('Camera 1'); // Returns correct case
    });

    it('should match with different casing', () => {
      const state = createMockState([{ title: 'MAIN CAMERA' }]);

      const result = resolveInput(state, 'main camera');
      expect(result.success).toBe(true);
      expect(result.input?.title).toBe('MAIN CAMERA');
      expect(result.fuzzyMatch).toBe(true);
    });
  });

  describe('error cases with suggestions', () => {
    it('should suggest similar inputs for typos', () => {
      const state = createMockState([
        { title: 'Camera 1' },
        { title: 'Camera 2' },
        { title: 'Lower Third' },
      ]);

      const result = resolveInput(state, 'Camra 1'); // Typo
      expect(result.success).toBe(false);
      expect(result.error).toContain('Did you mean "Camera 1"');
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions?.length).toBeGreaterThan(0);
    });

    it('should list similar inputs when not an obvious typo', () => {
      const state = createMockState([
        { title: 'Camera 1' },
        { title: 'Camera 2' },
        { title: 'Camera 3' },
      ]);

      const result = resolveInput(state, 'Cam'); // Partial match
      expect(result.success).toBe(false);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions?.length).toBeGreaterThan(0);
    });

    it('should list available inputs when no matches found', () => {
      const state = createMockState([
        { title: 'Camera 1' },
        { title: 'Camera 2' },
      ]);

      const result = resolveInput(state, 'XYZ Random Name');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Available inputs');
    });

    it('should handle invalid input numbers', () => {
      const state = createMockState([{ title: 'Camera 1', number: 1 }]);

      const result = resolveInput(state, 99);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Input #99 not found');
      expect(result.error).toContain('1-1'); // Range hint
    });

    it('should reject negative input numbers', () => {
      const state = createMockState([{ title: 'Camera 1' }]);

      const result = resolveInput(state, -1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Must be a positive integer');
    });

    it('should reject empty strings', () => {
      const state = createMockState([{ title: 'Camera 1' }]);

      const result = resolveInput(state, '  ');
      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });
  });
});

describe('resolveInputOrThrow', () => {
  it('should return input and normalized ref on success', () => {
    const state = createMockState([{ title: 'Camera 1' }]);

    const result = resolveInputOrThrow(state, 'Camera 1');
    expect(result.input.title).toBe('Camera 1');
    expect(result.normalizedRef).toBe('Camera 1');
  });

  it('should throw with helpful error message on failure', () => {
    const state = createMockState([
      { title: 'Camera 1' },
      { title: 'Camera 2' },
    ]);

    expect(() => resolveInputOrThrow(state, 'Camrea 1')).toThrow(
      /Did you mean/
    );
  });

  it('should include suggestions in error message', () => {
    const state = createMockState([
      { title: 'Camera 1' },
      { title: 'Camera 2' },
    ]);

    expect(() => resolveInputOrThrow(state, 'Camrea')).toThrow(/•/);
  });
});

describe('escapeXPath', () => {
  it('should wrap simple strings in single quotes', () => {
    expect(escapeXPath('Camera 1')).toBe("'Camera 1'");
  });

  it('should use double quotes when string contains single quote', () => {
    expect(escapeXPath("John's Camera")).toBe('"John\'s Camera"');
  });

  it('should handle strings with both quote types using concat', () => {
    const result = escapeXPath('Say "Hello" and \'Goodbye\'');
    expect(result).toContain('concat(');
  });

  it('should handle empty strings', () => {
    expect(escapeXPath('')).toBe("''");
  });

  it('should handle strings with only single quotes', () => {
    const result = escapeXPath("'''");
    expect(result).toContain('"');
  });
});


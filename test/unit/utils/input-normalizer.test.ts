/**
 * Tests for input normalizer utilities
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeInput,
  normalizeInputKey,
  isGuid,
  isNumericString,
  getInputReferenceType,
  parseInputNumber,
  formatInputReference,
} from '../../../src/utils/index.js';

describe('isGuid', () => {
  it('returns true for braced GUID format', () => {
    expect(isGuid('{12345678-1234-1234-1234-123456789012}')).toBe(true);
    expect(isGuid('{ABCDEF12-3456-7890-ABCD-EF1234567890}')).toBe(true);
    expect(isGuid('{abcdef12-3456-7890-abcd-ef1234567890}')).toBe(true);
  });

  it('returns true for unbraced GUID format (as real vMix emits keys)', () => {
    expect(isGuid('12345678-1234-1234-1234-123456789012')).toBe(true);
    expect(isGuid('8e211845-684d-43cd-b5af-cabb00e4a00f')).toBe(true);
    expect(isGuid('8E211845-684D-43CD-B5AF-CABB00E4A00F')).toBe(true);
  });

  it('returns false for invalid formats', () => {
    expect(isGuid('{12345678}')).toBe(false); // Too short
    expect(isGuid('{12345678-1234-1234-1234-123456789012')).toBe(false); // Mismatched braces
    expect(isGuid('12345678-1234-1234-1234-123456789012}')).toBe(false); // Mismatched braces
    expect(isGuid('Camera 1')).toBe(false);
    expect(isGuid('1')).toBe(false);
    expect(isGuid('')).toBe(false);
  });
});

describe('normalizeInputKey', () => {
  it('strips surrounding braces and lower-cases', () => {
    expect(normalizeInputKey('{8E211845-684D-43CD-B5AF-CABB00E4A00F}')).toBe(
      '8e211845-684d-43cd-b5af-cabb00e4a00f'
    );
    expect(normalizeInputKey('8e211845-684d-43cd-b5af-cabb00e4a00f')).toBe(
      '8e211845-684d-43cd-b5af-cabb00e4a00f'
    );
  });

  it('trims whitespace and keeps mismatched braces intact', () => {
    expect(normalizeInputKey('  {abc} ')).toBe('abc');
    expect(normalizeInputKey('{abc')).toBe('{abc');
  });
});

describe('isNumericString', () => {
  it('returns true for numeric strings', () => {
    expect(isNumericString('1')).toBe(true);
    expect(isNumericString('123')).toBe(true);
    expect(isNumericString('0')).toBe(true);
  });

  it('returns false for non-numeric strings', () => {
    expect(isNumericString('')).toBe(false);
    expect(isNumericString('Camera 1')).toBe(false);
    expect(isNumericString('1.5')).toBe(false);
    expect(isNumericString('-1')).toBe(false);
    expect(isNumericString('1a')).toBe(false);
  });
});

describe('normalizeInput', () => {
  it('converts number to string', () => {
    expect(normalizeInput(1)).toBe('1');
    expect(normalizeInput(42)).toBe('42');
  });

  it('returns string input trimmed', () => {
    expect(normalizeInput('Camera 1')).toBe('Camera 1');
    expect(normalizeInput('  Camera 1  ')).toBe('Camera 1');
  });

  it('preserves GUID format', () => {
    const guid = '{12345678-1234-1234-1234-123456789012}';
    expect(normalizeInput(guid)).toBe(guid);
  });

  it('throws for invalid number', () => {
    expect(() => normalizeInput(0)).toThrow('Invalid input number');
    expect(() => normalizeInput(-1)).toThrow('Invalid input number');
    expect(() => normalizeInput(1.5)).toThrow('Invalid input number');
  });

  it('throws for empty string', () => {
    expect(() => normalizeInput('')).toThrow('cannot be empty');
    expect(() => normalizeInput('   ')).toThrow('cannot be empty');
  });
});

describe('getInputReferenceType', () => {
  it('identifies number type', () => {
    expect(getInputReferenceType(1)).toBe('number');
    expect(getInputReferenceType(42)).toBe('number');
    expect(getInputReferenceType('1')).toBe('number');
    expect(getInputReferenceType('123')).toBe('number');
  });

  it('identifies guid type', () => {
    expect(getInputReferenceType('{12345678-1234-1234-1234-123456789012}')).toBe('guid');
  });

  it('identifies name type', () => {
    expect(getInputReferenceType('Camera 1')).toBe('name');
    expect(getInputReferenceType('Lower Third')).toBe('name');
    expect(getInputReferenceType('input')).toBe('name');
  });
});

describe('parseInputNumber', () => {
  it('returns number from numeric input', () => {
    expect(parseInputNumber(1)).toBe(1);
    expect(parseInputNumber(42)).toBe(42);
    expect(parseInputNumber('1')).toBe(1);
    expect(parseInputNumber('123')).toBe(123);
  });

  it('returns null for non-numeric input', () => {
    expect(parseInputNumber('Camera 1')).toBeNull();
    expect(parseInputNumber('{12345678-1234-1234-1234-123456789012}')).toBeNull();
  });
});

describe('formatInputReference', () => {
  it('formats number inputs', () => {
    expect(formatInputReference(1)).toBe('Input #1');
    expect(formatInputReference('42')).toBe('Input #42');
  });

  it('formats name inputs with quotes', () => {
    expect(formatInputReference('Camera 1')).toBe('"Camera 1"');
  });

  it('formats GUID inputs abbreviated', () => {
    const formatted = formatInputReference('{12345678-1234-1234-1234-123456789012}');
    expect(formatted).toContain('{12345678');
    expect(formatted).toContain('...');
  });
});

/**
 * Input reference normalization utilities
 * Handles the various ways vMix inputs can be referenced
 */

/**
 * Input reference type - can be string (name/GUID) or number
 */
export type InputReference = string | number;

const GUID_BODY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Strip surrounding braces from a GUID-style key, only when both are present
 * (so mismatched braces are not silently accepted).
 */
function stripGuidBraces(value: string): string {
  if (value.startsWith('{') && value.endsWith('}')) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Check if a string looks like a GUID.
 *
 * vMix accepts both braced ({xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}) and
 * unbraced forms; the live state XML emits input keys WITHOUT braces.
 */
export function isGuid(value: string): boolean {
  return GUID_BODY_PATTERN.test(stripGuidBraces(value.trim()));
}

/**
 * Normalize an input key/GUID for comparison: trims, strips surrounding
 * braces, and lower-cases. Use this on BOTH sides whenever comparing a
 * user-supplied key against state keys, so braced references resolve against
 * the unbraced keys real vMix emits (and vice versa).
 */
export function normalizeInputKey(value: string): string {
  return stripGuidBraces(value.trim()).toLowerCase();
}

/**
 * Check if a string represents a numeric input number
 */
export function isNumericString(value: string): boolean {
  return /^\d+$/.test(value);
}

/**
 * Normalize an input reference to a string suitable for vMix API
 *
 * vMix accepts inputs as:
 * - Number: "1", "2", "3"
 * - Name: "Camera 1" (case-sensitive!)
 * - GUID: "{abc123-...}"
 *
 * @param input The input reference to normalize
 * @returns Normalized string for vMix API
 */
export function normalizeInput(input: InputReference): string {
  if (typeof input === 'number') {
    // Ensure positive integer
    if (!Number.isInteger(input) || input < 1) {
      throw new Error(`Invalid input number: ${input}. Must be a positive integer.`);
    }
    return String(input);
  }

  // String input - could be name, number, or GUID
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    throw new Error('Input reference cannot be empty');
  }

  return trimmed;
}

/**
 * Get the type of input reference
 */
export function getInputReferenceType(input: InputReference): 'number' | 'name' | 'guid' {
  if (typeof input === 'number') {
    return 'number';
  }

  const trimmed = input.trim();

  if (isNumericString(trimmed)) {
    return 'number';
  }

  if (isGuid(trimmed)) {
    return 'guid';
  }

  return 'name';
}

/**
 * Parse an input reference to extract the number if it's numeric
 */
export function parseInputNumber(input: InputReference): number | null {
  if (typeof input === 'number') {
    return input;
  }

  const trimmed = input.trim();
  if (isNumericString(trimmed)) {
    return parseInt(trimmed, 10);
  }

  return null;
}

/**
 * Format an input reference for display
 */
export function formatInputReference(input: InputReference): string {
  const type = getInputReferenceType(input);
  const normalized = normalizeInput(input);

  switch (type) {
    case 'number':
      return `Input #${normalized}`;
    case 'guid':
      // Extract first segment of GUID (skip opening brace)
      return `Input ${normalized.substring(0, 9)}...`;
    case 'name':
      return `"${normalized}"`;
  }
}

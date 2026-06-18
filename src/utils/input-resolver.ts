/**
 * Smart Input Resolver
 * Provides fuzzy matching, suggestions, and pre-validation for input references
 */

import type { VmixState, VmixInput } from '../state/types.js';
import { isGuid, isNumericString, normalizeInputKey, type InputReference } from './input-normalizer.js';

/**
 * Result of resolving an input reference
 */
export interface InputResolveResult {
  success: boolean;
  input?: VmixInput;
  error?: string;
  suggestions?: string[];
  /** If true, the match was fuzzy (case-insensitive or partial) */
  fuzzyMatch?: boolean;
  /** The normalized reference that was used */
  normalizedRef?: string;
  /** The input's key (GUID) - use this for API calls as it's immutable */
  key?: string;
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching input names
 */
function levenshteinDistance(a: string, b: string): number {
  // Initialize matrix with proper dimensions
  const matrix: number[][] = Array.from({ length: b.length + 1 }, () =>
    Array.from({ length: a.length + 1 }, () => 0)
  );

  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i]![0] = i;
  }
  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1, // substitution
          matrix[i]![j - 1]! + 1, // insertion
          matrix[i - 1]![j]! + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}

/**
 * Calculate similarity score (0-1, higher is more similar)
 */
function similarityScore(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  // Exact match (case-insensitive)
  if (aLower === bLower) return 1;

  // Contains match
  if (aLower.includes(bLower) || bLower.includes(aLower)) {
    return 0.8;
  }

  // Levenshtein-based similarity
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(aLower, bLower);
  return 1 - distance / maxLen;
}

/**
 * Find similar input names for suggestions
 */
function findSimilarInputs(
  searchName: string,
  inputs: VmixInput[],
  maxSuggestions = 3
): VmixInput[] {
  const scored = inputs.map((input) => ({
    input,
    score: similarityScore(searchName, input.title),
  }));

  return scored
    .filter((s) => s.score > 0.3) // Minimum similarity threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions)
    .map((s) => s.input);
}

/**
 * Smart input resolver with fuzzy matching and helpful error messages
 */
export function resolveInput(
  state: VmixState,
  reference: InputReference
): InputResolveResult {
  // Handle number references
  if (typeof reference === 'number') {
    if (!Number.isInteger(reference) || reference < 1) {
      return {
        success: false,
        error: `Invalid input number: ${reference}. Must be a positive integer.`,
        normalizedRef: String(reference),
      };
    }

    const input = state.inputs.find((i) => i.number === reference);
    if (input) {
      return { success: true, input, normalizedRef: String(reference), key: input.key };
    }

    const maxInput = state.inputs.length;
    return {
      success: false,
      error: `Input #${reference} not found. vMix has ${maxInput} input${maxInput !== 1 ? 's' : ''} (1-${maxInput}).`,
      suggestions: maxInput > 0 ? [`Use a number between 1 and ${maxInput}`] : undefined,
      normalizedRef: String(reference),
    };
  }

  const trimmed = reference.trim();
  if (trimmed.length === 0) {
    return {
      success: false,
      error: 'Input reference cannot be empty.',
      normalizedRef: trimmed,
    };
  }

  // Handle numeric strings
  if (isNumericString(trimmed)) {
    const num = parseInt(trimmed, 10);
    return resolveInput(state, num);
  }

  // Handle GUIDs (case-insensitive; braced and unbraced forms are equivalent)
  if (isGuid(trimmed)) {
    const normalizedKey = normalizeInputKey(trimmed);
    const input = state.inputs.find(
      (i) => normalizeInputKey(i.key) === normalizedKey
    );
    if (input) {
      return { success: true, input, normalizedRef: trimmed, key: input.key };
    }
    return {
      success: false,
      error: `Input with GUID "${trimmed}" not found.`,
      normalizedRef: trimmed,
    };
  }

  // Try exact match first (case-sensitive)
  const exactMatch = state.inputs.find((i) => i.title === trimmed);
  if (exactMatch) {
    return { success: true, input: exactMatch, normalizedRef: trimmed, key: exactMatch.key };
  }

  // Try case-insensitive match
  const caseInsensitiveMatch = state.inputs.find(
    (i) => i.title.toLowerCase() === trimmed.toLowerCase()
  );
  if (caseInsensitiveMatch) {
    return {
      success: true,
      input: caseInsensitiveMatch,
      fuzzyMatch: true,
      normalizedRef: caseInsensitiveMatch.title, // Use the correct case
      key: caseInsensitiveMatch.key,
    };
  }

  // Find similar inputs for suggestions
  const similar = findSimilarInputs(trimmed, state.inputs);

  if (similar.length > 0) {
    const suggestions = similar.map(
      (s) => `"${s.title}" (Input #${s.number}, ${s.type})`
    );

    // Check if top suggestion is very close (likely a typo)
    const topSuggestion = similar[0]!;
    const topScore = similarityScore(trimmed, topSuggestion.title);
    if (topScore > 0.7) {
      return {
        success: false,
        error: `Input "${trimmed}" not found. Did you mean "${topSuggestion.title}"?\n\nNote: Input names are case-sensitive in vMix.`,
        suggestions,
        normalizedRef: trimmed,
      };
    }

    return {
      success: false,
      error: `Input "${trimmed}" not found.\n\nNote: Input names are case-sensitive in vMix.\n\nSimilar inputs:`,
      suggestions,
      normalizedRef: trimmed,
    };
  }

  // No similar inputs found
  const availableInputs = state.inputs.slice(0, 5).map((i) => `"${i.title}"`);
  const moreText = state.inputs.length > 5 ? ` and ${state.inputs.length - 5} more` : '';

  return {
    success: false,
    error:
      `Input "${trimmed}" not found.\n\nNote: Input names are case-sensitive in vMix.\n\n` +
      `Available inputs: ${availableInputs.join(', ')}${moreText}`,
    normalizedRef: trimmed,
  };
}

/**
 * Resolve input and return the normalized reference string for vMix API
 * Returns the resolved input name (with correct case) or throws detailed error
 */
export function resolveInputOrThrow(
  state: VmixState,
  reference: InputReference
): { input: VmixInput; normalizedRef: string } {
  const result = resolveInput(state, reference);

  if (!result.success) {
    let errorMsg = result.error ?? 'Input not found';
    if (result.suggestions && result.suggestions.length > 0) {
      errorMsg += '\n' + result.suggestions.map((s) => `  • ${s}`).join('\n');
    }
    throw new Error(errorMsg);
  }

  return {
    input: result.input!,
    normalizedRef: result.normalizedRef ?? String(reference),
  };
}

/**
 * Format a helpful error result for tool responses
 */
export function formatResolveError(result: InputResolveResult): {
  content: { type: 'text'; text: string }[];
  isError: true;
} {
  let text = result.error ?? 'Input not found';
  if (result.suggestions && result.suggestions.length > 0) {
    text += '\n' + result.suggestions.map((s) => `  • ${s}`).join('\n');
  }

  return {
    content: [{ type: 'text' as const, text }],
    isError: true,
  };
}

/**
 * Escape a string for use in XPath expressions
 * Handles single quotes, double quotes, and special characters
 */
export function escapeXPath(value: string): string {
  // If contains single quote, use double quotes and concat
  if (value.includes("'")) {
    if (!value.includes('"')) {
      // Can use double quotes
      return `"${value}"`;
    }
    // Contains both - need to use concat
    const parts: string[] = [];
    let current = '';
    for (const char of value) {
      if (char === "'") {
        if (current) parts.push(`'${current}'`);
        parts.push('"\'"');
        current = '';
      } else {
        current += char;
      }
    }
    if (current) parts.push(`'${current}'`);
    return `concat(${parts.join(',')})`;
  }
  // Safe to use single quotes
  return `'${value}'`;
}

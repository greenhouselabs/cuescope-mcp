/**
 * Shared goal-parsing and input-reference helpers for the Review generators
 * (generate-script and generate-api-sequence). These were previously copy-pasted
 * verbatim in both tools; keeping one copy prevents the two from drifting apart.
 */

import type { VmixInput } from '../../state/types.js';

export function stableInputReference(input: VmixInput): string {
  return input.key.length > 0 ? input.key : String(input.number);
}

export function describeInput(input: VmixInput): string {
  return `${input.number}: ${input.title} (${input.type})`;
}

export function parseSeconds(text: string, fallbackSeconds: number): number {
  const match = text.match(/(\d+)\s*(second|seconds|sec|secs|s)\b/i);
  if (!match?.[1]) return fallbackSeconds;

  const seconds = parseInt(match[1], 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : fallbackSeconds;
}

export function parseOverlayChannel(text: string): number {
  const match = text.match(/(?:overlay|channel)\s*(\d)/i);
  if (!match?.[1]) return 1;

  const channel = parseInt(match[1], 10);
  return channel >= 1 && channel <= 4 ? channel : 1;
}

export function extractFieldValues(goal: string, fields: string[]): Record<string, string> {
  const values: Record<string, string> = {};

  for (const field of fields) {
    const baseName = field.replace(/\.(text|image)$/i, '');
    const escapedFieldName = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`${escapedFieldName}\\s*(?:to|=|:)\\s*["']?([^"',\\n]+)["']?`, 'i'),
      new RegExp(`${escapedBaseName}\\s*(?:to|=|:)\\s*["']?([^"',\\n]+)["']?`, 'i'),
      new RegExp(
        `(?:field|selectedname)\\s+${escapedFieldName}\\b[\\s\\S]*?\\bto\\s*["']?([^"',\\n]+)["']?`,
        'i'
      ),
    ];
    const match = patterns.map((pattern) => goal.match(pattern)).find(Boolean);
    if (match?.[1]) {
      values[field] = match[1].trim();
      continue;
    }

    const fieldMention = goal.match(new RegExp(escapedFieldName, 'i'));
    if (fieldMention?.index === undefined) continue;

    const afterField = goal.slice(fieldMention.index + fieldMention[0].length);
    const toValueMatches = [...afterField.matchAll(
      /\bto\s+["']?(.+?)(?=,?\s+(?:then|and|while|without|using|use|do not)\b|[.]\s|$)/gi
    )];
    const fallbackValue = toValueMatches.at(-1)?.[1]?.trim().replace(/["']$/, '');

    if (fallbackValue && !/^(the\s+)?(field|input|title|value)$/i.test(fallbackValue)) {
      values[field] = fallbackValue;
    }
  }

  return values;
}

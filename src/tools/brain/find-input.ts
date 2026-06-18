/**
 * vmix_find_input - Read-only input discovery with confidence scoring
 */

import { z } from 'zod';
import { createTool, toolJsonContent, type ToolContext } from '../base.js';
import { assumptionDetail, buildAnalysisConfidence } from './analysis-metadata.js';
import {
  analyzeInput,
  INPUT_ROLES,
  type InputAnalysis,
  type InputRole,
} from './analysis-helpers.js';

type SearchMode = 'auto' | 'key' | 'number' | 'title' | 'type' | 'role' | 'field';
type MatchKind = 'exact' | 'caseInsensitive' | 'partial' | 'alias';

interface ParsedQuery {
  raw: string;
  mode: SearchMode;
  term: string;
}

interface MatchDetail {
  field: SearchMode;
  kind: MatchKind;
  value: string;
  confidence: number;
}

interface ScoredMatch {
  input: InputAnalysis;
  confidence: number;
  matchedOn: MatchDetail[];
}

const ROLE_ALIASES: Record<string, InputRole> = {
  camera: 'camera',
  cam: 'camera',
  cameras: 'camera',
  guest: 'remoteGuest',
  guests: 'remoteGuest',
  caller: 'remoteGuest',
  call: 'remoteGuest',
  remote: 'remoteGuest',
  remoteGuest: 'remoteGuest',
  title: 'titleGraphic',
  titles: 'titleGraphic',
  graphic: 'titleGraphic',
  graphics: 'titleGraphic',
  lowerthird: 'titleGraphic',
  lower: 'titleGraphic',
  image: 'imageGraphic',
  images: 'imageGraphic',
  audio: 'audioOnly',
  music: 'audioOnly',
  mic: 'audioOnly',
  video: 'mediaPlayback',
  media: 'mediaPlayback',
  playback: 'mediaPlayback',
  browser: 'browser',
  virtualset: 'virtualSet',
  virtual: 'virtualSet',
  presentation: 'presentation',
  powerpoint: 'presentation',
  utility: 'utility',
  colour: 'utility',
  color: 'utility',
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeRoleKey(value: string): string {
  return value.replace(/[\s_-]/g, '').toLowerCase();
}

function parseQuery(query: string): ParsedQuery {
  const trimmed = query.trim();
  const prefixMatch = trimmed.match(/^(key|number|title|type|role|field):(.+)$/i);

  if (!prefixMatch) {
    return {
      raw: trimmed,
      mode: 'auto',
      term: trimmed,
    };
  }

  return {
    raw: trimmed,
    mode: prefixMatch[1]!.toLowerCase() as SearchMode,
    term: prefixMatch[2]!.trim(),
  };
}

function roleFromQuery(term: string): InputRole | null {
  const roleKey = normalizeRoleKey(term);
  const exact = INPUT_ROLES.find((role) => normalizeRoleKey(role) === roleKey);

  if (exact) return exact;

  return ROLE_ALIASES[roleKey] ?? null;
}

function addDetail(
  details: MatchDetail[],
  field: SearchMode,
  kind: MatchKind,
  value: string,
  confidence: number
): void {
  details.push({
    field,
    kind,
    value,
    confidence,
  });
}

function scoreInput(input: InputAnalysis, parsed: ParsedQuery): ScoredMatch | null {
  const details: MatchDetail[] = [];
  const term = parsed.term.trim();
  const termLower = normalize(term);
  const roleMatch = roleFromQuery(term);

  const modes: SearchMode[] =
    parsed.mode === 'auto'
      ? ['key', 'number', 'title', 'type', 'role', 'field']
      : [parsed.mode];

  if (modes.includes('key')) {
    const keyLower = normalize(input.key);
    if (keyLower === termLower) {
      addDetail(details, 'key', 'exact', input.key, 1);
    } else if (termLower.length >= 4 && keyLower.includes(termLower)) {
      addDetail(details, 'key', 'partial', input.key, 0.7);
    }
  }

  if (modes.includes('number')) {
    const numberText = String(input.number);
    if (numberText === term) {
      addDetail(details, 'number', 'exact', numberText, 0.99);
    }
  }

  if (modes.includes('title')) {
    const titleLower = normalize(input.title);
    if (input.title === term) {
      addDetail(details, 'title', 'exact', input.title, 0.97);
    } else if (titleLower === termLower) {
      addDetail(details, 'title', 'caseInsensitive', input.title, 0.92);
    } else if (termLower.length >= 2 && titleLower.includes(termLower)) {
      addDetail(details, 'title', 'partial', input.title, 0.76);
    }
  }

  if (modes.includes('type')) {
    const typeLower = normalize(input.type);
    if (typeLower === termLower) {
      addDetail(details, 'type', 'exact', input.type, 0.88);
    } else if (termLower.length >= 2 && typeLower.includes(termLower)) {
      addDetail(details, 'type', 'partial', input.type, 0.66);
    }
  }

  if (modes.includes('role')) {
    if (roleMatch && input.role === roleMatch) {
      const kind = normalizeRoleKey(term) === normalizeRoleKey(input.role) ? 'exact' : 'alias';
      addDetail(details, 'role', kind, input.role, kind === 'exact' ? 0.86 : 0.8);
    } else if (normalizeRoleKey(input.role).includes(normalizeRoleKey(term))) {
      addDetail(details, 'role', 'partial', input.role, 0.6);
    }
  }

  if (modes.includes('field')) {
    for (const fieldName of input.fieldNames) {
      const fieldLower = normalize(fieldName);
      if (fieldLower === termLower) {
        addDetail(details, 'field', 'exact', fieldName, 0.84);
      } else if (termLower.length >= 2 && fieldLower.includes(termLower)) {
        addDetail(details, 'field', 'partial', fieldName, 0.64);
      }
    }
  }

  if (details.length === 0) return null;

  const confidence = Math.max(...details.map((detail) => detail.confidence));

  return {
    input,
    confidence,
    matchedOn: details.sort((a, b) => b.confidence - a.confidence),
  };
}

function buildNoMatchHints(inputs: InputAnalysis[]): string[] {
  const types = Array.from(new Set(inputs.map((input) => input.type).filter((type) => type.length > 0)));
  const fieldNames = Array.from(new Set(inputs.flatMap((input) => input.fieldNames)));

  return [
    'Try an exact input number, input key, or part of the input title.',
    `Known roles: ${INPUT_ROLES.join(', ')}.`,
    types.length > 0 ? `Known types: ${types.join(', ')}.` : 'No input types are visible.',
    fieldNames.length > 0
      ? `Known title fields include: ${fieldNames.slice(0, 12).join(', ')}.`
      : 'No title fields are visible in the current XML.',
    'Prefix queries are supported: key:{...}, number:3, title:Lower, type:GT, role:camera, field:Name.Text.',
  ];
}

function buildFinderConfidence(
  matches: ScoredMatch[],
  totalInputs: number,
  totalMatches: number,
  truncated: boolean,
  limit: number
) {
  const bestMatch = matches[0];

  return buildAnalysisConfidence(
    [
      {
        name: 'stateXml',
        score: totalInputs > 0 ? 0.9 : 0.45,
        weight: 1,
        reason:
          totalInputs > 0
            ? `${totalInputs} input(s) were available for search.`
            : 'No inputs were available in the current state.',
      },
      {
        name: 'bestMatch',
        score: bestMatch?.confidence ?? 0.25,
        weight: 2,
        reason: bestMatch
          ? `Best match was ${bestMatch.input.title} at ${Number(bestMatch.confidence.toFixed(2))}.`
          : 'No candidate matched the query.',
      },
      {
        name: 'ambiguity',
        score: totalMatches <= 1 ? 0.92 : totalMatches <= 3 ? 0.76 : truncated ? 0.48 : 0.6,
        weight: 1,
        reason: truncated
          ? `Returned ${matches.length} of ${totalMatches} match(es); increase limit above ${limit} to inspect more.`
          : `${totalMatches} match(es) matched; ${matches.length} returned.`,
      },
    ],
    'Confidence reflects input visibility, best match strength, and result ambiguity.'
  );
}

function buildFinderAssumptions() {
  return [
    assumptionDetail(
      'The current XML input list is complete enough for lookup.',
      'This finder does not contact vMix beyond the shared state cache.',
      'medium',
      0.86
    ),
    assumptionDetail(
      'Role and production-role matches are heuristic.',
      'Roles are inferred from input type, title, fields, routing, and duration.',
      'medium',
      0.78
    ),
    assumptionDetail(
      'Stable keys should be preferred when a match is used in scripts or API plans.',
      'Input numbers and titles can change in edited presets.',
      'medium',
      0.9
    ),
  ];
}

export const findInputTool = createTool({
  name: 'vmix_find_input',
  description:
    'Read-only input finder. Searches current vMix inputs by key, number, title, type, inferred role, ' +
    'or title field name and returns stable references with confidence scores.',
  schema: z.object({
    query: z
      .string()
      .min(1)
      .describe(
        'Search query. Supports plain text or prefixes: key:, number:, title:, type:, role:, field:.'
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe('Maximum number of matches to return. Default: 10.'),
  }),
  handler: async ({ query, limit }: { query: string; limit?: number }, ctx: ToolContext) => {
    const state = await ctx.state.getState();
    const parsed = parseQuery(query);
    const maxResults = limit ?? 10;
    const inputs = state.inputs.map(analyzeInput);
    const allMatches = inputs
      .map((input) => scoreInput(input, parsed))
      .filter((match): match is ScoredMatch => match !== null)
      .sort((a, b) => b.confidence - a.confidence || a.input.number - b.input.number);
    const matches = allMatches.slice(0, maxResults);
    const totalMatches = allMatches.length;
    const truncated = totalMatches > matches.length;

    const result = {
      query: parsed.raw,
      mode: parsed.mode,
      totalInputs: inputs.length,
      totalMatches,
      returned: matches.length,
      count: matches.length,
      limit: maxResults,
      truncated,
      warnings: truncated
        ? [
            `Results truncated: returned ${matches.length} of ${totalMatches} matches. Increase limit up to 50 to inspect more.`,
          ]
        : [],
      matches: matches.map((match) => ({
        confidence: Number(match.confidence.toFixed(2)),
        matchedOn: match.matchedOn.map((detail) => ({
          field: detail.field,
          kind: detail.kind,
          value: detail.value,
          confidence: Number(detail.confidence.toFixed(2)),
        })),
        input: match.input,
        recommendation: {
          preferredReference: match.input.stableReference,
          reason: 'Use the input key when available; it is more stable than input number or title.',
        },
      })),
      noMatchHints: totalMatches === 0 ? buildNoMatchHints(inputs) : [],
      analysisConfidence: buildFinderConfidence(
        matches,
        inputs.length,
        totalMatches,
        truncated,
        maxResults
      ),
      assumptions: [
        'This lookup is read-only and uses the current vMix XML cache.',
        'Role and production-role matches are heuristic and include confidence details for review.',
      ],
      assumptionDetails: buildFinderAssumptions(),
    };

    return toolJsonContent(result);
  },
});

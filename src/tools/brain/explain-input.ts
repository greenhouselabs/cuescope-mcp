/**
 * vmix_explain_input - Read-only explanation for one vMix input
 */

import { z } from 'zod';
import { createTool, toolJsonContent, type ToolContext } from '../base.js';
import type { VmixInput, VmixState } from '../../state/types.js';
import { assumptionDetail, buildAnalysisConfidence } from './analysis-metadata.js';
import {
  analyzeInput,
  buildAudioBusMap,
  isLikelyOfflinePlaceholder,
  type InputAnalysis,
} from './analysis-helpers.js';

type InputReference = string | number;
type ResolutionKind = 'key' | 'number' | 'title' | 'caseInsensitiveTitle' | 'partialTitle';
type ExplainRiskSeverity = 'warning' | 'info';
type ExplainRiskCategory = 'program' | 'audio' | 'graphics';

const BUS_PEER_LIMIT = 10;

interface ResolvedInput {
  input: VmixInput;
  matchedBy: ResolutionKind;
  confidence: number;
}

interface AudioPeerSummary {
  bus: string;
  totalPeers: number;
  returned: number;
  limit: number;
  truncated: boolean;
  omittedCount: number;
  mutedPeers: number;
  roleCounts: Record<string, number>;
  productionRoleCounts: Record<string, number>;
  otherInputs: Array<{
    number: number;
    title: string;
    role: string;
    productionRole: string;
    muted: boolean;
  }>;
}

interface ExplainProductionRisk {
  severity: ExplainRiskSeverity;
  category: ExplainRiskCategory;
  message: string;
  evidence: string[];
  recommendation: string;
}

function resolveInput(state: VmixState, reference: InputReference): ResolvedInput | null {
  if (typeof reference === 'number') {
    const input = state.inputs.find((candidate) => candidate.number === reference);
    return input ? { input, matchedBy: 'number', confidence: 0.99 } : null;
  }

  const trimmed = reference.trim();
  const lower = trimmed.toLowerCase();

  const keyMatch = state.inputs.find((candidate) => candidate.key.toLowerCase() === lower);
  if (keyMatch) {
    return { input: keyMatch, matchedBy: 'key', confidence: 1 };
  }

  if (/^\d+$/.test(trimmed)) {
    const number = parseInt(trimmed, 10);
    const input = state.inputs.find((candidate) => candidate.number === number);
    return input ? { input, matchedBy: 'number', confidence: 0.99 } : null;
  }

  const exactTitle = state.inputs.find((candidate) => candidate.title === trimmed);
  if (exactTitle) {
    return { input: exactTitle, matchedBy: 'title', confidence: 0.97 };
  }

  const caseInsensitiveTitle = state.inputs.find(
    (candidate) => candidate.title.toLowerCase() === lower
  );
  if (caseInsensitiveTitle) {
    return { input: caseInsensitiveTitle, matchedBy: 'caseInsensitiveTitle', confidence: 0.92 };
  }

  const partialMatches = getPartialTitleMatches(state, trimmed);
  if (partialMatches.length === 1) {
    return { input: partialMatches[0]!, matchedBy: 'partialTitle', confidence: 0.76 };
  }

  return null;
}

function getPartialTitleMatches(state: VmixState, reference: string): VmixInput[] {
  const lower = reference.trim().toLowerCase();
  if (lower.length < 2) return [];

  return state.inputs.filter((candidate) => candidate.title.toLowerCase().includes(lower));
}

function incrementCount(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function countPeerRoles(peers: InputAnalysis[]): {
  roleCounts: Record<string, number>;
  productionRoleCounts: Record<string, number>;
} {
  const roleCounts: Record<string, number> = {};
  const productionRoleCounts: Record<string, number> = {};

  for (const peer of peers) {
    incrementCount(roleCounts, peer.role);
    incrementCount(productionRoleCounts, peer.productionRole.primary.role);
  }

  return { roleCounts, productionRoleCounts };
}

function buildAudioPeers(
  analysis: InputAnalysis,
  allInputs: InputAnalysis[],
  limit = BUS_PEER_LIMIT
): AudioPeerSummary[] {
  const busMap = buildAudioBusMap(allInputs);

  return analysis.audioBuses.map((bus) => {
    const peers = (busMap[bus] ?? []).filter((input) => input.number !== analysis.number);
    const shownPeers = peers.slice(0, limit);
    const { roleCounts, productionRoleCounts } = countPeerRoles(peers);

    return {
      bus,
      totalPeers: peers.length,
      returned: shownPeers.length,
      limit,
      truncated: peers.length > shownPeers.length,
      omittedCount: Math.max(0, peers.length - shownPeers.length),
      mutedPeers: peers.filter((input) => input.muted).length,
      roleCounts,
      productionRoleCounts,
      otherInputs: shownPeers
      .map((input) => ({
        number: input.number,
        title: input.title,
        role: input.role,
        productionRole: input.productionRole.primary.role,
        muted: input.muted,
      })),
    };
  });
}

function buildOutputWarnings(busPeers: AudioPeerSummary[]): string[] {
  return busPeers
    .filter((peerGroup) => peerGroup.truncated)
    .map(
      (peerGroup) =>
        `Audio bus ${peerGroup.bus} peers truncated: returned ${peerGroup.returned} of ${peerGroup.totalPeers} peer inputs. Use the role counts before expanding peer detail.`
    );
}

function buildOverlayChannels(state: VmixState, inputNumber: number): number[] {
  return state.overlays
    .map((overlayInputNumber, index) => (overlayInputNumber === inputNumber ? index + 1 : null))
    .filter((channel): channel is number => channel !== null);
}

function buildProductionRisks(
  analysis: InputAnalysis,
  placement: { program: boolean; preview: boolean; overlays: number[] }
): ExplainProductionRisk[] {
  const risks: ExplainProductionRisk[] = [];

  if (placement.program && isLikelyOfflinePlaceholder(analysis)) {
    risks.push({
      severity: 'warning',
      category: 'program',
      message: `Program is currently an offline/slate-style input: ${analysis.title}.`,
      evidence: [
        `program input number is ${analysis.number}`,
        `input type is ${analysis.type}`,
        `state is ${analysis.state || 'unknown'}`,
      ],
      recommendation:
        'Confirm this placeholder or slate is intentional before trusting Program-aware go-live guidance.',
    });
  }

  if (analysis.muted && analysis.audioBuses.length > 0) {
    risks.push({
      severity: 'warning',
      category: 'audio',
      message: placement.program
        ? `Program input ${analysis.title} is muted while routed to audio bus(es).`
        : `Input ${analysis.title} is muted while routed to audio bus(es).`,
      evidence: [`routed buses: ${analysis.audioBuses.join(', ')}`, 'muted is true'],
      recommendation: 'Confirm this mute is intentional before relying on this input for show audio.',
    });
  }

  if (
    analysis.audioBuses.length === 0 &&
    ['camera', 'remoteGuest', 'audioOnly', 'mediaPlayback'].includes(analysis.role)
  ) {
    risks.push({
      severity: 'warning',
      category: 'audio',
      message: `Input ${analysis.title} has no visible audio bus routing in the current XML.`,
      evidence: [`role is ${analysis.role}`, 'audioBuses is empty'],
      recommendation: 'Confirm this source is intentionally silent or route it to the expected bus.',
    });
  }

  if (analysis.role === 'titleGraphic' && analysis.fieldNames.length === 0) {
    risks.push({
      severity: 'info',
      category: 'graphics',
      message: `Title/graphic input ${analysis.title} exposes no visible text or image fields.`,
      evidence: ['fieldNames is empty'],
      recommendation: 'Inspect the title template if automation needs to update fields.',
    });
  }

  if (analysis.role === 'remoteGuest') {
    risks.push({
      severity: 'info',
      category: 'audio',
      message: `Remote guest input ${analysis.title} may require mix-minus review.`,
      evidence: [`routed buses: ${analysis.audioBuses.join(', ') || 'none visible'}`],
      recommendation: 'Check return audio routing before using this guest/call input in a live show.',
    });
  }

  return risks;
}

function buildWarnings(
  analysis: InputAnalysis,
  placement: { program: boolean; preview: boolean; overlays: number[] },
  productionRisks: ExplainProductionRisk[]
): string[] {
  const warnings: string[] = [];

  if (analysis.muted && analysis.audioBuses.length > 0) {
    warnings.push('This input is muted while routed to one or more audio buses.');
  }

  if (placement.program && analysis.muted && analysis.audioBuses.length > 0) {
    warnings.push('This input is currently on Program and muted, so its routed audio may not be heard.');
  }

  if (analysis.audioBuses.length === 0 && ['camera', 'remoteGuest', 'audioOnly', 'mediaPlayback'].includes(analysis.role)) {
    warnings.push('This input has no visible audio bus routing in the current XML.');
  }

  if (analysis.role === 'titleGraphic' && analysis.fieldNames.length === 0) {
    warnings.push('This looks like a title/graphic input, but no text or image fields are visible.');
  }

  if (analysis.role === 'remoteGuest') {
    warnings.push('Remote guest audio can require mix-minus review; check bus routing before using this in a show.');
  }

  for (const risk of productionRisks) {
    if (risk.category === 'program' && !warnings.includes(risk.message)) {
      warnings.push(risk.message);
    }
  }

  return warnings;
}

function buildSuggestions(analysis: InputAnalysis): string[] {
  const primaryProductionRole = analysis.productionRole.primary.role;
  const suggestions: string[] = [
    `Prefer stable reference ${analysis.stableReference} when generating scripts or API sequences.`,
  ];

  if (analysis.role === 'titleGraphic' && analysis.fieldNames.length > 0) {
    suggestions.push(`Use available field names exactly: ${analysis.fieldNames.join(', ')}.`);
  }

  if (analysis.durationMs > 0) {
    suggestions.push('For playback automation, use XML position/duration checks and include Sleep() in polling loops.');
  }

  if (analysis.audioBuses.length > 0) {
    suggestions.push(`Review audio routing on buses: ${analysis.audioBuses.join(', ')}.`);
  }

  if (primaryProductionRole === 'callInput' || primaryProductionRole === 'guestCamera') {
    suggestions.push('Review mix-minus routing before using this guest/call input in a live show.');
  }

  return suggestions;
}

function buildNotFoundResponse(state: VmixState, reference: InputReference) {
  const referenceText = String(reference);
  const partialMatches = typeof reference === 'string' ? getPartialTitleMatches(state, reference) : [];
  const candidates = partialMatches.map(analyzeInput);

  return {
    error: `Input not found: ${referenceText}`,
    reference: referenceText,
    candidates,
    hints: [
      'Use an exact input key, input number, or exact title.',
      'Use vmix_find_input first when the input reference is uncertain.',
      `Available inputs: ${state.inputs
        .slice(0, 10)
        .map((input) => `${input.number}: ${input.title}`)
        .join(', ')}${state.inputs.length > 10 ? ' ...' : ''}`,
    ],
    analysisConfidence: buildAnalysisConfidence(
      [
        {
          name: 'stateXml',
          score: state.inputs.length > 0 ? 0.88 : 0.45,
          reason: `${state.inputs.length} input(s) were available while resolving the query.`,
        },
        {
          name: 'resolution',
          score: candidates.length > 0 ? 0.45 : 0.2,
          weight: 2,
          reason:
            candidates.length > 0
              ? `${candidates.length} partial candidate(s) were found but not enough for a safe resolution.`
              : 'No input matched the supplied reference.',
        },
      ],
      'Confidence is low because the input could not be safely resolved.'
    ),
    assumptionDetails: buildExplainAssumptions(null),
  };
}

function buildExplainConfidence(
  resolved: ResolvedInput,
  analysis: InputAnalysis,
  warningCount: number
) {
  return buildAnalysisConfidence(
    [
      {
        name: 'resolution',
        score: resolved.confidence,
        weight: 2,
        reason: `Input resolved by ${resolved.matchedBy}.`,
      },
      {
        name: 'productionRole',
        score: analysis.productionRole.primary.confidence,
        weight: 1,
        reason: `Primary production role is ${analysis.productionRole.primary.role}.`,
      },
      {
        name: 'visibleState',
        score: 0.86,
        weight: 1,
        reason: 'Placement, fields, playback, and routing are taken from current XML.',
      },
      {
        name: 'warningLoad',
        score: Math.max(0.55, 1 - warningCount * 0.08),
        weight: 1,
        reason: `${warningCount} warning(s) were produced for this input.`,
      },
    ],
    'Confidence reflects reference resolution, role inference, visible state, and warning load.'
  );
}

function buildExplainAssumptions(analysis: InputAnalysis | null) {
  return [
    assumptionDetail(
      'The current XML cache represents this input accurately.',
      'The tool does not execute commands or refresh vMix outside the shared state cache.',
      'medium',
      0.86
    ),
    assumptionDetail(
      'Stable input keys are preferred for scripts and API plans.',
      analysis?.key
        ? `${analysis.title} exposes stable key ${analysis.key}.`
        : 'No resolved input key is available for this response.',
      'medium',
      analysis?.key ? 0.92 : 0.55
    ),
    assumptionDetail(
      'Production role is inferred, not operator-confirmed.',
      analysis
        ? `Primary role ${analysis.productionRole.primary.role} has confidence ${analysis.productionRole.primary.confidence}.`
        : 'No input was resolved, so no production role could be confirmed.',
      'medium',
      analysis?.productionRole.primary.confidence ?? 0.35
    ),
  ];
}

export const explainInputTool = createTool({
  name: 'vmix_explain_input',
  description:
    'Read-only explanation of a single vMix input, including role, references, program/preview/overlay usage, ' +
    'audio routing, title fields, playback state, warnings, and script-reference guidance.',
  schema: z.object({
    input: z
      .union([z.string().min(1), z.number().int().positive()])
      .describe('Input key, number, exact title, or unique partial title to explain.'),
  }),
  handler: async ({ input }: { input: InputReference }, ctx: ToolContext) => {
    const state = await ctx.state.getState();
    const resolved = resolveInput(state, input);

    if (!resolved) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(buildNotFoundResponse(state, input), null, 2),
          },
        ],
        isError: true,
      };
    }

    const analysis = analyzeInput(resolved.input);
    const allInputs = state.inputs.map(analyzeInput);
    const overlayChannels = buildOverlayChannels(state, resolved.input.number);
    const placement = {
      program: state.active === resolved.input.number,
      preview: state.preview === resolved.input.number,
      overlays: overlayChannels,
    };

    const playback = {
      state: resolved.input.state,
      positionMs: resolved.input.position,
      durationMs: resolved.input.duration,
      remainingMs:
        resolved.input.duration > 0
          ? Math.max(0, resolved.input.duration - resolved.input.position)
          : null,
      progressPercent:
        resolved.input.duration > 0
          ? Number(((resolved.input.position / resolved.input.duration) * 100).toFixed(1))
          : null,
      loop: resolved.input.loop,
    };
    const busPeers = buildAudioPeers(analysis, allInputs);
    const outputWarnings = buildOutputWarnings(busPeers);
    const productionRisks = buildProductionRisks(analysis, placement);
    const warnings = buildWarnings(analysis, placement, productionRisks);

    const result = {
      query: input,
      resolution: {
        matchedBy: resolved.matchedBy,
        confidence: resolved.confidence,
      },
      input: analysis,
      references: {
        preferred: analysis.stableReference,
        key: analysis.key,
        number: analysis.number,
        title: analysis.title,
        note: 'Prefer the key when available; titles and numbers can change.',
      },
      placement,
      audio: {
        muted: analysis.muted,
        buses: analysis.audioBuses,
        busPeers,
      },
      fields: {
        count: analysis.fieldNames.length,
        names: analysis.fieldNames,
        values: resolved.input.fields ?? {},
      },
      playback,
      warnings,
      productionRisks,
      outputWarnings,
      suggestions: buildSuggestions(analysis),
      analysisConfidence: buildExplainConfidence(resolved, analysis, warnings.length),
      assumptions: [
        'This explanation is read-only and built from the current vMix XML.',
        'Production-role detection is heuristic and includes confidence/evidence for review.',
      ],
      assumptionDetails: buildExplainAssumptions(analysis),
      parserLimitations: [
        'Layers, nested virtual set details, list contents, data sources, mix output destinations, and triggers are not deeply parsed yet.',
      ],
    };

    return toolJsonContent(result);
  },
});

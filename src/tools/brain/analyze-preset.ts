/**
 * vmix_analyze_preset - Read-only production map for the current vMix preset
 */

import { z } from 'zod';
import { createTool, toolJsonContent, type ToolContext } from '../base.js';
import type { VmixAudioRouting, VmixState } from '../../state/types.js';
import { getStateRelationships } from '../../state/relationships.js';
import { createAudioRouting, createOverlayChannels } from '../../state/normalized-topology.js';
import { assumptionDetail, average, buildAnalysisConfidence } from './analysis-metadata.js';
import { buildProductionSummary } from './production-summary.js';
import {
  analyzeInput,
  buildAudioBusMap,
  countProductionRoles,
  findInputByNumber,
  groupByProductionRole,
  groupByRole,
  summarizeInputs,
  type InputAnalysis,
} from './analysis-helpers.js';

type AnalyzePresetDetail = 'summary' | 'full';
type AnalyzePresetParams = {
  detail?: AnalyzePresetDetail;
};
type ProductionSummary = ReturnType<typeof buildProductionSummary>;
type StateRelationships = ReturnType<typeof getStateRelationships>;

const SUMMARY_INPUT_INDEX_LIMIT = 20;

function groupNumbers<T extends string>(groups: Record<T, InputAnalysis[]>): Record<T, number[]> {
  const out = {} as Record<T, number[]>;
  for (const key of Object.keys(groups) as T[]) {
    out[key] = groups[key].map((input) => input.number);
  }
  return out;
}

function buildWarnings(state: VmixState, inputs: InputAnalysis[]): string[] {
  const warnings: string[] = [];
  const activeInput = state.active > 0 ? findInputByNumber(state, state.active) : null;
  const previewInput = state.preview > 0 ? findInputByNumber(state, state.preview) : null;
  const routedMuted = inputs.filter((input) => input.muted && input.audioBuses.length > 0);
  const liveSources = inputs.filter((input) => input.role === 'camera' || input.role === 'remoteGuest');
  const graphics = inputs.filter(
    (input) => input.role === 'titleGraphic' || input.role === 'imageGraphic'
  );

  if (state.inputs.length === 0) {
    warnings.push('No inputs are visible in the current vMix XML.');
  }

  if (state.active > 0 && !activeInput) {
    warnings.push(`Program references input ${state.active}, but that input was not found.`);
  }

  if (state.preview > 0 && !previewInput) {
    warnings.push(`Preview references input ${state.preview}, but that input was not found.`);
  }

  if (liveSources.length === 0) {
    warnings.push('No obvious live camera or remote guest sources were detected.');
  }

  if (graphics.length === 0) {
    warnings.push('No obvious title or image graphics were detected.');
  }

  if (routedMuted.length > 0) {
    warnings.push(
      `${routedMuted.length} routed input(s) are muted: ${routedMuted
        .map((input) => input.title)
        .join(', ')}.`
    );
  }

  if (state.fadeToBlack) {
    warnings.push('Fade to Black is currently active.');
  }

  for (let index = 0; index < state.overlays.length; index++) {
    const overlayInputNumber = state.overlays[index];
    if (typeof overlayInputNumber === 'number' && !findInputByNumber(state, overlayInputNumber)) {
      warnings.push(
        `Overlay channel ${index + 1} references input ${overlayInputNumber}, but that input was not found.`
      );
    }
  }

  return warnings;
}

function buildPresetConfidence(
  state: VmixState,
  inputs: InputAnalysis[],
  warnings: string[],
  riskWarningCount: number
) {
  const activeResolved = state.active <= 0 || findInputByNumber(state, state.active) !== null;
  const previewResolved = state.preview <= 0 || findInputByNumber(state, state.preview) !== null;
  const roleConfidence = average(
    inputs.map((input) => input.productionRole.primary.confidence),
    0.5
  );
  const warningPenalty = Math.min(0.35, warnings.length * 0.06 + riskWarningCount * 0.03);

  return buildAnalysisConfidence(
    [
      {
        name: 'stateXml',
        score: inputs.length > 0 ? 0.9 : 0.45,
        weight: 2,
        reason:
          inputs.length > 0
            ? `${inputs.length} input(s) were parsed from current XML.`
            : 'No inputs were parsed from current XML.',
      },
      {
        name: 'programPreviewResolution',
        score: activeResolved && previewResolved ? 0.92 : 0.55,
        weight: 1.5,
        reason: activeResolved && previewResolved
          ? 'Program and Preview references resolve to visible inputs or are empty.'
          : 'Program or Preview references a missing input.',
      },
      {
        name: 'productionRoleInference',
        score: roleConfidence,
        weight: 1,
        reason: 'Averaged primary production-role confidence across parsed inputs.',
      },
      {
        name: 'warningLoad',
        score: 1 - warningPenalty,
        weight: 1,
        reason: `${warnings.length} quick warning(s) and ${riskWarningCount} production risk warning(s) were produced.`,
      },
    ],
    'Confidence reflects XML completeness, Program/Preview resolution, role inference, and warning load.'
  );
}

function buildPresetAssumptions(state: VmixState, inputs: InputAnalysis[]) {
  return [
    assumptionDetail(
      'The current vMix XML cache represents the show state being analyzed.',
      'All Review Mode analysis in this tool is read-only and state-derived.',
      'high',
      0.88
    ),
    assumptionDetail(
      'Stable input keys are safer than input numbers or titles for generated scripts.',
      'Input numbers and titles can change when presets are edited; keys are intended to be stable.',
      'medium',
      0.9
    ),
    assumptionDetail(
      'Production roles are heuristic labels, not operator-confirmed truth.',
      `${inputs.length} input(s) were classified from type, title, fields, routing, and duration signals.`,
      'medium',
      average(inputs.map((input) => input.productionRole.primary.confidence), 0.5)
    ),
    assumptionDetail(
      'Some vMix internals are not deeply visible yet.',
      state.inputs.some((input) => (input.layers?.length ?? 0) > 0)
        ? 'Layer references and mix active/preview paths are partially parsed, but virtual set internals, triggers, lists, mix output routing, and replay details remain limited.'
        : 'Mix active/preview paths are parsed when exposed, but virtual set internals, triggers, lists, mix output routing, layers, and replay details remain limited.',
      'medium',
      0.72
    ),
  ];
}

function compactInput(input: InputAnalysis) {
  return {
    number: input.number,
    title: input.title,
    type: input.type,
    state: input.state,
    role: input.role,
    productionRole: input.productionRole.primary.role,
    productionRoleConfidence: Number(input.productionRole.primary.confidence.toFixed(2)),
    stableReference: input.stableReference,
    muted: input.muted,
    audioBuses: input.audioBuses,
    fieldCount: input.fieldNames.length,
    fieldNames: input.fieldNames.slice(0, 12),
    fieldsTruncated: input.fieldNames.length > 12,
    layerCount: input.layerCount,
  };
}

function compactList<T>(items: T[], limit: number) {
  return {
    total: items.length,
    returned: Math.min(items.length, limit),
    truncated: items.length > limit,
    items: items.slice(0, limit),
  };
}

function compactInputIndex(inputs: InputAnalysis[], limit = SUMMARY_INPUT_INDEX_LIMIT) {
  const items = inputs.slice(0, limit).map(compactInput);
  const truncated = inputs.length > items.length;

  return {
    total: inputs.length,
    returned: items.length,
    limit,
    truncated,
    warning: truncated
      ? `Input index truncated: returned ${items.length} of ${inputs.length} inputs. Pass detail:"full" for the complete per-input map.`
      : null,
    items,
  };
}

function buildCompactAudio(audioRouting: VmixAudioRouting) {
  return {
    buses: Object.fromEntries(
      Object.entries(audioRouting.buses).map(([bus, summary]) => [
        bus,
        {
          output: summary.output,
          inputCount: summary.inputs.length,
          mutedInputCount: summary.inputs.filter((input) => input.muted).length,
          inputNumbers: summary.inputs.map((input) => input.number),
        },
      ])
    ),
    unroutedCount: audioRouting.unrouted.length,
    unroutedSample: audioRouting.unrouted.slice(0, 20),
    unroutedTruncated: audioRouting.unrouted.length > 20,
  };
}

function buildCompactRelationships(relationships: StateRelationships) {
  return {
    activeInput: relationships.activeInput,
    previewInput: relationships.previewInput,
    overlays: relationships.overlays,
    mixes: relationships.mixes,
    buses: Object.fromEntries(
      Object.entries(relationships.buses).map(([bus, relationship]) => [
        bus,
        {
          output: relationship.output,
          inputCount: relationship.inputs.length,
          inputNumbers: relationship.inputs.map((input) => input.number),
        },
      ])
    ),
    titleInputCount: relationships.titleInputs.length,
    titleInputs: relationships.titleInputs.slice(0, 25).map((titleInput) => ({
      input: titleInput.input,
      fieldNames: titleInput.fieldNames,
    })),
    titleInputsTruncated: relationships.titleInputs.length > 25,
    inputUsageCount: relationships.inputUsages.length,
  };
}

function buildCompactProductionSummary(productionSummary: ProductionSummary) {
  return {
    showMap: productionSummary.showMap,
    showPatterns: compactList(productionSummary.showPatterns, 5),
    outputReadiness: {
      observed: productionSummary.outputReadiness.observed,
      audioOutputVisibility: {
        master: productionSummary.outputReadiness.audioOutputVisibility.master,
        parsedAuxBusCount:
          productionSummary.outputReadiness.audioOutputVisibility.parsedAuxBusCount,
        auxBuses: productionSummary.outputReadiness.audioOutputVisibility.auxBuses,
      },
      mixDestinationAwareness: productionSummary.outputReadiness.mixDestinationAwareness,
      risks: compactList(productionSummary.outputReadiness.risks, 8),
      unknowns: productionSummary.outputReadiness.unknowns,
      recommendedChecks: productionSummary.outputReadiness.recommendedChecks,
    },
    preflightReport: {
      status: productionSummary.preflightReport.status,
      score: productionSummary.preflightReport.score,
      summary: productionSummary.preflightReport.summary,
      blockers: productionSummary.preflightReport.blockers,
      cautions: productionSummary.preflightReport.cautions,
      checks: productionSummary.preflightReport.checks.map((check) => ({
        id: check.id,
        label: check.label,
        status: check.status,
        summary: check.summary,
      })),
      knownUnknownCount: productionSummary.preflightReport.knownUnknowns.length,
      recommendedNextTests: productionSummary.preflightReport.recommendedNextTests,
    },
    inventoryCounts: Object.fromEntries(
      Object.entries(productionSummary.inventory).map(([name, inputs]) => [name, inputs.length])
    ),
    graphicsInventory: {
      count: productionSummary.graphicsInventory.count,
      lowerThirdCount: productionSummary.graphicsInventory.lowerThirds.length,
      scorebugCount: productionSummary.graphicsInventory.scorebugs.length,
      otherGraphicCount: productionSummary.graphicsInventory.otherGraphics.length,
      fieldInputCount: productionSummary.graphicsInventory.fieldInputs.length,
    },
    audioRouting: {
      likelyAudioSources: productionSummary.audioRouting.likelyAudioSources,
      routedLikelyAudioSources: productionSummary.audioRouting.routedLikelyAudioSources,
      unroutedLikelyAudioSourceCount:
        productionSummary.audioRouting.unroutedLikelyAudioSources.length,
      mutedRoutedInputCount: productionSummary.audioRouting.mutedRoutedInputs.length,
      buses: Object.fromEntries(
        Object.entries(productionSummary.audioRouting.buses).map(([bus, summary]) => [
          bus,
          {
            output: summary.output,
            inputCount: summary.inputCount,
            mutedInputCount: summary.mutedInputCount,
            likelyGuestOrCallCount: summary.likelyGuestOrCallCount,
          },
        ])
      ),
    },
    overlayUsage: {
      activeChannels: productionSummary.overlayUsage.activeChannels,
      emptyChannels: productionSummary.overlayUsage.emptyChannels,
      graphicsOnOverlayCount: productionSummary.overlayUsage.graphicsOnOverlay.length,
    },
    riskSummary: productionSummary.riskSummary,
    riskWarnings: compactList(productionSummary.riskWarnings, 10),
  };
}

export const analyzePresetTool = createTool({
  name: 'vmix_analyze_preset',
  description:
    'Read-only analysis of the current live vMix state. Produces a production map from the live XML ' +
    'without executing any vMix functions. Analyzes what vMix is running now, not a saved file.',
  schema: z.object({
    detail: z
      .enum(['summary', 'full'])
      .optional()
      .describe('Output verbosity. Default summary returns a compact map; full returns every input analysis.'),
  }),
  handler: async ({ detail = 'summary' }: AnalyzePresetParams, ctx: ToolContext) => {
    const state = await ctx.state.getState();
    const inputs = state.inputs.map(analyzeInput);
    const inputsByRole = groupByRole(inputs);
    const inputsByProductionRole = groupByProductionRole(inputs);
    const audioBusMap = buildAudioBusMap(inputs);
    const overlayChannels = state.overlayChannels ?? createOverlayChannels(state.overlays, state.inputs);
    const audioRouting = state.audioRouting ?? createAudioRouting(state.inputs, state.audio);
    const relationships = getStateRelationships(state);
    const productionSummary = buildProductionSummary(state, inputs);
    const warnings = buildWarnings(state, inputs);

    // Single-emission input map: each input's full analysis appears exactly once
    // here, keyed by input number. Every other section references inputs by number
    // (plus title where it aids readability) instead of repeating the analysis.
    const inputsById: Record<number, InputAnalysis> = {};
    for (const input of inputs) {
      inputsById[input.number] = input;
    }

    const overlays = overlayChannels.map((overlay) => ({
      channel: overlay.channel,
      inputNumber: overlay.inputNumber,
      inputKey: overlay.inputKey,
      inputTitle: overlay.inputTitle,
    }));

    const programInput = inputsById[state.active] ?? null;
    const previewInput = inputsById[state.preview] ?? null;
    const common = {
      detail,
      summary: {
        version: state.version,
        edition: state.edition,
        inputCount: state.inputs.length,
        recording: state.recording,
        streaming: state.streaming,
        external: state.external,
        fadeToBlack: state.fadeToBlack,
      },
      program: {
        inputNumber: state.active,
        inputTitle: programInput?.title ?? null,
        inputType: programInput?.type ?? null,
        role: programInput?.role ?? null,
        productionRole: programInput?.productionRole.primary.role ?? null,
        stableReference: programInput?.stableReference ?? null,
      },
      preview: {
        inputNumber: state.preview,
        inputTitle: previewInput?.title ?? null,
        inputType: previewInput?.type ?? null,
        role: previewInput?.role ?? null,
        productionRole: previewInput?.productionRole.primary.role ?? null,
        stableReference: previewInput?.stableReference ?? null,
      },
      inputSummary: summarizeInputs(inputs),
      inputsByRole: groupNumbers(inputsByRole),
      productionRoles: {
        counts: countProductionRoles(inputs),
        inputsByPrimaryRole: groupNumbers(inputsByProductionRole),
      },
      overlays,
      warnings,
      analysisConfidence: buildPresetConfidence(
        state,
        inputs,
        warnings,
        productionSummary.riskSummary.total
      ),
      assumptions: [
        'This is a read-only analysis built from the current vMix XML.',
        'Input keys are listed as stable references and should be preferred over names in generated scripts.',
        'Production-role detection is heuristic and includes confidence/evidence for review.',
      ],
      assumptionDetails: buildPresetAssumptions(state, inputs),
      parserLimitations: [
        'Mix active/preview paths are parsed when exposed; mix output destinations, layers, lists, data sources, virtual set internals, and replay details are not deeply parsed yet.',
        'Some roles are inferred from input type, title, duration, routing, and available title fields.',
      ],
    };

    const summaryInputIndex = compactInputIndex(inputs);
    const result =
      detail === 'full'
        ? {
            ...common,
            inputs: inputsById,
            productionSummary,
            audio: {
              master: state.audio.master,
              buses: groupNumbers(audioBusMap),
              routing: audioRouting,
            },
            relationships,
          }
        : {
            ...common,
            inputIndex: summaryInputIndex.items,
            inputIndexTotal: summaryInputIndex.total,
            inputIndexReturned: summaryInputIndex.returned,
            inputIndexLimit: summaryInputIndex.limit,
            inputIndexTruncated: summaryInputIndex.truncated,
            outputWarnings: summaryInputIndex.warning ? [summaryInputIndex.warning] : [],
            productionSummary: buildCompactProductionSummary(productionSummary),
            audio: {
              master: state.audio.master,
              buses: groupNumbers(audioBusMap),
              routingSummary: buildCompactAudio(audioRouting),
            },
            relationships: buildCompactRelationships(relationships),
            fullResultHint:
              'Pass detail:"full" only when you need every analyzed input, full relationships, and full audio routing.',
          };

    return toolJsonContent(result);
  },
});

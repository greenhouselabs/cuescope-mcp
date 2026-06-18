/**
 * vmix_generate_show_checklist - Read-only operator handoff checklist generator
 */

import { z } from 'zod';
import { createTool, toolJsonContent, type ToolContext } from '../base.js';
import { analyzeInput } from './analysis-helpers.js';
import { buildProductionSummary } from './production-summary.js';

const ChecklistScenarioSchema = z
  .enum(['rehearsal', 'goLive', 'recovery', 'endShow'])
  .default('goLive');

type ChecklistScenario = z.infer<typeof ChecklistScenarioSchema>;
type ProductionSummary = ReturnType<typeof buildProductionSummary>;
type PreflightReport = ProductionSummary['preflightReport'];
type PreflightCheck = PreflightReport['checks'][number];

interface ChecklistSection {
  id: string;
  title: string;
  status: 'ready' | 'review' | 'blocked';
  items: string[];
}

function scenarioTitle(scenario: ChecklistScenario): string {
  switch (scenario) {
    case 'rehearsal':
      return 'Rehearsal Operator Handoff';
    case 'goLive':
      return 'Go-Live Operator Handoff';
    case 'recovery':
      return 'Recovery Operator Handoff';
    case 'endShow':
      return 'End-Show Operator Handoff';
  }
}

function recommendedDisposition(preflight: PreflightReport, scenario: ChecklistScenario): string {
  if (preflight.status === 'blocked') {
    return 'Do not proceed until blocked checks are resolved or explicitly accepted by the operator.';
  }

  if (preflight.status === 'caution') {
    return scenario === 'rehearsal'
      ? 'Proceed only as a rehearsal, and use the caution items as test targets.'
      : 'Proceed only after the operator reviews and accepts every caution item.';
  }

  return 'Ready from parsed MCP state, with normal operator confirmation still required.';
}

function checkStatusForSection(check: PreflightCheck): ChecklistSection['status'] {
  if (check.status === 'blocked') return 'blocked';
  if (check.status === 'caution' || check.status === 'info') return 'review';
  return 'ready';
}

function buildPreflightSections(
  preflight: PreflightReport,
  includePassedChecks: boolean
): ChecklistSection[] {
  const visibleChecks = includePassedChecks
    ? preflight.checks
    : preflight.checks.filter((check) => check.status !== 'pass');

  if (visibleChecks.length === 0) {
    return [
      {
        id: 'preflightChecks',
        title: 'Preflight Checks',
        status: 'ready',
        items: ['No non-passing preflight checks were detected from parsed state.'],
      },
    ];
  }

  return visibleChecks.map((check) => ({
    id: `preflight-${check.id}`,
    title: check.label,
    status: checkStatusForSection(check),
    items: [
      `${check.status.toUpperCase()}: ${check.summary}`,
      ...check.evidence.map((item) => `Evidence: ${item}`),
      `Operator action: ${check.recommendation}`,
    ],
  }));
}

function buildScenarioSection(
  scenario: ChecklistScenario,
  productionSummary: ProductionSummary
): ChecklistSection {
  const outputReadiness = productionSummary.outputReadiness;
  const hasMultipleMixes = outputReadiness.mixDestinationAwareness.parsedMixCount > 1;

  switch (scenario) {
    case 'rehearsal':
      return {
        id: 'rehearsalFlow',
        title: 'Rehearsal Flow',
        status: 'review',
        items: [
          'Confirm this is a rehearsal window and not a live show segment.',
          'Run through the first Program/Preview transition and re-read state afterward.',
          'Exercise expected overlays, title fields, timers, and score/clock updates.',
          'Listen to the actual destination feed or record a short rehearsal sample.',
          ...(hasMultipleMixes
            ? ['Check each parsed mix or clean feed on its intended screen, recording, stream, or external destination.']
            : []),
          'Use vmix_compare_xml_snapshots if you capture before/after XML around the rehearsal.',
        ],
      };
    case 'goLive':
      return {
        id: 'goLiveFlow',
        title: 'Go-Live Flow',
        status: productionSummary.preflightReport.status === 'blocked' ? 'blocked' : 'review',
        items: [
          'Confirm the correct preset is open and the current Program source matches the rundown.',
          'Confirm Preview is the intended first transition or standby source.',
          'Confirm Master or the intended aux bus is feeding every active destination.',
          'Confirm stream destinations and keys inside vMix without exposing secrets.',
          'Confirm recording settings, file path, and disk space directly in vMix.',
          'Confirm overlays, graphics, countdowns, and score/clock fields are intentional.',
          ...(hasMultipleMixes
            ? ['Confirm explicit Mix targets for any plan that affects a clean feed or secondary output.']
            : []),
          'Generate reviewable API/script plans only; Review Mode does not execute go-live actions.',
        ],
      };
    case 'recovery':
      return {
        id: 'recoveryFlow',
        title: 'Recovery Flow',
        status: 'review',
        items: [
          'Stabilize Program first: confirm what viewers or recorders currently see.',
          'Check Fade to Black, Program input, Preview input, and active overlays.',
          'Check Master and destination audio before changing sources.',
          'Use the preflight blockers and cautions as the immediate triage list.',
          'Prefer a reviewable rollback or recovery plan before executing any mutating action.',
          'Capture before/after XML if possible so vmix_compare_xml_snapshots can explain impact.',
        ],
      };
    case 'endShow':
      return {
        id: 'endShowFlow',
        title: 'End-Show Flow',
        status: 'review',
        items: [
          'Confirm the show is actually over and no downstream destination still needs Program.',
          'Confirm whether streaming should stop before recording, and whether recording needs a safety tail.',
          'Confirm external, fullscreen, NDI, SRT, and hardware outputs can be disabled safely.',
          'Verify the recording file saved and the stream ended on the target platform.',
          'Capture a final state snapshot for post-show review if needed.',
          'Do not expose stream keys, private paths, passwords, or vMix Call URLs in the handoff.',
        ],
      };
  }
}

function buildConfirmationSection(productionSummary: ProductionSummary): ChecklistSection {
  const activeOutputs = productionSummary.outputReadiness.observed.activeOutputs;
  const items = [
    'Operator confirms all blocked and caution checks are resolved, accepted, or intentionally deferred.',
    'Operator confirms Program, Preview, overlays, graphics, audio, and output destinations match the rundown.',
    'Operator confirms any generated script or API sequence has been validated before execution.',
  ];

  if (activeOutputs.length > 0) {
    items.push(`Operator confirms active outputs are intentional: ${activeOutputs.join(', ')}.`);
  }

  return {
    id: 'operatorConfirmations',
    title: 'Operator Confirmations',
    status: productionSummary.preflightReport.status === 'blocked' ? 'blocked' : 'review',
    items,
  };
}

function buildKnownUnknownsSection(preflight: PreflightReport): ChecklistSection {
  return {
    id: 'knownUnknowns',
    title: 'Known Unknowns',
    status: 'review',
    items: preflight.knownUnknowns,
  };
}

function buildNextTestsSection(preflight: PreflightReport): ChecklistSection {
  return {
    id: 'recommendedNextTests',
    title: 'Recommended Next Tests',
    status: 'review',
    items: preflight.recommendedNextTests,
  };
}

function buildHandoff(
  scenario: ChecklistScenario,
  productionSummary: ProductionSummary,
  includePassedChecks: boolean
) {
  const preflight = productionSummary.preflightReport;
  const sections = [
    ...buildPreflightSections(preflight, includePassedChecks),
    buildScenarioSection(scenario, productionSummary),
    buildConfirmationSection(productionSummary),
    buildKnownUnknownsSection(preflight),
    buildNextTestsSection(preflight),
  ];

  return {
    title: scenarioTitle(scenario),
    recommendedDisposition: recommendedDisposition(preflight, scenario),
    sections,
  };
}

export const generateShowChecklistTool = createTool({
  name: 'vmix_generate_show_checklist',
  description:
    'Read-only operator handoff generator. Builds scenario-specific rehearsal, go-live, recovery, or end-show ' +
    'checklists from the current vMix state and preflight report without executing any vMix functions.',
  schema: z.object({
    scenario: ChecklistScenarioSchema.describe(
      'Checklist scenario: rehearsal, goLive, recovery, or endShow. Default: goLive.'
    ),
    includePassedChecks: z
      .boolean()
      .optional()
      .describe('Include passing preflight checks in the handoff. Default: false.'),
  }),
  handler: async (
    {
      scenario = 'goLive',
      includePassedChecks = false,
    }: { scenario?: ChecklistScenario; includePassedChecks?: boolean },
    ctx: ToolContext
  ) => {
    const state = await ctx.state.getState();
    const inputs = state.inputs.map(analyzeInput);
    const productionSummary = buildProductionSummary(state, inputs);
    const preflight = productionSummary.preflightReport;
    const result = {
      mode: 'readOnlyShowChecklist',
      scenario,
      execution: {
        executed: false,
        note: 'This tool reads current state and returns an operator handoff. It never calls vMix functions.',
      },
      source: {
        stateVersion: state.version,
        edition: state.edition,
        inputCount: state.inputs.length,
        programInputNumber: state.active,
        previewInputNumber: state.preview,
        recording: state.recording,
        streaming: state.streaming,
        external: state.external,
        preflightStatus: preflight.status,
        preflightScore: preflight.score,
      },
      preflight: {
        status: preflight.status,
        score: preflight.score,
        summary: preflight.summary,
        blockers: preflight.blockers,
        cautions: preflight.cautions,
      },
      handoff: buildHandoff(scenario, productionSummary, includePassedChecks),
      assumptions: [
        'This checklist is generated from parsed vMix XML and Review Mode analysis only.',
        'Operator intent, actual visual appearance, platform health, and final output destination binding still require human verification.',
        'Review Mode does not execute recording, streaming, switching, output, script, or batch actions.',
      ],
      relatedResources: [
        'vmix://state/live',
        'vmix://state/relationships',
        'vmix://docs/mcp-capabilities',
        'vmix://docs/production-patterns',
      ],
      suggestedFollowups: [
        'Run vmix_diagnose_audio for deeper audio review.',
        'Run vmix_analyze_preset for the full production map and risk inventory.',
        'Use vmix_generate_api_sequence only for reviewable plans, not execution.',
      ],
    };

    return toolJsonContent(result);
  },
});

/**
 * Shared preflight handoff helpers for Review Mode generated artifacts
 */

import type { VmixState } from '../../state/types.js';
import { analyzeInput } from './analysis-helpers.js';
import { buildPreflightReportForState } from './production-summary.js';

type PreflightReport = ReturnType<typeof buildPreflightReportForState>;

export interface AutomationPreflightHandoff {
  status: PreflightReport['status'];
  score: number;
  summary: string;
  executionRecommendation: string;
  blocksExecution: boolean;
  shouldReviewBeforeExecution: boolean;
  blockers: string[];
  cautions: string[];
  requiredOperatorConfirmations: string[];
  recommendedNextTests: string[];
}

export function getAutomationPreflightHandoff(state: VmixState): AutomationPreflightHandoff {
  const preflight = buildPreflightReportForState(state, state.inputs.map(analyzeInput));
  const blocksExecution = preflight.status === 'blocked';
  const shouldReviewBeforeExecution = preflight.status !== 'go';

  return {
    status: preflight.status,
    score: preflight.score,
    summary: preflight.summary,
    executionRecommendation: blocksExecution
      ? 'Do not execute this artifact until blocked preflight checks are resolved or explicitly accepted by the operator.'
      : shouldReviewBeforeExecution
        ? 'Review and accept every caution item before executing this artifact.'
        : 'Preflight is clear from parsed state; normal operator confirmation is still required before execution.',
    blocksExecution,
    shouldReviewBeforeExecution,
    blockers: preflight.blockers,
    cautions: preflight.cautions,
    requiredOperatorConfirmations: [
      ...preflight.operatorChecklist.slice(0, 6),
      'Confirm this generated artifact still matches the current rundown and live state immediately before execution.',
    ],
    recommendedNextTests: preflight.recommendedNextTests,
  };
}

export function buildPreflightIssueMessages(
  handoff: AutomationPreflightHandoff,
  artifactLabel: string
): Array<{ severity: 'error' | 'warning' | 'info'; message: string; detail: string }> {
  if (handoff.status === 'blocked') {
    return [
      {
        severity: 'warning',
        message: `Preflight is blocked before ${artifactLabel} execution.`,
        detail: handoff.blockers.join(' | ') || handoff.summary,
      },
    ];
  }

  if (handoff.status === 'caution') {
    return [
      {
        severity: 'warning',
        message: `Preflight has caution items before ${artifactLabel} execution.`,
        detail: handoff.cautions.join(' | ') || handoff.summary,
      },
    ];
  }

  return [
    {
      severity: 'info',
      message: `Preflight status is go for ${artifactLabel} review.`,
      detail: handoff.summary,
    },
  ];
}

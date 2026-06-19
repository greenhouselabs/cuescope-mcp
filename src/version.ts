/**
 * Public server version.
 *
 * Keep this value in sync with package.json for releases.
 */
import { BUILD_SHA } from './generated/build-info.js';

export const SERVER_VERSION = '1.0.2';

export const SERVER_PACKAGE_NAME = '@greenhouselabs/cuescope-mcp';

export const SERVER_RUNTIME_NAME = 'cuescope-mcp';

export const SERVER_PRODUCT_NAME = 'CueScope';

export const SERVER_DESCRIPTION =
  'Read-first production intelligence, diagnostics, and reviewable automation planning for workflows compatible with vMix';

// Version plus the git short SHA the build was stamped from (e.g. "1.0.0+6463377").
// BUILD_SHA is auto-generated at build time; see scripts/gen-build-info.mjs.
export const SERVER_BUILD_MARKER = `${SERVER_VERSION}+${BUILD_SHA}`;

export type ServerMode = 'review' | 'control' | 'highImpactControl';

export interface ServerModeInfo {
  mode: ServerMode;
  label: 'Review Mode' | 'Control Mode' | 'High-Impact Control';
  mutatesVmixByDefault: boolean;
  summary: string;
}

export function getServerModeInfo(
  operatorMode: boolean,
  dangerousMode = false
): ServerModeInfo {
  if (operatorMode && dangerousMode) {
    return {
      mode: 'highImpactControl',
      label: 'High-Impact Control',
      mutatesVmixByDefault: false,
      summary:
        'Full opt-in control surface. High-impact tools are visible, but individual actions still require explicit user intent.',
    };
  }

  if (operatorMode) {
    return {
      mode: 'control',
      label: 'Control Mode',
      mutatesVmixByDefault: false,
      summary:
        'Opt-in safer live-control surface. High-impact actions remain hidden until High-Impact Control is enabled.',
    };
  }

  return {
    mode: 'review',
    label: 'Review Mode',
    mutatesVmixByDefault: false,
    summary:
      'Default read-only review surface. CueScope inspects, diagnoses, validates, and generates reviewable artifacts without changing vMix.',
  };
}

export const SERVER_FEATURES = {
  liveFirstInputInspectionTool: true,
  savedPresetTitleMetadata: true,
  savedPresetNestedTitleDataSources: true,
  savedPresetTargetInputReferences: true,
  findInputTruncationMetadata: true,
  analyzePresetDetailModes: ['summary', 'full'],
  analyzePresetSummaryInputIndexLimit: 20,
  explainInputBusPeerLimit: 10,
  explainInputProductionRisks: true,
  serverVersionTool: true,
  audioTitleRolePriority: true,
  audioDiagnosticsParkedInputInfo: true,
  multiProgramLabelWatcher: true,
  programInputTitleWatcher: true,
  copySafeProgramWatcherScript: true,
  productionAudioWorkflowKnowledge: true,
  productionTroubleshootingKnowledge: true,
  troubleshootingSkillGuidance: true,
  troubleshootingCorpusExamples: true,
  diagnoseLogsTool: true,
  stateAwareTroubleshootingHandoff: true,
  desktopInstallSmokeDocs: true,
  firstRunVersionSmokeDocs: true,
  mixMinusSharedBusGuidance: true,
  savedPresetCallReturnMetadata: true,
  readPresetFileDetailModes: ['summary', 'full'],
  naturalLanguageShowReviewTool: true,
  showReviewPresetAuditSummary: true,
  outputReadinessDiagnosticTool: true,
  showReviewOutputReadinessSummary: true,
  showReviewSeverityPresentationGuidance: true,
  pairedAudioCallerReturnGuard: true,
  productionScriptValidatorWarnings: true,
  productionScriptGeneratorReviewNotes: true,
  videoCallAudioSourceBusWarning: true,
  presetScriptSetReview: true,
  pollingLoopChurnWarning: true,
  scriptSetRowMapReview: true,
  slotLowerThirdGenerator: true,
  talkbackReturnGenerator: true,
  layoutCleanupGenerator: true,
  setLayerValueValidation: true,
  layoutMutationReviewWarnings: true,
  dataSourceRowMapValidation: true,
  talkbackPairSharedBusReview: true,
  preflightOfflinePlaceholderWarning: true,
} as const;

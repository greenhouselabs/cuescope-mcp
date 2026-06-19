/**
 * Tests for vmix_server_version
 */

import { describe, expect, it } from 'vitest';
import { serverVersionTool } from '../../../../src/tools/brain/server-version.js';
import {
  SERVER_BUILD_MARKER,
  SERVER_FEATURES,
  SERVER_PACKAGE_NAME,
  SERVER_PRODUCT_NAME,
  SERVER_RUNTIME_NAME,
  SERVER_VERSION,
} from '../../../../src/version.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

const REVIEW_TOOL_NAMES = [
  'vmix_server_version',
  'vmix_show_review',
  'vmix_analyze_preset',
  'vmix_generate_show_checklist',
  'vmix_find_input',
  'vmix_inspect_input',
  'vmix_explain_input',
  'vmix_diagnose_audio',
  'vmix_diagnose_outputs',
  'vmix_generate_script',
  'vmix_validate_script',
  'vmix_generate_api_sequence',
  'vmix_compare_xml_snapshots',
  'vmix_read_preset_file',
  'vmix_explain_preset_scripts',
  'vmix_audit_preset_file',
  'vmix_preflight',
  'vmix_diagnose_logs',
  'vmix_connection_test',
] as const;

describe('vmix_server_version', () => {
  it('has the expected tool name', () => {
    expect(serverVersionTool.name).toBe('vmix_server_version');
  });

  it('reports server version, feature flags, runtime health, and vMix version', async () => {
    const ctx = createMockToolContext();
    const result = await serverVersionTool.handler({}, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    expect(data.server).toMatchObject({
      name: SERVER_RUNTIME_NAME,
      version: SERVER_VERSION,
      buildMarker: SERVER_BUILD_MARKER,
      productName: SERVER_PRODUCT_NAME,
      packageName: SERVER_PACKAGE_NAME,
      mode: 'review',
      modeLabel: 'Review Mode',
      highImpactMode: false,
      features: SERVER_FEATURES,
    });
    expect(data.server.features.liveFirstInputInspectionTool).toBe(true);
    expect(data.server.features.savedPresetTitleMetadata).toBe(true);
    expect(data.server.features.savedPresetNestedTitleDataSources).toBe(true);
    expect(data.server.features.savedPresetTargetInputReferences).toBe(true);
    expect(data.server.features.serverVersionTool).toBe(true);
    expect(data.server.features.stateAwareTroubleshootingHandoff).toBe(true);
    expect(data.server.features.desktopInstallSmokeDocs).toBe(true);
    expect(data.server.features.firstRunVersionSmokeDocs).toBe(true);
    expect(data.server.features.mixMinusSharedBusGuidance).toBe(true);
    expect(data.server.features.savedPresetCallReturnMetadata).toBe(true);
    expect(data.server.features.readPresetFileDetailModes).toEqual(['summary', 'full']);
    expect(data.server.features.naturalLanguageShowReviewTool).toBe(true);
    expect(data.server.features.showReviewPresetAuditSummary).toBe(true);
    expect(data.server.features.outputReadinessDiagnosticTool).toBe(true);
    expect(data.server.features.showReviewOutputReadinessSummary).toBe(true);
    expect(data.server.features.showReviewSeverityPresentationGuidance).toBe(true);
    expect(['current', 'restart-recommended', 'build-recommended']).toContain(
      data.runtimeBuildCheck.health
    );
    expect(typeof data.runtimeBuildCheck.recommendations.buildRecommended).toBe('boolean');
    expect(typeof data.runtimeBuildCheck.recommendations.restartRecommended).toBe('boolean');
    expect(data.vmix).toMatchObject({
      connected: true,
      version: '29.0.0.0',
      edition: '4K Plus',
    });
    expect(data.vmix.currentInputQuestionGuidance).toContain('vmix_inspect_input');
    expect(data.capabilities).toMatchObject({
      tools: 19,
      reviewTools: 19,
      controlToolsAvailable: 117,
      controlSafeToolsAvailable: 91,
      highImpactToolsAvailable: 26,
      totalKnownTools: 136,
    });
    expect(data.capabilities.activeToolNames).toEqual(REVIEW_TOOL_NAMES);
    expect(data.capabilities.reviewToolNames).toEqual(REVIEW_TOOL_NAMES);
    expect(data.relatedResources.version).toBe('vmix://server/version');
    expect(data.relatedResources.status).toBe('vmix://server/status');
  });
});

/**
 * Tests for vmix://server/status resource
 */

import { describe, expect, it } from 'vitest';
import { serverStatusResource } from '../../../src/resources/server-status.js';
import { createMockStateCache } from '../../mocks/tool-context.mock.js';
import { createMockVmixClient } from '../../mocks/vmix-client.mock.js';
import { createTestConfig } from '../../../src/config/index.js';
import {
  SERVER_BUILD_MARKER,
  SERVER_PACKAGE_NAME,
  SERVER_PRODUCT_NAME,
  SERVER_RUNTIME_NAME,
  SERVER_VERSION,
} from '../../../src/version.js';
import type { ResourceContext } from '../../../src/resources/base.js';

const REVIEW_TOOL_NAMES = [
  'vmix_server_version',
  'vmix_show_review',
  'vmix_analyze_preset',
  'vmix_generate_show_checklist',
  'vmix_find_input',
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

function createContext(operatorMode: boolean, dangerousMode = false): ResourceContext {
  return {
    state: createMockStateCache(),
    vmix: createMockVmixClient(),
    config: createTestConfig({
      VMIX_CONTROL_MODE: operatorMode,
      VMIX_HIGH_IMPACT: dangerousMode,
    }),
  };
}

describe('vmix://server/status', () => {
  it('has correct URI', () => {
    expect(serverStatusResource.uri).toBe('vmix://server/status');
  });

  it('reports review mode by default', async () => {
    const result = await serverStatusResource.handler(createContext(false));
    const data = JSON.parse(result.contents[0]?.text ?? '{}');

    expect(data.mode).toBe('review');
    expect(data.modeLabel).toBe('Review Mode');
    expect(data.server).toMatchObject({
      name: SERVER_RUNTIME_NAME,
      productName: SERVER_PRODUCT_NAME,
      packageName: SERVER_PACKAGE_NAME,
      version: SERVER_VERSION,
      buildMarker: SERVER_BUILD_MARKER,
      versionResource: 'vmix://server/version',
    });
    expect(['current', 'restart-recommended', 'build-recommended']).toContain(
      data.server.runtimeHealth
    );
    expect(typeof data.server.buildRecommended).toBe('boolean');
    expect(typeof data.server.restartRecommended).toBe('boolean');
    expect(data.controlMode).toBe(false);
    expect(data.highImpactMode).toBe(false);
    expect(data.tools.active).toBe(18);
    expect(data.tools.activeNames).toEqual(REVIEW_TOOL_NAMES);
    expect(data.tools.review).toBe(18);
    expect(data.tools.reviewNames).toEqual(REVIEW_TOOL_NAMES);
    expect(data.tools.controlAvailable).toBe(117);
    expect(data.tools.controlSafeAvailable).toBe(91);
    expect(data.tools.highImpactAvailable).toBe(26);
    expect(data.resources.active).toBe(21);
    expect(data.prompts.active).toBe(7);
    expect(data.safety.mutatesVmixByDefault).toBe(false);
    expect(data.safety.rawHttpBypassAllowedInReviewMode).toBe(false);
    expect(data.safety.scriptGenerationExecutes).toBe(false);
    expect(data.safety.scriptExecutionToolsActive).toBe(false);
    expect(data.safety.controlModeFlag).toBe('VMIX_CONTROL_MODE=true');
    expect(data.safety.highImpactModeFlag).toBe('VMIX_HIGH_IMPACT=true');
    expect(data.safety.modeSwitchRequiresRestart).toBe(true);
    expect(data.safety.reviewModeGuidance).toContain('Do not provide or echo raw vMix HTTP URLs');
    expect(data.safety.reviewModeGuidance).toContain('even as negative examples');
    expect(data.safety.reviewModeRefusalPolicy.appliesTo).toContain('streaming');
    expect(data.safety.reviewModeRefusalPolicy.prohibitedSuggestions.join('\n')).toContain('curl');
    expect(data.safety.reviewModeRefusalPolicy.prohibitedSuggestions.join('\n')).toContain('printing the literal bypass URL');
    expect(data.safety.reviewModeRefusalPolicy.allowedAlternatives.join('\n')).toContain('read current state resources');
    expect(data.safety.modeSetup.review.env).toEqual({});
    expect(data.safety.modeSetup.control.env).toEqual({ VMIX_CONTROL_MODE: 'true' });
    expect(data.safety.modeSetup.highImpactControl.env).toEqual({
      VMIX_CONTROL_MODE: 'true',
      VMIX_HIGH_IMPACT: 'true',
    });
    expect(data.safety.executionBoundary.reviewMode.canExecuteScripts).toBe(false);
    expect(data.safety.executionBoundary.reviewMode.canCallVmixFunctions).toBe(false);
    expect(data.safety.executionBoundary.reviewMode.rawHttpBypassAllowed).toBe(false);
    expect(data.safety.executionBoundary.controlMode.requiresExplicitOptIn).toBe(true);
    expect(data.safety.executionBoundary.controlMode.highImpactToolsActive).toBe(false);
    expect(data.safety.executionBoundary.highImpactControlTools.active).toBe(false);
    expect(data.safety.executionBoundary.highImpactControlTools.categories).toContain('streaming');
    expect(data.safety.executionBoundary.scriptExecutionTools).toContain('vmix_script_run');
  });

  it('reports Control Mode when enabled without High-Impact Control', async () => {
    const result = await serverStatusResource.handler(createContext(true));
    const data = JSON.parse(result.contents[0]?.text ?? '{}');

    expect(data.mode).toBe('control');
    expect(data.modeLabel).toBe('Control Mode');
    expect(data.controlMode).toBe(true);
    expect(data.highImpactMode).toBe(false);
    expect(data.tools.active).toBe(109);
    expect(data.tools.review).toBe(18);
    expect(data.tools.controlAvailable).toBe(117);
    expect(data.safety.scriptExecutionToolsActive).toBe(false);
    expect(data.safety.executionBoundary.controlMode.canExecuteScripts).toBe(false);
    expect(data.safety.executionBoundary.controlMode.canCallVmixFunctions).toBe(true);
  });

  it('reports High-Impact Control when the second opt-in is enabled', async () => {
    const result = await serverStatusResource.handler(createContext(true, true));
    const data = JSON.parse(result.contents[0]?.text ?? '{}');

    expect(data.mode).toBe('highImpactControl');
    expect(data.modeLabel).toBe('High-Impact Control');
    expect(data.controlMode).toBe(true);
    expect(data.highImpactMode).toBe(true);
    expect(data.tools.active).toBe(135);
    expect(data.safety.scriptExecutionToolsActive).toBe(true);
    expect(data.safety.executionBoundary.controlMode.canExecuteScripts).toBe(true);
    expect(data.safety.executionBoundary.controlMode.highImpactToolsActive).toBe(true);
    expect(data.safety.executionBoundary.highImpactControlTools.active).toBe(true);
  });
});

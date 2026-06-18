/**
 * Tests for vmix://server/version resource
 */

import { describe, expect, it } from 'vitest';
import { versionResource } from '../../../src/resources/version.js';
import { createMockStateCache } from '../../mocks/tool-context.mock.js';
import { createMockVmixClient } from '../../mocks/vmix-client.mock.js';
import { createTestConfig } from '../../../src/config/index.js';
import {
  SERVER_BUILD_MARKER,
  SERVER_FEATURES,
  SERVER_PACKAGE_NAME,
  SERVER_PRODUCT_NAME,
  SERVER_RUNTIME_NAME,
  SERVER_VERSION,
} from '../../../src/version.js';
import type { ResourceContext } from '../../../src/resources/base.js';

function createContext(): ResourceContext {
  return {
    state: createMockStateCache(),
    vmix: createMockVmixClient(),
    config: createTestConfig(),
  };
}

describe('vmix://server/version', () => {
  it('has correct URI', () => {
    expect(versionResource.uri).toBe('vmix://server/version');
  });

  it('reports server feature markers and runtime build health', async () => {
    const result = await versionResource.handler(createContext());
    const data = JSON.parse(result.contents[0]?.text ?? '{}');

    expect(data.server).toMatchObject({
      name: SERVER_RUNTIME_NAME,
      version: SERVER_VERSION,
      buildMarker: SERVER_BUILD_MARKER,
      productName: SERVER_PRODUCT_NAME,
      packageName: SERVER_PACKAGE_NAME,
      mode: 'review',
      modeLabel: 'Review Mode',
      features: SERVER_FEATURES,
    });
    expect(data.server.features.analyzePresetSummaryInputIndexLimit).toBe(20);
    expect(data.vmix.connected).toBe(true);
    expect(data.vmix.version).toBe('29.0.0.0');
    expect(['current', 'restart-recommended', 'build-recommended']).toContain(
      data.runtimeBuildCheck.health
    );
    expect(typeof data.runtimeBuildCheck.recommendations.buildRecommended).toBe('boolean');
    expect(typeof data.runtimeBuildCheck.recommendations.restartRecommended).toBe('boolean');
    expect(data.runtimeBuildCheck.recommendations.message).toEqual(expect.any(String));
    expect(data.runtimeBuildCheck.runtime.pid).toEqual(expect.any(Number));
    expect(data.runtimeBuildCheck.runtime.startedAt).toEqual(expect.any(String));
    expect(data.runtimeBuildCheck.files.newestSource.relativePath).toEqual(expect.any(String));
    expect(data.runtimeBuildCheck.files.newestBuild).toHaveProperty('relativePath');
    expect(data.runtimeBuildCheck.checks).toHaveProperty('buildMissing');
  });
});

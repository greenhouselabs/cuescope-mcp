/**
 * Version resource - Exposes server and vMix version information
 */

import { createResource, jsonContent, type ResourceContext } from './base.js';
import { getToolStats, getToolsForMode } from '../tools/index.js';
import { getResourceCount } from './stats.js';
import {
  getServerModeInfo,
  SERVER_BUILD_MARKER,
  SERVER_DESCRIPTION,
  SERVER_FEATURES,
  SERVER_PACKAGE_NAME,
  SERVER_PRODUCT_NAME,
  SERVER_RUNTIME_NAME,
  SERVER_VERSION,
} from '../version.js';
import { getRuntimeBuildCheck } from '../utils/runtime-build-check.js';

export { SERVER_BUILD_MARKER, SERVER_FEATURES, SERVER_VERSION };

export const versionResource = createResource({
  name: 'Server Version',
  uri: 'vmix://server/version',
  mimeType: 'application/json',
  description:
    'Server and vMix version information. Shows MCP server version, tool count, ' +
    'active safety mode, vMix connection status, and vMix version if connected.',
  handler: async (ctx: ResourceContext) => {
    let vmixVersion: string | null = null;
    let vmixEdition: string | null = null;
    let vmixConnected = false;

    try {
      // Try to get vMix version from state
      const state = await ctx.state.getState();
      vmixConnected = true;
      vmixVersion = state.version || null;
      vmixEdition = state.edition || null;
    } catch {
      // vMix not connected
      vmixConnected = false;
    }

    const modeInfo = getServerModeInfo(
      ctx.config.VMIX_CONTROL_MODE,
      ctx.config.VMIX_HIGH_IMPACT
    );

    const versionInfo = {
      server: {
        name: SERVER_RUNTIME_NAME,
        version: SERVER_VERSION,
        buildMarker: SERVER_BUILD_MARKER,
        productName: SERVER_PRODUCT_NAME,
        packageName: SERVER_PACKAGE_NAME,
        description: SERVER_DESCRIPTION,
        mode: modeInfo.mode,
        modeLabel: modeInfo.label,
        highImpactMode: ctx.config.VMIX_HIGH_IMPACT,
        features: SERVER_FEATURES,
      },
      runtimeBuildCheck: getRuntimeBuildCheck(),
      vmix: {
        connected: vmixConnected,
        version: vmixVersion,
        edition: vmixEdition,
        host: ctx.config.VMIX_HOST,
        httpPort: ctx.config.VMIX_HTTP_PORT,
      },
      capabilities: {
        tools: getToolsForMode(
          ctx.config.VMIX_CONTROL_MODE,
          ctx.config.VMIX_HIGH_IMPACT
        ).length,
        reviewTools: getToolStats().brain,
        controlToolsAvailable: getToolStats().operator,
        controlSafeToolsAvailable: getToolStats().operatorSafe,
        highImpactToolsAvailable: getToolStats().operatorDangerous,
        totalKnownTools: getToolStats().total,
        resources: getResourceCount(),
        tcpEnabled: ctx.config.TCP_ENABLED,
      },
    };

    return {
      contents: [jsonContent('vmix://server/version', versionInfo)],
    };
  },
});

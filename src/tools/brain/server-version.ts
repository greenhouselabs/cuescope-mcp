/**
 * vmix_server_version - Read-only server/runtime version check
 */

import { z } from 'zod';
import { createTool, toolJsonContent, type ToolContext } from '../base.js';
import {
  getServerModeInfo,
  SERVER_BUILD_MARKER,
  SERVER_FEATURES,
  SERVER_PACKAGE_NAME,
  SERVER_PRODUCT_NAME,
  SERVER_RUNTIME_NAME,
  SERVER_VERSION,
} from '../../version.js';
import { getRuntimeBuildCheck } from '../../utils/runtime-build-check.js';

async function buildServerVersionInfo(ctx: ToolContext) {
  let vmixVersion: string | null = null;
  let vmixEdition: string | null = null;
  let vmixConnected = false;
  const { getToolStats, getToolsForMode } = await import('../index.js');
  const toolStats = getToolStats();
  const activeTools = getToolsForMode(
    ctx.config.VMIX_CONTROL_MODE,
    ctx.config.VMIX_HIGH_IMPACT
  );
  const reviewTools = getToolsForMode(false, false);
  const modeInfo = getServerModeInfo(
    ctx.config.VMIX_CONTROL_MODE,
    ctx.config.VMIX_HIGH_IMPACT
  );

  try {
    const state = await ctx.state.getState();
    vmixConnected = true;
    vmixVersion = state.version || null;
    vmixEdition = state.edition || null;
  } catch {
    vmixConnected = false;
  }

  return {
    server: {
      name: SERVER_RUNTIME_NAME,
      version: SERVER_VERSION,
      buildMarker: SERVER_BUILD_MARKER,
      productName: SERVER_PRODUCT_NAME,
      packageName: SERVER_PACKAGE_NAME,
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
    },
    capabilities: {
      tools: activeTools.length,
      activeToolNames: activeTools.map((tool) => tool.name),
      reviewTools: toolStats.brain,
      reviewToolNames: reviewTools.map((tool) => tool.name),
      controlToolsAvailable: toolStats.operator,
      controlSafeToolsAvailable: toolStats.operatorSafe,
      highImpactToolsAvailable: toolStats.operatorDangerous,
      totalKnownTools: toolStats.total,
    },
    relatedResources: {
      version: 'vmix://server/version',
      status: 'vmix://server/status',
    },
  };
}

export const serverVersionTool = createTool({
  name: 'vmix_server_version',
  description:
    'Read-only MCP server version and runtime build check. Use this after rebuilds/restarts to confirm the active server build marker and feature flags.',
  schema: z.object({}),
  handler: async (_params: Record<string, never>, ctx: ToolContext) => {
    return toolJsonContent(await buildServerVersionInfo(ctx));
  },
});

/**
 * Tool registry and exports
 * Central location for all MCP tools
 * @module tools
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  registerTools,
  type ToolContext,
  type AnyToolDefinition,
} from './base.js';

// Re-export base types and helpers
export {
  createTool,
  successResult,
  errorResult,
  withErrorHandling,
  registerTool,
  registerTools,
  type ToolContext,
  type ToolResult,
  type ToolDefinition,
  type AnyToolDefinition,
  type ToolCategory,
  type ToolMetadata,
} from './base.js';

// Import tool domains
import { brainToolDefinitions } from './brain/index.js';
import { switchingTools } from './switching/index.js';
import { audioTools } from './audio/index.js';
import { graphicsTools } from './graphics/index.js';
import { overlayTools } from './overlays/index.js';
import { recordingTools } from './recording/index.js';
import { inputTools } from './input/index.js';
import { scriptingTools } from './scripting/index.js';
import { batchTools } from './batch/index.js';
import { layerTools } from './layers/index.js';
import { browserTools } from './browser/index.js';
import { videocallTools } from './videocall/index.js';
import { ndiTools } from './ndi/index.js';
import { ptzTools } from './ptz/index.js';
import { playlistTools } from './playlist/index.js';
import { outputTools } from './output/index.js';
import { colorCorrectionTools } from './colorcorrection/index.js';
import { effectsTools } from './effects/index.js';
import { replayTools } from './replay/index.js';
import { datasourceTools } from './datasource/index.js';
import { presetTools } from './preset/index.js';
import { showTools } from './show/index.js';
import { getServerModeInfo } from '../version.js';

export const dangerousOperatorToolNames = [
  'vmix_batch',
  'vmix_input_add',
  'vmix_input_move',
  'vmix_input_properties',
  'vmix_input_remove',
  'vmix_input_rename',
  'vmix_input_reset',
  'vmix_ndi_recording',
  'vmix_output_external',
  'vmix_output_fullscreen',
  'vmix_output_set',
  'vmix_preset_last',
  'vmix_preset_open',
  'vmix_preset_save',
  'vmix_record',
  'vmix_replay_record',
  'vmix_script_generate',
  'vmix_script_run',
  'vmix_script_run_file',
  'vmix_script_save',
  'vmix_script_stop',
  'vmix_show_build',
  'vmix_participant_add',
  'vmix_multiview_create',
  'vmix_snapshot',
  'vmix_stream',
] as const;

const dangerousOperatorToolNameSet = new Set<string>(dangerousOperatorToolNames);

/**
 * Default read-only/advisory tools.
 *
 * Phase 3 added the Review Mode tools here. Keep the current
 * control-oriented tool surface out of default mode.
 */
export const brainTools: AnyToolDefinition[] = [
  ...brainToolDefinitions,
];

/**
 * Existing vMix control tools.
 *
 * These are preserved for future opt-in Control Mode and are intentionally
 * hidden by default.
 */
export const operatorTools: AnyToolDefinition[] = [
  ...switchingTools,
  ...audioTools,
  ...graphicsTools,
  ...overlayTools,
  ...recordingTools,
  ...inputTools,
  ...scriptingTools,
  ...batchTools,
  ...layerTools,
  ...browserTools,
  ...videocallTools,
  ...ndiTools,
  ...ptzTools,
  ...playlistTools,
  ...outputTools,
  ...colorCorrectionTools,
  ...effectsTools,
  ...replayTools,
  ...datasourceTools,
  ...presetTools,
  ...showTools,
];

export const dangerousOperatorTools: AnyToolDefinition[] = operatorTools.filter((tool) =>
  dangerousOperatorToolNameSet.has(tool.name)
);

export const safeOperatorTools: AnyToolDefinition[] = operatorTools.filter(
  (tool) => !dangerousOperatorToolNameSet.has(tool.name)
);

/**
 * All known tools across all modes
 */
export const allTools: AnyToolDefinition[] = [
  ...brainTools,
  ...operatorTools,
];

/**
 * Get the active tool surface for the current config mode
 *
 * Review Mode deliberately exposes no mutating tools. MCP clients should not
 * work around this by issuing raw vMix HTTP/curl/shell commands for gated
 * actions; use explicit Control/High-Impact Control opt-ins instead.
 */
export function getToolsForMode(
  operatorMode: boolean,
  dangerousMode = false
): AnyToolDefinition[] {
  if (!operatorMode) return brainTools;
  return dangerousMode
    ? [...brainTools, ...operatorTools]
    : [...brainTools, ...safeOperatorTools];
}

/**
 * Register all tools on the MCP server
 */
export function registerAllTools(server: McpServer, ctx: ToolContext): void {
  const tools = getToolsForMode(
    ctx.config.VMIX_CONTROL_MODE,
    ctx.config.VMIX_HIGH_IMPACT
  );
  registerTools(server, tools, ctx);
  const modeLabel = getServerModeInfo(
    ctx.config.VMIX_CONTROL_MODE,
    ctx.config.VMIX_HIGH_IMPACT
  ).label;
  console.error(`Registered ${tools.length} tools (${modeLabel})`);
}

/**
 * Get tool count by category
 */
export function getToolStats(): Record<string, number> {
  return {
    switching: switchingTools.length,
    audio: audioTools.length,
    graphics: graphicsTools.length,
    overlays: overlayTools.length,
    recording: recordingTools.length,
    input: inputTools.length,
    scripting: scriptingTools.length,
    batch: batchTools.length,
    layers: layerTools.length,
    browser: browserTools.length,
    videocall: videocallTools.length,
    ndi: ndiTools.length,
    ptz: ptzTools.length,
    playlist: playlistTools.length,
    output: outputTools.length,
    colorCorrection: colorCorrectionTools.length,
    effects: effectsTools.length,
    replay: replayTools.length,
    datasource: datasourceTools.length,
    preset: presetTools.length,
    show: showTools.length,
    brain: brainTools.length,
    operator: operatorTools.length,
    operatorSafe: safeOperatorTools.length,
    operatorDangerous: dangerousOperatorTools.length,
    total: allTools.length,
  };
}

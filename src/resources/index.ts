/**
 * Resource registry and exports
 * Central location for all MCP resources
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  registerResources,
  type ResourceContext,
  type ResourceDefinition,
} from './base.js';
import { createLogger } from '../utils/logger.js';

// Re-export base types and helpers
export {
  createResource,
  registerResource,
  registerResources,
  jsonContent,
  xmlContent,
  textContent,
  markdownContent,
  type ResourceContext,
  type ResourceResult,
  type ResourceContent,
  type ResourceDefinition,
} from './base.js';

// Import resources
import { stateSummaryResource } from './state-summary.js';
import { stateLiveResource } from './state-live.js';
import { stateRelationshipsResource } from './state-relationships.js';
import { stateFullResource } from './state-full.js';
import { inputsResource } from './inputs.js';
import { inputsFieldsResource } from './inputs-fields.js';
import { audioResource } from './audio.js';
import { scriptContextResource } from './script-context.js';
import { skillsResource } from './skills.js';
import { versionResource } from './version.js';
import { copilotContextResource } from './copilot-context.js';
import { tallyResource } from './tally.js';
import { serverStatusResource } from './server-status.js';
import { docsResources } from './docs.js';

// Export individual resources
export { stateSummaryResource } from './state-summary.js';
export { stateLiveResource } from './state-live.js';
export { stateRelationshipsResource } from './state-relationships.js';
export { stateFullResource } from './state-full.js';
export { inputsResource } from './inputs.js';
export { inputsFieldsResource } from './inputs-fields.js';
export { audioResource } from './audio.js';
export { scriptContextResource, buildScriptContext } from './script-context.js';
export { skillsResource } from './skills.js';
export { versionResource, SERVER_VERSION } from './version.js';
export { copilotContextResource } from './copilot-context.js';
export { tallyResource } from './tally.js';
export { serverStatusResource } from './server-status.js';
export {
  docsIndexResource,
  mcpCapabilitiesDocsResource,
  apiDocsResource,
  scriptingDocsResource,
  audioRoutingDocsResource,
  productionPatternsDocsResource,
  forumPatternsDocsResource,
  examplesDocsResource,
  docsResources,
} from './docs.js';

/**
 * All available resources
 */
export const allResources: ResourceDefinition[] = [
  versionResource,
  serverStatusResource,
  stateSummaryResource,
  stateLiveResource,
  stateRelationshipsResource,
  stateFullResource,
  inputsResource,
  inputsFieldsResource,
  audioResource,
  scriptContextResource,
  skillsResource,
  copilotContextResource,
  tallyResource,
  ...docsResources,
];

/**
 * Get resource count metadata
 */
export function getResourceStats(): Record<string, number> {
  return {
    total: allResources.length,
  };
}

/**
 * Register all resources on the MCP server
 */
export function registerAllResources(server: McpServer, ctx: ResourceContext): void {
  registerResources(server, allResources, ctx);
  const logger = createLogger({ level: ctx.config.LOG_LEVEL, prefix: 'resources' });
  logger.info(`Registered ${allResources.length} resources`);
}

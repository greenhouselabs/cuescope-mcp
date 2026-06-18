/**
 * Resource framework base types and helpers
 * Provides consistent patterns for defining MCP resources
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IStateCache } from '../state/types.js';
import type { IVmixClient } from '../clients/types.js';
import type { Config } from '../config/index.js';

/**
 * Context provided to all resource handlers
 */
export interface ResourceContext {
  /** State cache for reading vMix state */
  state: IStateCache;
  /** vMix client for raw XML access */
  vmix: IVmixClient;
  /** Server configuration */
  config: Config;
}

/**
 * Resource content item
 */
export interface ResourceContent {
  uri: string;
  mimeType: string;
  text: string;
  /** Allow additional properties for MCP SDK compatibility */
  [key: string]: unknown;
}

/**
 * Result returned by resource handlers
 */
export interface ResourceResult {
  contents: ResourceContent[];
  /** Allow additional properties for MCP SDK compatibility */
  [key: string]: unknown;
}

/**
 * Resource definition
 */
export interface ResourceDefinition {
  /** Short, stable MCP resource name (e.g., "vMix State Summary") */
  name: string;
  /** Optional display title; defaults to the name */
  title?: string;
  /** Resource URI (e.g., "vmix://state/summary") */
  uri: string;
  /** Human-readable description */
  description: string;
  /** MIME type of the resource content (e.g., "application/json") */
  mimeType: string;
  /** Handler function */
  handler: (ctx: ResourceContext) => Promise<ResourceResult>;
}

/**
 * Create a resource definition
 */
export function createResource(definition: ResourceDefinition): ResourceDefinition {
  return definition;
}

/**
 * Register a resource on the MCP server
 *
 * Uses the non-deprecated `registerResource` overload so resources/list
 * advertises the short name, title, description, and mimeType.
 */
export function registerResource(
  server: McpServer,
  resource: ResourceDefinition,
  ctx: ResourceContext
): void {
  server.registerResource(
    resource.name,
    resource.uri,
    {
      title: resource.title ?? resource.name,
      description: resource.description,
      mimeType: resource.mimeType,
    },
    async () => {
      return resource.handler(ctx);
    }
  );
}

/**
 * Register multiple resources at once
 */
export function registerResources(
  server: McpServer,
  resources: ResourceDefinition[],
  ctx: ResourceContext
): void {
  for (const resource of resources) {
    registerResource(server, resource, ctx);
  }
}

/**
 * Helper to create JSON resource content
 */
export function jsonContent(uri: string, data: unknown): ResourceContent {
  return {
    uri,
    mimeType: 'application/json',
    text: JSON.stringify(data),
  };
}

/**
 * Helper to create XML resource content
 */
export function xmlContent(uri: string, xml: string): ResourceContent {
  return {
    uri,
    mimeType: 'application/xml',
    text: xml,
  };
}

/**
 * Helper to create text resource content
 */
export function textContent(uri: string, text: string): ResourceContent {
  return {
    uri,
    mimeType: 'text/plain',
    text,
  };
}

/**
 * Helper to create markdown resource content
 */
export function markdownContent(uri: string, markdown: string): ResourceContent {
  return {
    uri,
    mimeType: 'text/markdown',
    text: markdown,
  };
}

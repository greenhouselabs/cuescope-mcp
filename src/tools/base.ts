/**
 * Tool framework base types and helpers
 * Provides consistent patterns for defining MCP tools
 */

import { z, ZodSchema, ZodObject, ZodRawShape } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IVmixClient } from '../clients/types.js';
import type { IStateCache } from '../state/types.js';
import type { Config } from '../config/index.js';
import { formatErrorMessage } from '../errors/index.js';

/**
 * Context provided to all tool handlers
 * Uses interfaces for dependency injection
 */
export interface ToolContext {
  /** vMix client for executing commands */
  vmix: IVmixClient;
  /** State cache for reading vMix state */
  state: IStateCache;
  /** Server configuration */
  config: Config;
}

/**
 * Result returned by tool handlers
 * Matches MCP SDK CallToolResult structure
 */
export interface ToolResult {
  /** Content to return to the MCP client */
  content: Array<{ type: 'text'; text: string }>;
  /** Whether this result represents an error */
  isError?: boolean;
  /** Allow additional properties for MCP SDK compatibility */
  [key: string]: unknown;
}

/**
 * Tool definition with typed schema
 */
export interface ToolDefinition<TSchema extends ZodObject<ZodRawShape> = ZodObject<ZodRawShape>> {
  /** Tool name (e.g., "vmix_switch_cut") */
  name: string;
  /** Human-readable description */
  description: string;
  /** Zod schema for parameters */
  schema: TSchema;
  /** Handler function */
  handler: (params: z.infer<TSchema>, ctx: ToolContext) => Promise<ToolResult>;
}

/**
 * Any tool definition - used for arrays of mixed tool types
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolDefinition = ToolDefinition<any>;

/**
 * Create a tool definition with type inference
 *
 * @example
 * ```ts
 * const cutTool = createTool({
 *   name: "vmix_switch_cut",
 *   description: "Cut to an input",
 *   schema: z.object({ input: InputReferenceSchema }),
 *   handler: async ({ input }, ctx) => {
 *     await ctx.vmix.http.execute("Cut", { Input: ctx.vmix.normalizeInput(input) });
 *     return { content: [{ type: "text", text: `Cut to: ${input}` }] };
 *   }
 * });
 * ```
 */
export function createTool<TSchema extends ZodObject<ZodRawShape>>(
  definition: ToolDefinition<TSchema>
): ToolDefinition<TSchema> {
  return definition;
}

/**
 * Create a successful tool result
 */
export function successResult(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: message }],
  };
}

/**
 * Create an error tool result
 */
export function errorResult(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

/**
 * Create a tool result whose single text block is the JSON encoding of `result`.
 *
 * Tool output is the host model's input tokens, paid on every turn, so we emit
 * compact JSON (no pretty-printing) everywhere by default. Keeping the choice in
 * one helper prevents drift back to `JSON.stringify(x, null, 2)` per handler.
 */
export function toolJsonContent(result: unknown, isError?: boolean): ToolResult {
  const out: ToolResult = {
    content: [{ type: 'text', text: JSON.stringify(result) }],
  };
  if (isError !== undefined) {
    out.isError = isError;
  }
  return out;
}

/**
 * Wrap a handler with error handling
 * Converts exceptions to user-friendly error results
 */
export function withErrorHandling<TSchema extends ZodObject<ZodRawShape>>(
  handler: ToolDefinition<TSchema>['handler']
): ToolDefinition<TSchema>['handler'] {
  return async (params, ctx) => {
    try {
      return await handler(params, ctx);
    } catch (error) {
      const message = formatErrorMessage(error);
      return errorResult(message);
    }
  };
}

/**
 * Register a tool on the MCP server
 */
export function registerTool<TSchema extends ZodObject<ZodRawShape>>(
  server: McpServer,
  tool: ToolDefinition<TSchema>,
  ctx: ToolContext
): void {
  // Wrap handler with error handling
  const safeHandler = withErrorHandling(tool.handler);

  // Register with MCP server
  // The SDK expects the schema shape, not the full Zod object
  server.tool(
    tool.name,
    tool.description,
    tool.schema.shape as Record<string, ZodSchema>,
    async (params) => {
      const result = await safeHandler(params as z.infer<TSchema>, ctx);
      // Ensure result is compatible with MCP SDK
      return {
        content: result.content,
        isError: result.isError,
      };
    }
  );
}

/**
 * Register multiple tools at once
 */
export function registerTools(
  server: McpServer,
  tools: AnyToolDefinition[],
  ctx: ToolContext
): void {
  for (const tool of tools) {
    registerTool(server, tool, ctx);
  }
}

/**
 * Tool category for organization
 */
export type ToolCategory =
  | 'switching'
  | 'audio'
  | 'graphics'
  | 'overlays'
  | 'recording'
  | 'input'
  | 'scripting'
  | 'batch'
  | 'replay'
  | 'ptz';

/**
 * Tool metadata for discovery
 */
export interface ToolMetadata {
  name: string;
  category: ToolCategory;
  description: string;
}

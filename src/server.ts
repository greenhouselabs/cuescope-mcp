/**
 * CueScope Server
 * Wires up the MCP server with all tools and resources
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { loadConfig, type Config } from './config/index.js';
import { VmixClient } from './clients/vmix-client.js';
import { StateCache } from './state/cache.js';
import { registerAllTools, type ToolContext } from './tools/index.js';
import { registerAllResources, type ResourceContext } from './resources/index.js';
import { registerAllPrompts } from './prompts/index.js';
import { createLogger, type Logger } from './utils/logger.js';
import {
  getServerModeInfo,
  SERVER_PRODUCT_NAME,
  SERVER_RUNTIME_NAME,
  SERVER_VERSION,
} from './version.js';

let logger: Logger;

/**
 * Build the MCP server instructions for the active mode.
 * Kept short: mode, read-first philosophy, and where the gates live.
 */
export function buildServerInstructions(config: Config): string {
  const mode = getServerModeInfo(
    config.VMIX_CONTROL_MODE,
    config.VMIX_HIGH_IMPACT
  );
  return [
    `${SERVER_PRODUCT_NAME} - read-first production intelligence for workflows compatible with vMix. Active mode: ${mode.label}.`,
    'Review Mode (default) inspects live vMix state, explains setups, diagnoses risks, and generates reviewable scripts/API plans; it never mutates vMix.',
    'Control tools are gated: they are absent in lower modes by design, not broken. Do not work around missing tools with raw vMix HTTP URLs, shell commands, or shortcut-function strings.',
    'Read vmix://server/status for the full safety boundary and the opt-in env vars (VMIX_CONTROL_MODE=true, plus VMIX_HIGH_IMPACT=true) that require a server restart to change mode.',
    'Start with vmix://state/summary for current state and vmix_connection_test to diagnose connectivity.',
    'For current input questions, use live-state tools first. Saved .vmix tools require an explicit server-host path, with raw XML content as a fallback, and are for saved scripts, triggers, data sources, and saved-vs-live drift.',
    'For saved .vmix evidence, prefer an absolute path on the machine running CueScope. Chat-uploaded attachments may not be readable by the MCP server; raw XML content is only a fallback, especially for smaller presets.',
    'For one-input saved-preset questions, use compact/targeted summaries first: vmix_read_preset_file summary for title metadata and data-source bindings, vmix_audit_preset_file with targetInput for trigger/script references. Use full script reviews only when raw script logic, validation, or rewrite guidance is requested.',
    'If live state is unavailable for a current input question, run vmix_connection_test before asking for a saved .vmix file unless the user explicitly wants last-saved preset evidence.',
    'When generating or reviewing vMix VB.NET scripts: the host runs each script as a single implicit procedure (no Sub/Function/Class definitions), Console output is invisible, every unbounded loop needs Sleep(), and bare CreateObject is unavailable (use Microsoft.VisualBasic.Interaction.CreateObject). See knowledge/patterns/scripting/vmix-host-constraints.md.',
  ].join('\n');
}

/**
 * Create and configure the CueScope server
 */
export function createServer(configOverrides?: Partial<Config>) {
  // Load configuration
  const config = loadConfig(configOverrides);

  // Initialize logger with config
  logger = createLogger({ level: config.LOG_LEVEL, prefix: 'server' });
  logger.info('Configuration loaded', {
    host: config.VMIX_HOST,
    httpPort: config.VMIX_HTTP_PORT,
    tcpEnabled: config.TCP_ENABLED,
    mode: getServerModeInfo(config.VMIX_CONTROL_MODE, config.VMIX_HIGH_IMPACT).mode,
    highImpactMode: config.VMIX_HIGH_IMPACT,
  });

  if (config.VMIX_HIGH_IMPACT && !config.VMIX_CONTROL_MODE) {
    logger.warn(
      'VMIX_HIGH_IMPACT is set but VMIX_CONTROL_MODE is false; High-Impact Control tools remain hidden'
    );
  } else if (config.VMIX_HIGH_IMPACT) {
    logger.warn('High-Impact Control tools are enabled');
  }

  // Create vMix client
  const vmix = VmixClient.fromConfig(config);

  // Create state cache
  const state = new StateCache(vmix.http, {
    ttlMs: config.STATE_CACHE_TTL,
    logLevel: config.LOG_LEVEL,
  });

  // Create MCP server
  const server = new McpServer(
    {
      name: SERVER_RUNTIME_NAME,
      version: SERVER_VERSION,
    },
    {
      instructions: buildServerInstructions(config),
    }
  );

  // Create contexts for tools and resources
  const toolContext: ToolContext = { vmix, state, config };
  const resourceContext: ResourceContext = { vmix, state, config };

  // Register tools, resources, and prompts
  registerAllTools(server, toolContext);
  registerAllResources(server, resourceContext);
  registerAllPrompts(server);

  return {
    server,
    vmix,
    state,
    config,
  };
}

/**
 * Start the MCP server
 */
export async function startServer(configOverrides?: Partial<Config>) {
  const { server, vmix, config } = createServer(configOverrides);

  // Connect to vMix
  try {
    await vmix.connect();
    logger.info('Connected to vMix');
  } catch (error) {
    logger.warn('Could not connect to vMix - server will start but tools may fail', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Create transport and connect
  const transport = new StdioServerTransport();

  // Single shutdown routine: closes the MCP server, releases the vMix
  // connections (HTTP + TCP tally), and exits. Guarded so signals, stdin
  // EOF, and transport close cannot run it twice (server.close() itself
  // re-triggers onclose).
  let shuttingDown = false;
  const shutdown = (reason: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info('Shutting down...', { reason });

    void (async () => {
      try {
        await server.close();
      } catch (error) {
        logger.warn('Error while closing MCP server', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      try {
        vmix.disconnect();
      } catch (error) {
        logger.warn('Error while disconnecting from vMix', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      process.exit(0);
    })();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // When the MCP client exits without signaling, stdin ends and/or the
  // transport closes; without these hooks the process would linger holding
  // the vMix TCP connection (zombie server).
  process.stdin.on('end', () => shutdown('stdin end'));
  process.stdin.on('close', () => shutdown('stdin close'));

  await server.connect(transport);

  // server.connect assumes ownership of the transport, so attach onclose
  // after connecting (the SDK wires its own handlers during connect).
  const sdkOnClose = transport.onclose;
  transport.onclose = () => {
    sdkOnClose?.();
    shutdown('transport closed');
  };

  logger.info('CueScope server started', {
    host: config.VMIX_HOST,
    httpPort: config.VMIX_HTTP_PORT,
    tcpEnabled: config.TCP_ENABLED,
    mode: getServerModeInfo(config.VMIX_CONTROL_MODE, config.VMIX_HIGH_IMPACT).mode,
    highImpactMode: config.VMIX_HIGH_IMPACT,
  });

  return { server, vmix };
}

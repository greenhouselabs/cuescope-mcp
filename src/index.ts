#!/usr/bin/env node
/**
 * CueScope - Entry Point
 *
 * Read-first MCP server for workflows compatible with vMix.
 * Enables AI assistants to inspect live production state, diagnose risks, and generate
 * reviewable automation artifacts before any operator action is taken.
 *
 * @see https://github.com/greenhouselabs/cuescope-mcp
 */

import { startServer } from './server.js';
import { SERVER_PRODUCT_NAME, SERVER_RUNTIME_NAME, SERVER_VERSION } from './version.js';

const HELP_TEXT = `${SERVER_RUNTIME_NAME} ${SERVER_VERSION} - ${SERVER_PRODUCT_NAME}

Read-first MCP server for workflows compatible with vMix. Runs over stdio; configure it in your MCP
client (Claude Desktop, Claude CLI, Cursor, MCP Inspector, ...).

Usage:
  ${SERVER_RUNTIME_NAME} [options]

Options:
  --version   Print the server version and exit
  --help      Show this help and exit

Environment variables:
  VMIX_HOST                 vMix host (default: localhost)
  VMIX_HTTP_PORT            vMix Web Controller port (default: 8088)
  VMIX_TCP_PORT             vMix TCP API port for tally (default: 8099)
  TCP_ENABLED               Enable the optional TCP tally connection (default: true)
  VMIX_CONTROL_MODE        Enable Control Mode live-control tools (default: false)
  VMIX_HIGH_IMPACT   Enable High-Impact Control tools too (default: false)
  LOG_LEVEL                 debug | info | warn | error (default: info)

Default mode is Review Mode: read-only analysis, diagnostics, and reviewable
artifacts. No vMix mutation without the explicit control opt-ins.`;

// CLI flags are handled before the MCP transport starts, so stdout is safe here.
const args = process.argv.slice(2);

if (args.includes('--version') || args.includes('-v')) {
  process.stdout.write(`${SERVER_VERSION}\n`);
  process.exit(0);
}

if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(`${HELP_TEXT}\n`);
  process.exit(0);
}

// Start the server
startServer().catch((error) => {
  console.error('Failed to start CueScope server:', error);
  process.exit(1);
});

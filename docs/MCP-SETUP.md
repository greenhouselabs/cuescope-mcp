# MCP Setup

Use this guide to connect CueScope to Claude, Codex, or another MCP-compatible client. The default setup starts in Review Mode: read-only analysis, validation, checklists, and reviewable automation plans.

## Prerequisites

- **Node.js 20 or newer** on the machine running your AI client (not necessarily the vMix machine). Install the LTS build from [nodejs.org](https://nodejs.org), then verify in a terminal — `node --version` should print `v20` or higher.
- **vMix with the Web Controller enabled.** In vMix, open `Settings > Web Controller`, tick **Enabled**, and note the port (default `8088`). This exposes the read API at `http://localhost:8088/api/`.
- The vMix HTTP API reachable from the MCP host — usually `http://localhost:8088/api/` when the AI client and vMix run on the same PC.
- An MCP-compatible client: Claude Desktop, Claude Code, Cursor, or Codex.
- A trusted local machine or trusted production network. The vMix Web Controller is **unauthenticated**, so never expose it to the public internet.

## Recommended Published-Package Setup

`@greenhouselabs/cuescope-mcp` is published to npm, and no global install is required. Your MCP client launches it with `npx`, which downloads the package automatically on first run (this can take a few seconds the first time). Use the [Source-Tree Setup](#source-tree-setup) below for local development or source-checkout testing.

### Claude Code CLI

```bash
claude mcp add cuescope -- npx -y @greenhouselabs/cuescope-mcp
```

With vMix running on another trusted machine:

```bash
claude mcp add cuescope -e VMIX_HOST=192.168.1.100 -- npx -y @greenhouselabs/cuescope-mcp
```

### Codex CLI

```bash
codex mcp add cuescope -- npx -y @greenhouselabs/cuescope-mcp
```

With vMix running on another trusted machine:

```bash
codex mcp add cuescope --env VMIX_HOST=192.168.1.100 -- npx -y @greenhouselabs/cuescope-mcp
```

## JSON MCP Configuration

Use this shape for clients that read an MCP server configuration file.

```json
{
  "mcpServers": {
    "cuescope": {
      "command": "npx",
      "args": ["-y", "@greenhouselabs/cuescope-mcp"],
      "env": {
        "VMIX_HOST": "localhost",
        "VMIX_HTTP_PORT": "8088",
        "VMIX_TCP_PORT": "8099"
      }
    }
  }
}
```

> **Windows note (vMix is Windows-only, so this affects most users):** Claude Desktop on Windows often cannot spawn `npx` directly and fails with `spawn npx ENOENT`. Launch it through `cmd` instead:
>
> ```json
> {
>   "mcpServers": {
>     "cuescope": {
>       "command": "cmd",
>       "args": ["/c", "npx", "-y", "@greenhouselabs/cuescope-mcp"]
>     }
>   }
> }
> ```
>
> If the client still cannot find Node, run `where node` in a terminal to get the absolute path and use that full path as the `command`.

**Where does this file live?** For Claude Desktop, edit `claude_desktop_config.json`:

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

Create the file if it does not exist, paste the block above, save, and fully restart the client. Other clients (Cursor, etc.) use their own MCP config location — see their documentation.

Do not set `VMIX_CONTROL_MODE` for the default Review Mode experience.

## Source-Tree Setup

Use this while developing or testing an unpublished checkout.

```bash
git clone https://github.com/greenhouselabs/cuescope-mcp.git
cd cuescope-mcp
npm install
npm run build
```

Then point your MCP client at the compiled entry point.

```json
{
  "mcpServers": {
    "cuescope": {
      "command": "node",
      "args": ["/path/to/cuescope-mcp/build/index.js"],
      "env": {
        "VMIX_HOST": "localhost",
        "VMIX_HTTP_PORT": "8088",
        "VMIX_TCP_PORT": "8099"
      }
    }
  }
}
```

Adjust the path to match your checkout.

## Control Modes

Review Mode is the default and should be used first. It requires no optional mode environment variables.

Control Mode exposes safer live-control tools:

```json
{
  "VMIX_CONTROL_MODE": "true"
}
```

High-Impact Control additionally exposes workflows such as streaming, recording, script execution, output routing, replay recording, preset loading/saving, batch commands, and destructive input actions:

```json
{
  "VMIX_CONTROL_MODE": "true",
  "VMIX_HIGH_IMPACT": "true"
}
```

Mode changes are made in the MCP client configuration and require restarting the MCP client/server. CueScope should not elevate itself from inside a running MCP session. Only enable High-Impact Control for a controlled test or an intentional production operation.

## First Smoke Tests

After connecting the MCP client, start with read-only prompts:

```text
Use CueScope. Read vmix://server/status and vmix://state/summary. Do not control vMix yet.
```

```text
Generate a go-live checklist for the current preset. Do not control vMix.
```

Expected result: the server reports Review Mode, shows only review tools as active, reads the current vMix state, and does not call any vMix function.

## Troubleshooting

- If the MCP client cannot start the server, confirm Node.js 20+ is on the same PATH the client uses (`node --version`; `where node` on Windows shows the absolute path).
- On Windows, if the client logs `spawn npx ENOENT`, use the `cmd /c npx` launch shape from the Windows note above instead of calling `npx` directly.
- If vMix state cannot be read, confirm Web Controller is enabled and the host/port match `VMIX_HOST` and `VMIX_HTTP_PORT`.
- On Windows PowerShell, use `Invoke-WebRequest -UseBasicParsing http://localhost:8088/api/` for a read-only connectivity check if `curl` prompts about script execution risk.
- If TCP tally fails but HTTP state works, confirm `VMIX_TCP_PORT` is correct or set `TCP_ENABLED=false`.
- After changing MCP config, restart the client or open a new session so the server is relaunched with the new environment.

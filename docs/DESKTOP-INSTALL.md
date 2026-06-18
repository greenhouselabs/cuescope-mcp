# Desktop Install And First Run

Use this guide for local/private testing of CueScope from this source
checkout. This is not a public npm release checklist. Until the package is
published, prefer the source-checkout setup.

The goal of first run is simple: prove the assistant can read vMix state in
Review Mode without controlling vMix.

## Quick Decision

| Situation | Use |
|-----------|-----|
| Local development or private testing today | Source-checkout setup |
| Published npm package later | Published-package setup |
| Claude Desktop on Windows | JSON config, usually source checkout for now |
| Codex CLI or Codex app | `codex mcp add` or `~/.codex/config.toml` |
| Remote vMix machine | Set `VMIX_HOST` to the trusted LAN host/IP |

Do not enable Control Mode during first run.

## Prerequisites

- Node.js 20 or newer on the machine running the MCP client.
- vMix running.
- vMix Web Controller enabled in `Settings > Web Controller`.
- The MCP host can reach the vMix machine on the Web Controller port, usually
  `8088`.
- This repository has been built at least once.

From the source checkout:

```powershell
cd C:\path\to\cuescope-mcp
npm.cmd install
npm.cmd run build
```

Use `npm.cmd` on Windows if PowerShell blocks `npm.ps1`.

## Source-Checkout Server Command

For this local repo, the compiled MCP entry point is:

```text
C:\path\to\cuescope-mcp\build\index.js
```

The generic command is:

```text
node C:\path\to\cuescope-mcp\build\index.js
```

For another checkout location, replace the path.

## Claude Desktop: Source Checkout

Edit `claude_desktop_config.json`.

Windows path:

```text
%APPDATA%\Claude\claude_desktop_config.json
```

Use this Review Mode source-checkout config:

```json
{
  "mcpServers": {
    "cuescope": {
      "command": "node",
      "args": ["C:\\path\\to\\cuescope-mcp\\build\\index.js"],
      "env": {
        "VMIX_HOST": "localhost",
        "VMIX_HTTP_PORT": "8088",
        "VMIX_TCP_PORT": "8099"
      }
    }
  }
}
```

Fully quit and reopen Claude Desktop after editing the file.

For vMix on another trusted machine, change only `VMIX_HOST`:

```json
"VMIX_HOST": "192.168.1.100"
```

Keep the vMix Web Controller on a trusted private network. It is not a public
internet endpoint.

## Codex: Source Checkout

The Codex CLI can manage MCP servers directly:

```powershell
codex.cmd mcp add cuescope --env VMIX_HOST=localhost --env VMIX_HTTP_PORT=8088 --env VMIX_TCP_PORT=8099 -- node C:\path\to\cuescope-mcp\build\index.js
```

Check the saved entry:

```powershell
codex.cmd mcp list
codex.cmd mcp get cuescope
```

Inside an interactive Codex session, use `/mcp` to list active MCP servers and
tools.

### Codex config.toml Alternative

Codex stores MCP configuration in `~/.codex/config.toml`. The CLI and IDE
extension share that configuration. If you prefer to edit the file directly,
add:

```toml
[mcp_servers.cuescope]
command = "node"
args = ["C:/path/to/cuescope-mcp/build/index.js"]
startup_timeout_sec = 20
tool_timeout_sec = 60

[mcp_servers.cuescope.env]
VMIX_HOST = "localhost"
VMIX_HTTP_PORT = "8088"
VMIX_TCP_PORT = "8099"
```

Restart Codex after changing `config.toml`.

## Published-Package Setup

Use this setup when you want your MCP client to download the published npm package with `npx`.

Claude/Codex CLI shape:

```bash
claude mcp add cuescope -- npx -y @greenhouselabs/cuescope-mcp
codex mcp add cuescope -- npx -y @greenhouselabs/cuescope-mcp
```

Claude Desktop on Windows often needs `cmd /c npx`:

```json
{
  "mcpServers": {
    "cuescope": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@greenhouselabs/cuescope-mcp"],
      "env": {
        "VMIX_HOST": "localhost",
        "VMIX_HTTP_PORT": "8088",
        "VMIX_TCP_PORT": "8099"
      }
    }
  }
}
```

## First-Run Smoke Test

After building and restarting the MCP client, ask:

```text
Use CueScope. Run vmix_server_version and confirm the server version, build marker, Review Mode, and runtime build health. Do not control vMix.
```

Expected:

- Version matches the package version.
- Build marker matches the current source checkout.
- Mode is Review Mode.
- `runtimeBuildCheck.health` is `current`.
- If health is `restart-recommended`, fully quit and reopen the MCP client.
- If health is `build-recommended`, run `npm.cmd run build`, then restart the MCP client.

Then start vMix and ask:

```text
Use CueScope. Read vmix://server/status and vmix://state/summary. Do not control vMix.
```

Expected:

- `vmix://server/status` reports Review Mode.
- `controlMode` is false.
- `highImpactMode` is false.
- The active tool count matches review tools only.
- `vmix://state/summary` returns current vMix state.
- No live-control tool is called.

Then ask:

```text
Run vmix_connection_test and explain any connection issues. Do not control vMix.
```

Expected:

- HTTP reachability is checked.
- TCP tally is treated as optional/degraded if HTTP works.
- The response gives safe next checks instead of raw mutating commands.

Then ask:

```text
Explain my current show like a technical director preparing for rehearsal. Include what you can see, what you infer, confidence, and what you cannot see. Do not control vMix.
```

Expected:

- The assistant reads state.
- It separates observed facts from inferred production roles.
- It says what it cannot know from the current state.

Then ask:

```text
Generate a go-live checklist for this preset. Do not control vMix.
```

Expected:

- The checklist is show-specific.
- It includes safe operator confirmations.
- It does not switch inputs, start streaming, run scripts, or mutate vMix.

## Troubleshooting First Run

| Symptom | Most likely cause | Safe check |
|---------|-------------------|------------|
| MCP server does not appear | Client has not restarted or config path is wrong | Fully quit/reopen the client and verify the config file path |
| `vmix_server_version` says `restart-recommended` | The active MCP process started before the latest compiled build | Fully quit/reopen the MCP client |
| `vmix_server_version` says `build-recommended` | Source changed after the last build or compiled files are missing | Run `npm.cmd run build`, then restart the MCP client |
| `Cannot find module ... build/index.js` | Source checkout was not built or path is wrong | Run `npm.cmd run build` and confirm the absolute path |
| PowerShell blocks `npm.ps1` | Windows execution policy blocks the npm shim | Use `npm.cmd install` and `npm.cmd run build` |
| `spawn npx ENOENT` | Client cannot find `npx` in its launch environment | For source checkout, use `node ...\build\index.js`; for npm later, use `cmd /c npx` |
| `Connection refused` for `localhost:8088` | vMix is closed or Web Controller is disabled | Start vMix and confirm `Settings > Web Controller` is enabled |
| vMix state cannot be read | vMix is closed, Web Controller disabled, or host/port mismatch | Use `vmix_connection_test`; confirm Web Controller settings in vMix |
| HTTP works but TCP tally fails | TCP API is disabled, blocked, or on a different port | Treat as degraded; set `TCP_ENABLED=false` if tally is not needed |
| Remote vMix does not connect | Firewall, host, port, or network boundary | Test only on a trusted LAN and avoid exposing Web Controller publicly |

## Control Mode Is Not A First-Run Step

Review Mode is the default and should prove value before any live-control tools
are enabled.

Only after Review Mode is working and the operator intentionally opts in:

```json
{
  "VMIX_CONTROL_MODE": "true"
}
```

High-Impact Control additionally requires:

```json
{
  "VMIX_CONTROL_MODE": "true",
  "VMIX_HIGH_IMPACT": "true"
}
```

Mode changes are made in MCP client configuration and require restarting the MCP client/server. Do not enable High-Impact Control during install smoke testing.

## First-Run Pass Criteria

Mark the install as good when:

- The MCP client starts the server without errors.
- `vmix_server_version` is readable and runtime build health is current.
- `vmix://server/status` is readable.
- `vmix://state/summary` is readable.
- `vmix_connection_test` gives a clear result.
- Review Mode remains non-mutating.
- The assistant can explain the current show in plain English.
- Any setup failure is diagnosable from logs without exposing secrets.

If those pass, the environment is ready for deeper Review Mode testing.

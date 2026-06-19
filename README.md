# CueScope

CueScope is a read-first MCP server that gives AI assistants safe production intelligence for workflows compatible with [vMix](https://www.vmix.com).

This server connects AI assistants to vMix state, curated production knowledge, and reviewable automation planning. By default it does not switch inputs, run scripts, start streams, change audio, or mutate vMix. It reads first, explains what it sees, and helps you decide what to do next.

Package name: `@greenhouselabs/cuescope-mcp`

<p align="center">
  <img src="https://img.shields.io/badge/vMix-Compatible-blue" alt="vMix compatible">
  <img src="https://img.shields.io/badge/Model_Context_Protocol-Server-green" alt="Model Context Protocol Server">
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-Source_Available-orange" alt="Source-available license">
</p>

## Product Promise

Use CueScope as a read-first production advisor:

```text
You: "Explain my current preset and call out anything risky before the show."

Assistant: [reads vMix state]
           [identifies program, preview, inputs, title fields, overlays, and audio routing]
           [summarizes likely production roles]
           [flags risks and suggests review steps]
```

The preserved control tools are still available for advanced users, but the default experience is advisory, state-aware, and review-first.

For a first hands-on walkthrough, use [DEMO.md](DEMO.md). If you used the old control-first prototype, start with [MIGRATION.md](MIGRATION.md).

## What It Does

| Capability | Default Behavior |
|------------|------------------|
| Preset analysis | Explains current inputs, roles, active/preview state, overlays, and likely risks |
| Input lookup | Finds inputs by number, key, name, type, or fuzzy title matching |
| Input inspection | Answers current input questions from live state first, including visible fields and production role hints |
| Audio diagnosis | Reviews buses, mute state, solo state, vMix Call patterns, and mix-minus risks |
| Troubleshooting guidance | Translates pasted errors and explicit log files/excerpts into likely causes, confidence, and safe next checks |
| Script generation | Produces reviewable VB.NET artifacts using actual input references and title fields |
| Script validation | Checks VB.NET safety rules, syntax patterns, loop sleeps, and state references |
| API planning | Produces ordered vMix function-call plans without calling vMix |
| XML comparison | Compares before/after vMix XML snapshots and explains changed production state |
| Knowledge resources | Exposes curated vMix API, scripting, audio, production, troubleshooting, forum-pattern, and example notes |
| Control Mode | Opt-in access to preserved live-control tools, with highest-impact tools behind a second flag |

Saved `.vmix` files are explicit evidence. CueScope uses live vMix state first for current show questions, and asks for a `.vmix` path on the machine running CueScope only when saved-only details are needed, such as stored scripts, input triggers, title countdown/data-source setup, or saved-vs-live drift. Raw XML content is a fallback when a server-visible path is unavailable; chat-uploaded attachments may not be readable by the MCP server.

## Quick Start

### Prerequisites

- Node.js 20+
- vMix running with Web Controller enabled in Settings > Web Controller
- An MCP-compatible client such as Claude Desktop, Cursor, or Claude CLI

### One-Line MCP Setup

The package is published to npm, and no global install is required. Let your MCP client launch the package with `npx`.

Claude Code CLI:

```bash
claude mcp add cuescope -- npx -y @greenhouselabs/cuescope-mcp
```

Codex CLI:

```bash
codex mcp add cuescope -- npx -y @greenhouselabs/cuescope-mcp
```

With vMix running on another trusted machine:

```bash
claude mcp add cuescope -e VMIX_HOST=192.168.1.100 -- npx -y @greenhouselabs/cuescope-mcp
codex mcp add cuescope --env VMIX_HOST=192.168.1.100 -- npx -y @greenhouselabs/cuescope-mcp
```

For guided desktop setup and first-run smoke tests, see [docs/DESKTOP-INSTALL.md](docs/DESKTOP-INSTALL.md). For more setup variants, see [docs/MCP-SETUP.md](docs/MCP-SETUP.md).

### Install From Source

Use this while developing or testing an unpublished checkout.

```bash
git clone https://github.com/greenhouselabs/cuescope-mcp.git
cd cuescope-mcp
npm install
npm run build
```

### npm Install

```bash
npm install -g @greenhouselabs/cuescope-mcp
```

Global install is optional. The recommended MCP setup above uses `npx`.

## Client Configuration

Most MCP clients accept this JSON shape:

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

Do not set `VMIX_CONTROL_MODE` for the default Review Mode experience.

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
> If the client still cannot find Node, run `where node` in a terminal to get the absolute path, then use that full path as the `command` (pointing `args` at the package's compiled entry point for a source checkout).

For a source checkout, point the client at the compiled entry point instead:

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

### Claude Code CLI

```bash
claude mcp add cuescope -- npx -y @greenhouselabs/cuescope-mcp
```

Control Mode:

```bash
claude mcp add cuescope-control -e VMIX_CONTROL_MODE=true -- npx -y @greenhouselabs/cuescope-mcp
```

High-Impact Control:

```bash
claude mcp add cuescope-high-impact -e VMIX_CONTROL_MODE=true -e VMIX_HIGH_IMPACT=true -- npx -y @greenhouselabs/cuescope-mcp
```

### Codex CLI

```bash
codex mcp add cuescope -- npx -y @greenhouselabs/cuescope-mcp
```

Control Mode:

```bash
codex mcp add cuescope-control --env VMIX_CONTROL_MODE=true -- npx -y @greenhouselabs/cuescope-mcp
```

High-Impact Control:

```bash
codex mcp add cuescope-high-impact --env VMIX_CONTROL_MODE=true --env VMIX_HIGH_IMPACT=true -- npx -y @greenhouselabs/cuescope-mcp
```

### Claude Desktop

Use the JSON configuration above in `claude_desktop_config.json`. The file lives at:

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

Create the file if it does not exist, then fully quit and reopen Claude Desktop after editing it. On Windows, prefer the `cmd /c npx` launch shape shown in the Windows note above.

### Multiple vMix Instances

To advise on more than one vMix machine (for example a main and a backup mixer), register the server twice under different names with different `VMIX_HOST` values:

```json
{
  "mcpServers": {
    "vmix-main": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@greenhouselabs/cuescope-mcp"],
      "env": { "VMIX_HOST": "192.168.1.10" }
    },
    "vmix-backup": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@greenhouselabs/cuescope-mcp"],
      "env": { "VMIX_HOST": "192.168.1.11" }
    }
  }
}
```

Each entry runs its own server process with its own connection, mode flags, and tool surface, and the assistant can address them by name.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VMIX_HOST` | `localhost` | vMix hostname or IP address |
| `VMIX_HTTP_PORT` | `8088` | HTTP API port |
| `VMIX_TCP_PORT` | `8099` | TCP API port |
| `TCP_ENABLED` | `true` | Enable TCP tally subscriptions |
| `TCP_RECONNECT_DELAY` | `5000` | Delay between TCP reconnect attempts in ms |
| `TCP_MAX_RECONNECTS` | `10` | Maximum TCP reconnect attempts |
| `TCP_CONNECT_TIMEOUT` | `10000` | TCP connection timeout in ms |
| `VMIX_CONTROL_MODE` | `false` | Expose safer live-control tools when set to `true` |
| `VMIX_HIGH_IMPACT` | `false` | Expose high-impact control tools when `VMIX_CONTROL_MODE=true` is also set |
| `STATE_CACHE_TTL` | `100` | Parsed vMix state cache TTL in ms |
| `SKILLS_PATH` | _(bundled)_ | Override the bundled skill-guidance directory |
| `VMIX_USER_SKILLS_PATH` | _(none)_ | Directory of your own skills (`<name>/SKILL.md`), merged with the bundled ones |
| `VMIX_PRESET_ROOT` | _(none)_ | Optional directory that confines preset-file reads; when set, `.vmix` files outside it are rejected |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error` |

A commented [`.env.example`](.env.example) in the repository documents every variable with its default. Boolean variables use canonical `true`/`false` values.

## Modes And Safety

Review Mode is the default. It exposes read-only tools that return analysis, validation results, scripts, API plans, assumptions, risk notes, and review checklists. Review Mode does not execute scripts, call vMix shortcut functions, save presets, start streams, start recordings, or perform batch commands.

Control Mode is explicit:

```bash
VMIX_CONTROL_MODE=true
```

Use Control Mode when you intentionally want direct vMix control tools to appear in the MCP client. The highest-impact tools require a second opt-in:

```bash
VMIX_CONTROL_MODE=true
VMIX_HIGH_IMPACT=true
```

High-Impact Control exposes tools for scripts, batch commands, recording, streaming, snapshots, preset open/save, destructive input management, output routing, show-building, and replay recording. Test these workflows on a rehearsal preset before using them during a live show.

## Security Notes

Run vMix Web Controller only on trusted machines and networks. This MCP server talks to the vMix HTTP API, which is normally available at `http://localhost:8088/api/`; exposing that API to the public internet can expose live production control.

Review Mode is the public-safe default. Control Mode and High-Impact Control are explicit opt-ins for users who understand that the assistant can affect a live production. vMix Call join URLs and passwords are treated as sensitive; tools do not return generated call links unless the caller explicitly requests that behavior.

This project is an independent source-available integration for vMix, published by Greenhouse Ventures LLC under the Greenhouse Labs brand. It is not open source, and use is governed by the CueScope Source-Available License. It is not affiliated with, endorsed by, or sponsored by vMix or StudioCoast Pty Ltd. vMix is a trademark of its respective owner.

## Review Mode Tools

These tools are visible by default.

| Tool | Purpose |
|------|---------|
| `vmix_show_review` | Natural-language show review for "check my show" / "am I ready": combines live state, audio, output readiness, preflight, checklist, and optional saved-preset audio/audit context |
| `vmix_analyze_preset` | Summarize the current **live** preset, production shape, risks, output readiness, and preflight checks |
| `vmix_generate_show_checklist` | Generate a reviewable rehearsal, go-live, recovery, or end-show operator handoff |
| `vmix_find_input` | Find matching inputs by name, number, key, type, or role clues |
| `vmix_explain_input` | Explain one input's state, fields, audio, and likely production role |
| `vmix_diagnose_audio` | Review audio routing, mute/solo state, buses, call audio, and mix-minus risks |
| `vmix_diagnose_outputs` | Review recording, streaming, external output, video path, audio path, output-like helper inputs, and destination blind spots |
| `vmix_diagnose_logs` | Diagnose pasted vMix/MCP/device log text or one explicit log file with redaction, confidence, and safe next checks |
| `vmix_generate_script` | Generate a preflight-aware reviewable VB.NET script artifact without executing it |
| `vmix_validate_script` | Validate VB.NET script text against vMix scripting rules and known state |
| `vmix_generate_api_sequence` | Generate a preflight-aware ordered vMix API command plan without calling vMix |
| `vmix_compare_xml_snapshots` | Compare two vMix XML snapshots and explain meaningful changes |
| `vmix_read_preset_file` | Read-only inventory of a saved `.vmix` preset file: compact summary by default; `detailMode="full"` includes full scripts/triggers (read-only; as last saved) |
| `vmix_explain_preset_scripts` | Plain-language review and risk flags for VB.NET scripts stored in a saved `.vmix` preset, validated against live state (read-only; as last saved) |
| `vmix_audit_preset_file` | Cross-reference a saved `.vmix` preset against live vMix state: flags triggers calling missing scripts, triggers targeting absent inputs, saved-vs-live drift, and with `targetInput` summarizes one input's own triggers plus inbound trigger/script references (read-only; as last saved) |
| `vmix_preflight` | Go-live readiness report: checks program, preview, audio, fade-to-black, overlays, and input roles against heuristic rules and returns a prioritized verdict (`ready`/`caution`/`not-ready`); optionally cross-references a saved `.vmix` preset (read-only) |
| `vmix_connection_test` | Test connectivity to vMix and diagnose connection problems |

Note: `vmix_analyze_preset` analyzes **live** vMix state from the running `/api/` endpoint. The `vmix_read_preset_file`, `vmix_explain_preset_scripts`, and `vmix_audit_preset_file` tools read a **saved file** on disk and reflect the preset as last saved, which may differ from what vMix is currently running.

For single-input saved-preset questions, use targeted summaries before full script dumps: `vmix_read_preset_file` summary mode for title countdown/data-source bindings, and `vmix_audit_preset_file` with `targetInput` for attached triggers, inbound trigger references, and scripts that reference the input. Use `detailMode="full"` or `vmix_explain_preset_scripts` when the user asks for exact script bodies, validation, or rewrite guidance.

## Control Mode Tools

When `VMIX_CONTROL_MODE=true`, the server exposes the safer preserved live-control surface. When `VMIX_HIGH_IMPACT=true` is also set, it exposes the highest-impact tools too.

| Domain | Examples | Gate |
|--------|----------|------|
| Switching | Cut, fade, transitions, stingers, preview, fade to black | Control Mode |
| Audio | Volume, mute, bus assignment | Control Mode |
| Graphics | Title text, title images, countdowns, animations | Control Mode |
| Overlays | Overlay in, out, and off | Control Mode |
| Playback and live adjustments | Playback, layers, browser, vMix Call, PTZ, playlists, color correction, effects, datasource, most replay playback | Control Mode |
| Recording and streaming | Record, stream, snapshot, replay recording | High-Impact Control |
| Inputs and outputs | Add/remove/rename/reset inputs, output routing, fullscreen, external output | High-Impact Control |
| Scripting | Run, stop, save, and legacy script generation tools | High-Impact Control |
| Batch, presets, and show-building | Multi-command batches, preset open/save/last, build show, add participant, create multiview | High-Impact Control |

Control Mode keeps the original control prototype salvageable without making live mutation the default product.

## Resources

| URI | Description |
|-----|-------------|
| `vmix://server/version` | Server version, feature, and build metadata |
| `vmix://server/status` | Active mode, safety boundary, tool counts, and vMix connection config |
| `vmix://state/summary` | Parsed current state summary |
| `vmix://state/live` | Compact live-state view for active, preview, mixes, overlays, audio, and playback |
| `vmix://state/relationships` | Normalized relationships across inputs, overlays, mixes, audio, and titles |
| `vmix://state/full` | Complete raw vMix XML state. Prefer `vmix://state/summary` for routine checks; the full state can be very large on big productions |
| `vmix://inputs` | All inputs with parsed properties |
| `vmix://inputs/fields` | Title text and image fields across inputs |
| `vmix://audio` | Audio levels, mute states, buses, and solo data |
| `vmix://script/context` | State-aware context for script generation |
| `vmix://skills` | Available vMix skill guidance |
| `vmix://copilot/context` | Higher-level setup analysis for advisory workflows |
| `vmix://tally` | Real-time on-air tally (program/preview per input) from the TCP subscription |
| `vmix://docs/index` | Generated index of curated docs resources and source files |
| `vmix://docs/mcp-capabilities` | MCP knowledge scope, confidence rules, blind spots, and professional-readiness roadmap |
| `vmix://docs/api` | Curated API and shortcut-function notes |
| `vmix://docs/scripting` | Curated VB.NET scripting guidance |
| `vmix://docs/audio-routing` | Curated audio bus and mix-minus guidance |
| `vmix://docs/production-patterns` | Curated production workflow and safe troubleshooting patterns |
| `vmix://docs/forum-patterns` | Curated forum-pattern digests |
| `vmix://docs/examples` | Review-first preset, XML snapshot, routing, and script examples |

## Prompts

The server ships reusable MCP prompts that mirror the documented Review Mode workflows. They are available in every mode and only reference read-only tools and resources.

| Prompt | Arguments | Purpose |
|--------|-----------|---------|
| `show-review` | `path`, `intent` (optional) | Run `vmix_show_review` for a natural-language production review with output readiness and optional saved-preset context |
| `preflight-check` | none | Run `vmix_preflight` and summarize go-live readiness with a prioritized verdict |
| `diagnose-audio` | `input` (optional) | Diagnose audio routing, mutes, mix-minus, and feedback risks; optionally focus on one input |
| `output-readiness` | `focus` (optional) | Run `vmix_diagnose_outputs` for recording/streaming/external readiness and destination checks |
| `explain-my-setup` | none | Read the live state summary and relationships and explain the production like a show runbook |
| `audit-preset` | `path` | Audit a saved `.vmix` preset file against live state and flag drift and risky triggers |
| `go-live-checklist` | `phase` (optional) | Generate a reviewable rehearsal, go-live, recovery, or end-show checklist from live state |

## Example Requests

```text
"Explain my preset like I am preparing for a show."
"Check my show and tell me if anything needs review before we go live."
"Check whether my recording, streaming, and external outputs are ready."
"Find anything that looks risky in my current vMix setup."
"Diagnose my audio routing and call out mix-minus problems."
"Explain this Blackmagic/vMix error and give me safe next checks."
"Generate a safe script to rotate my camera inputs every 10 seconds."
"Validate this vMix VB.NET script before I paste it into vMix."
"Build a reviewable API sequence for showing a lower third."
"Compare these before and after XML snapshots and explain what changed."
```

## Troubleshooting

**vMix state cannot be read / tools return connection errors:**

- Confirm the vMix Web Controller is enabled: in vMix, open `Settings > Web Controller` and tick **Enabled**. The default port is `8088`.
- Verify it from a browser on the vMix machine: open `http://localhost:8088/api/` - you should see XML. If you do not, the MCP server cannot read state either.
- Check that `VMIX_HOST` and `VMIX_HTTP_PORT` in your MCP config match the actual vMix machine and Web Controller port.
- Confirm vMix itself is running; the Web Controller only responds while vMix is open.
- Run the `vmix_connection_test` tool from your assistant ("Test the vMix connection and diagnose any problems") for a step-by-step diagnosis.

**vMix runs on a different machine (`VMIX_HOST` is remote):**

- On the vMix machine, allow inbound TCP port `8088` (and optionally `8099` for tally) through Windows Firewall, scoped to your trusted production network only.
- Verify reachability from the MCP host first, then keep the Web Controller off the public internet - it is unauthenticated.

**TCP tally (port 8099) fails but HTTP state works:**

- The TCP connection is optional. The server runs HTTP-only without it; only the real-time `vmix://tally` resource is affected.
- Confirm `VMIX_TCP_PORT` matches vMix's TCP API port, or set `TCP_ENABLED=false` to silence reconnect attempts.

**The MCP client cannot start the server:**

- On Windows, use the `cmd /c npx` launch shape shown in the Windows note under Client Configuration; a bare `"command": "npx"` often fails with `spawn npx ENOENT`.
- Confirm Node.js 20+ is on the PATH the client uses (`node --version`, and `where node` for the absolute path).
- Fully restart the MCP client after any config change so the server relaunches with the new environment.

**Where to find logs:**

- The MCP server logs to stderr, which your MCP client captures.
- Claude Desktop writes MCP logs to `%APPDATA%\Claude\logs` on Windows (`~/Library/Logs/Claude` on macOS); look for the `mcp-server-cuescope` log file.
- You can paste a redacted error/log excerpt into your assistant, or ask it to use `vmix_diagnose_logs` on one explicit `.log`, `.txt`, `.json`, `.ndjson`, `.xml`, `.err`, `.stderr`, or `.stdout` file path.
- `vmix_diagnose_logs` does not scan folders, does not execute fixes, and redacts secrets, vMix Call links, stream URLs, private IPs, and local paths before returning excerpts.
- For state-aware troubleshooting, pair log diagnosis with `vmix_connection_test`, `vmix_preflight`, `vmix_analyze_preset`, `vmix_diagnose_audio`, or saved-preset tools only when those facts can confirm or challenge the log hypothesis.

## Demo And Migration

- [DEMO.md](DEMO.md) walks through the first Review Mode demo: status, preset analysis, audio diagnosis, script generation, script validation, API planning, and XML comparison.
- [MIGRATION.md](MIGRATION.md) explains how old control-first workflows map to Review Mode, Control Mode, and High-Impact Control.

## Claude Skills

The `skills/` directory contains compact vMix guidance for assistants. The skills are being reframed around Review Mode first: inspect state, reason from actual inputs, generate reviewable artifacts, and only use control tools when the user has explicitly enabled Control Mode or High-Impact Control.

```text
skills/
|-- vmix-basics/        # Switching, transitions, and production-state basics
|-- vmix-audio/         # Mixing, buses, ducking, calls, and mix-minus checks
|-- vmix-graphics/      # Titles, lower thirds, fields, and GT workflows
|-- vmix-overlays/      # Overlay channels, PIP, and stinger guidance
|-- vmix-scripting/     # VB.NET generation and validation
|-- vmix-replay/        # Instant replay workflows
|-- vmix-show-building/ # Complete show setup and review
|-- vmix-streaming/     # Recording, streaming, and external output safety
`-- vmix-troubleshooting/ # Error, log, device, and hardware diagnosis
```

## Architecture

```text
MCP Client (Claude, Cursor, CLI)
    |
    | MCP Protocol over stdio
    v
CueScope
    |
    |-- src/tools/       # Review tools by default, control tools by opt-in flag
    |-- src/resources/   # 21 MCP resources for state, docs, skills, and status
    |-- src/clients/     # vMix HTTP and TCP clients
    |-- src/state/       # XML parser, cache, and normalized relationships
    |-- src/validation/  # VB.NET and API validation helpers
    |-- knowledge/       # Curated production knowledge and examples
    `-- skills/          # Assistant guidance
    |
    v
vMix Instance
    |-- HTTP 8088: XML state and shortcut functions
    `-- TCP 8099: tally and activator subscriptions
```

## Development

```bash
npm install
npm run build
npm test
npm run lint
npm run dev
npm run inspector
```

Recommended release verification:

```bash
npm run build
npm run typecheck
npm run lint
npm test
npm audit --audit-level=moderate
node scripts/validate-api-calls.mjs
npm pack --dry-run
```

### MCP Inspector

`npm run inspector` launches the MCP Inspector against the local build and opens it in your browser. What you should see:

1. The Inspector connects over stdio and the server reports itself as `cuescope-mcp` with the current version.
2. The **Tools** tab lists the Review tools only (no control tools) unless you set the control flags in the environment.
3. The **Resources** tab lists the `vmix://` URIs from the table above; reading `vmix://server/status` should show mode `review`.
4. With vMix running and the Web Controller enabled, reading `vmix://state/summary` returns your live preset summary.

Useful connection checks:

```bash
curl http://localhost:8088/api/
```

On Windows:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8088/api/
Test-NetConnection localhost -Port 8099
```

## Release Shape

CueScope should demonstrate value without live execution:

1. Connect to vMix.
2. Analyze the current preset.
3. Diagnose a realistic audio scenario.
4. Generate and validate a script using actual input references.
5. Compare before and after XML snapshots.
6. Keep Control Mode and High-Impact Control available but secondary.

## License

CueScope Source-Available License - see [LICENSE](LICENSE) for details. Official releases may be installed and used for personal, internal, production, broadcast, educational, nonprofit, and commercial live-production workflows. Redistribution, competing products or services, hosted/managed offerings, and broader reuse require written permission from Greenhouse Ventures LLC.

## Support

- [Contributing Guide](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [Third-Party Notices](NOTICE.md)
- [vMix Forums](https://forums.vmix.com/)
- [MCP Documentation](https://modelcontextprotocol.io/docs)
- [GitHub Issues](https://github.com/greenhouselabs/cuescope-mcp/issues)

---

Built for the live production community by Greenhouse Labs.

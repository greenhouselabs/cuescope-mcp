# CueScope Demo Runbook

This demo shows the new read-first release direction without mutating vMix. It is designed for a real vMix preset, but it can also be walked through with saved XML snapshots.

## Product Name

Release name: **CueScope**

Package name: `@greenhouselabs/cuescope-mcp`

The product is Review Mode first: it reads current vMix state, explains the setup, diagnoses risks, and generates reviewable scripts or API plans. Control tools remain available behind explicit flags.

## Prerequisites

1. Node.js 20 or newer.
2. vMix running with Web Controller enabled.
3. vMix HTTP API reachable at `http://localhost:8088/api/`.
4. An MCP client such as Claude Desktop, Claude CLI, Cursor, or MCP Inspector.
5. vMix Web Controller reachable only from a trusted local machine or network.

## One-Line Client Setup

Use the published package for demos.

```bash
claude mcp add cuescope -- npx -y @greenhouselabs/cuescope-mcp
codex mcp add cuescope -- npx -y @greenhouselabs/cuescope-mcp
```

For source-tree demos or local development, run the build step below and point the client at `build/index.js`.

## Build And Smoke Test

```bash
npm install
npm run build
npm run typecheck
npm run lint
npm test
npm audit --audit-level=moderate
```

Optional API validation:

```bash
node scripts/validate-api-calls.mjs
```

Optional local MCP Inspector:

```bash
npm run inspector
```

## Review Mode Client Config

Use this for the demo. Do not enable operator flags.

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

## Demo Flow

### 1. Confirm Safety Mode

Prompt:

```text
Read vmix://server/status and tell me what mode this server is in, how many tools are active, and whether anything can mutate vMix by default.
```

Expected outcome:

- Mode is `review`.
- Active tools are the review tools only.
- Script execution and vMix function calls are not active by default.

### 2. Analyze The Current Preset

Prompt:

```text
Analyze my current vMix preset. Explain active, preview, key inputs, likely production roles, overlays, title fields, audio shape, and any risks before a show.
```

Expected tool:

- `vmix_analyze_preset`

Expected outcome:

- A state-aware summary of the actual preset.
- Likely roles such as camera, title, lower third, music, call, replay, standby, or program source.
- Risks and recommended next checks.

### 3. Diagnose Audio

Prompt:

```text
Diagnose my audio routing. Pay special attention to muted sources, Master routing, remote guest mix-minus, monitoring buses, and anything that could create feedback.
```

Expected tool:

- `vmix_diagnose_audio`

Expected outcome:

- Audio findings grouped by severity.
- Routing and bus notes based on actual vMix state.
- Review steps before going live.

### 4. Generate A Safe Script

Prompt:

```text
Generate a reviewable vMix VB.NET script that rotates through my camera inputs every 10 seconds. Use stable references from my current preset where possible, validate the script, and include setup steps and failure modes.
```

Expected tool:

- `vmix_generate_script`

Expected outcome:

- A VB.NET script artifact.
- Validation results.
- A clear statement that nothing was executed.
- Assumptions, test steps, and failure modes.

### 5. Validate A Script Edit

Prompt:

```text
Validate this script and tell me if it is safe to review in vMix:

<paste script here>
```

Expected tool:

- `vmix_validate_script`

Expected outcome:

- Syntax and safety checks.
- Warnings for missing `Sleep()` in loops, invalid VB.NET patterns, or missing input references.

### 6. Generate An API Plan

Prompt:

```text
Build a reviewable vMix API sequence to set my lower third name and title fields, show it on overlay channel 1 for five seconds, then hide it. Do not execute anything.
```

Expected tool:

- `vmix_generate_api_sequence`

Expected outcome:

- Ordered function-call plan.
- Batch-compatible command shape where appropriate.
- Assumptions and operator review checklist.

### 7. Compare Before And After XML

Prompt:

```text
Compare these before and after vMix XML snapshots. Explain what changed in active/preview inputs, overlays, audio routing, and title fields.

Before:
<paste XML>

After:
<paste XML>
```

Expected tool:

- `vmix_compare_xml_snapshots`

Expected outcome:

- Human-readable summary of state changes.
- Risk notes and likely production meaning.

## Optional Operator Demo

Only do this on a rehearsal preset.

Control Mode:

```bash
VMIX_CONTROL_MODE=true
```

High-Impact Control:

```bash
VMIX_CONTROL_MODE=true
VMIX_HIGH_IMPACT=true
```

Control Mode exposes lower-risk live-control tools such as switching, overlays, graphics, audio, playback, PTZ, and most replay playback. High-Impact Control additionally exposes scripts, batch commands, recording, streaming, snapshots, presets, destructive input management, output routing, show-building, and replay recording.

## Demo Success Criteria

1. The user sees value before any live execution.
2. Review Mode uses real vMix state.
3. Generated scripts and API plans are reviewable artifacts.
4. Safety boundaries are visible in `vmix://server/status`.
5. Control Mode is clearly secondary.

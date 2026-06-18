# Migration Notes: Control Prototype To CueScope

This project started as a control-first vMix MCP server. It is now **CueScope**: a read-first advisor for real vMix presets, with the original operator surface preserved behind explicit flags.

## What Changed

The default tool surface changed from direct live control to Review Mode.

Default Review Mode exposes tools for:

- Preset analysis.
- Input lookup and explanation.
- Audio diagnosis.
- Reviewable VB.NET script generation.
- Script validation.
- Reviewable API sequence planning.
- XML snapshot comparison.
- Show checklists and operator handoffs.
- Read-only saved `.vmix` preset-file inventory, script review, and live-state audit.
- Go-live preflight readiness reports.
- Connection testing and diagnostics.

Default Review Mode does not:

- Execute scripts.
- Call vMix shortcut functions.
- Start or stop streams or recordings.
- Add, remove, rename, reset, or move inputs.
- Open or save presets.
- Run batch commands.

## Old Behavior

The original prototype exposed live-control tools by default, including switching, overlays, audio, recording, streaming, input management, scripting, batch execution, presets, and show-building.

Those tools have not been removed. They are now opt-in.

## New Modes

### Review Mode

Default.

```bash
VMIX_CONTROL_MODE=false
```

Active tools: review tools only.

Use this for analysis, diagnosis, script generation, validation, API planning, and XML comparison.

### Control Mode

```bash
VMIX_CONTROL_MODE=true
```

Active tools: review tools plus safer control tools.

This exposes lower-risk live-control domains such as switching, overlays, graphics, audio, playback, browser, vMix Call, PTZ, playlists, color correction, effects, datasource, and most replay playback.

### High-Impact Control

```bash
VMIX_CONTROL_MODE=true
VMIX_HIGH_IMPACT=true
```

Active tools: review tools plus the full preserved control surface.

This additionally exposes high-impact tools for scripts, batch commands, recording, streaming, snapshots, preset open/save, destructive input management, output routing, show-building, and replay recording.

Use this only when you intentionally want the old control-first power back.

## How To Update Existing Workflows

### If You Previously Asked For Direct Control

Old prompt:

```text
Cut to Camera 1.
```

Review-first prompt:

```text
Find Camera 1, explain its current state, and generate a reviewable API sequence to cut to it.
```

Control Mode prompt:

```text
Control Mode is enabled. Cut to Camera 1.
```

### If You Previously Ran Scripts

Old prompt:

```text
Run a script that rotates cameras every 10 seconds.
```

Review-first prompt:

```text
Generate and validate a reviewable VB.NET script that rotates my camera inputs every 10 seconds. Do not execute it.
```

High-Impact Control prompt:

```text
High-Impact Control is enabled on a rehearsal preset. Run this reviewed script.
```

### If You Previously Used Batch Commands

Old prompt:

```text
Fade to Host, show the lower third, wait five seconds, then hide it.
```

Review-first prompt:

```text
Generate a reviewable API sequence for fading to Host, showing the lower third for five seconds, and hiding it. Include exact inputs, assumptions, and risks.
```

High-Impact Control is required to expose the preserved batch execution tool.

## Recommended Upgrade Checklist

1. Start in default Review Mode.
2. Read `vmix://server/status`.
3. Try `vmix_analyze_preset` on a real preset.
4. Try `vmix_diagnose_audio` before a rehearsal.
5. Generate and validate scripts without executing them.
6. Enable `VMIX_CONTROL_MODE=true` only when you need live control.
7. Enable `VMIX_HIGH_IMPACT=true` only on rehearsal presets or when you intentionally need high-impact tools.

## Compatibility Notes

- The package name is `@greenhouselabs/cuescope-mcp`.
- The release/product name is CueScope.
- The preserved control tools are still in the codebase.
- Some control tools have been moved behind the second high-impact gate.
- Skills and knowledge resources now steer assistants toward read-first behavior.

# vmix-overlays

> Review-first guidance for overlay channels, lower thirds, bugs, PIP-style graphics, stingers, and safe overlay timing plans.

## Mode Boundary

Assume Review Mode unless `vmix://server/status` reports `mode: "control"` or `mode: "highImpactControl"`. In Review Mode, inspect overlay state and generate reviewable overlay plans; do not put graphics on air.

Use these default tools first:

| Tool | Purpose |
|------|---------|
| `vmix_analyze_preset` | Summarize overlay usage and likely production roles |
| `vmix_find_input` | Locate lower thirds, bugs, full screens, and PIP sources |
| `vmix_explain_input` | Inspect one overlay candidate input |
| `vmix_generate_api_sequence` | Build reviewable overlay in/out plans |
| `vmix_generate_script` | Generate reviewable timed overlay scripts |

Control Mode overlay tools such as `vmix_overlay_in`, `vmix_overlay_out`, and `vmix_overlay_off` require `VMIX_CONTROL_MODE=true`.

## State To Inspect

```text
vmix://server/status
vmix://state/summary
vmix://state/relationships
vmix://inputs
vmix://docs/production-patterns
```

Check:

1. Which overlay channels are currently active.
2. Which input is on each channel.
3. Whether the requested input is a title, image, video, or multiview.
4. Whether a channel is already occupied.
5. Whether clearing overlays would remove something important.

## Overlay Channels

vMix has 4 overlay channels, 1 through 4.

```text
Top
  Overlay 4
  Overlay 3
  Overlay 2
  Overlay 1
  Program output
Bottom
```

Common channel usage:

| Channel | Common Use |
|---------|------------|
| 1 | Lower thirds |
| 2 | Bug or logo |
| 3 | Full-screen graphics or PIP |
| 4 | Alerts or urgent full-screen graphics |

## Review-First Patterns

### Plan Lower Third Timing

```text
1. Find the lower third input.
2. Confirm channel 1 is free or identify what it would replace.
3. Generate an API sequence to show it, wait, then hide it.
4. Return exact commands, duration, assumptions, and risks.
```

### Explain Current Overlays

```text
1. Read vmix://state/summary and vmix://state/relationships.
2. List active overlay channels.
3. Explain the likely purpose of each active overlay.
4. Flag stale or unexpected overlays.
```

### Plan Clear All Overlays

```text
1. Identify active channels first.
2. Ask whether each active overlay is safe to remove if context is unclear.
3. Prefer a channel-by-channel plan over a blanket clear when live.
```

## Operator Reference

Only use these when Control Mode is active and the user explicitly wants live control:

```text
Show lower third:    vmix_overlay_in(channel: 1, input: "Lower Third")
Hide lower third:    vmix_overlay_out(channel: 1)
Show bug:            vmix_overlay_in(channel: 2, input: "Bug")
Clear channel 1:     vmix_overlay_off(channel: 1)
Clear all overlays:  vmix_overlay_off()
```

For PIP position changes, use the layer tools in Control Mode, or generate a reviewable API sequence in Review Mode.

## Common Pitfalls

1. Overlay channel is already occupied.
2. Clearing all overlays removes bug, timer, or sponsor graphics.
3. Lower third fields were not updated before overlay in.
4. PIP position or crop was not checked before showing.
5. Stinger timing does not line up with audio or transition point.

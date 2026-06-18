# vmix-basics

> Review-first guidance for understanding vMix program/preview state, transitions, mixes, and safe switching plans. Load for preset review, input lookup, switching questions, or transition planning.

## Mode Boundary

Assume Review Mode unless `vmix://server/status` reports `mode: "control"` or `mode: "highImpactControl"`. In Review Mode, explain and plan; do not switch the live show.

Use these default tools first:

| Tool | Purpose |
|------|---------|
| `vmix_analyze_preset` | Summarize active, preview, inputs, overlays, and risks |
| `vmix_find_input` | Resolve exact input references before planning |
| `vmix_explain_input` | Explain an input's role, state, fields, and audio |
| `vmix_generate_api_sequence` | Build a reviewable transition or overlay command plan |
| `vmix_compare_xml_snapshots` | Explain before/after state changes |

Control Mode switching tools such as `vmix_switch_cut`, `vmix_switch_fade`, `vmix_switch_transition`, `vmix_switch_stinger`, `vmix_switch_preview`, and `vmix_switch_ftb` require `VMIX_CONTROL_MODE=true`.

## State To Inspect

Read these resources before planning a switch:

```text
vmix://server/status
vmix://state/summary
vmix://state/relationships
vmix://inputs
```

Check:

1. Current active/program input.
2. Current preview input.
3. Mix number if the show uses multi-mix.
4. Whether the target input exists and is ready.
5. Whether overlays, audio, or playback state make the switch risky.

## Input References

Inputs can be referenced by:

- Number: `1`, `2`, `3`.
- Exact title/name: `"Camera 1"`.
- Stable key/GUID when available.

Input names are case-sensitive. Prefer `vmix_find_input` and `vmix_explain_input` before generating scripts or API plans.

## Review-First Patterns

### Explain Current Program And Preview

```text
1. Read vmix://state/summary.
2. Identify active and preview inputs.
3. Explain what each input likely represents.
4. Flag any unexpected state such as FTB, missing audio, or wrong mix.
```

### Plan Preview-Then-Take

```text
1. Use vmix_find_input for the requested target.
2. Use vmix_generate_api_sequence for:
   "Preview <target>, then fade to it after operator confirmation."
3. Return the ordered plan, delays, assumptions, and review checklist.
```

### Compare Before And After

```text
1. Use vmix_compare_xml_snapshots.
2. Explain changed active, preview, overlays, mixes, and input state.
3. Call out whether the change matches the intended transition.
```

## Transition Knowledge

| Effect | Use |
|--------|-----|
| `Cut` | Instant switch |
| `Fade` | Standard dissolve |
| `Zoom` | Zoom style transition |
| `Wipe` | Directional wipe |
| `Slide` | Sliding transition |
| `Fly` | 3D fly effect |
| `CrossZoom` | Zoom cross transition |
| `FlyRotate` | 3D rotation |
| `Cube` | Cube spin transition |
| `Stinger1-4` | Branded animated transition |

## Multi-Mix

vMix supports main mix plus additional mixes. Treat mix routing as a risk area:

- Main mix is the normal program output.
- Additional mixes may feed projectors, records, remote guests, or return monitors.
- A correct switch on the wrong mix can still be a production mistake.

## Operator Reference

Only use these when Control Mode is active and the user explicitly wants live control:

```text
Cut to camera 1:       vmix_switch_cut(input: 1)
Fade to graphics:      vmix_switch_fade(input: "Graphics", duration: 2000)
Preview camera 2:      vmix_switch_preview(input: 2)
Stinger to input 3:    vmix_switch_stinger(input: 3, stinger_number: 1)
Fade to black:         vmix_switch_ftb(state: "on")
```

For Review Mode, use `vmix_generate_api_sequence` to return a plan instead of calling these tools.

## Common Pitfalls

1. Input name case does not match vMix exactly.
2. The target is in preview but not ready for program.
3. The request omits the mix number in a multi-mix show.
4. Overlay or audio state makes the visual switch incomplete.
5. Fade to Black state is unknown before planning.

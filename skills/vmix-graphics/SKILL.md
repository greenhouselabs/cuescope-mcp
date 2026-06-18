# vmix-graphics

> Review-first guidance for titles, lower thirds, GT fields, countdowns, ticker/data-source graphics, and safe graphics update plans.

## Mode Boundary

Assume Review Mode unless `vmix://server/status` reports `mode: "control"` or `mode: "highImpactControl"`. In Review Mode, inspect title fields and generate reviewable update plans; do not change on-air graphics.

Use these default tools first:

| Tool | Purpose |
|------|---------|
| `vmix_find_input` | Locate lower thirds, bugs, titles, timers, and graphics inputs |
| `vmix_explain_input` | Inspect one title or graphics input in context |
| `vmix_analyze_preset` | Understand how graphics fit into the preset |
| `vmix_generate_api_sequence` | Build reviewable title/overlay command plans |
| `vmix_generate_script` | Generate reviewable timed graphics or data scripts |

Control Mode graphics tools such as `vmix_title_set_text`, `vmix_title_set_image`, `vmix_title_countdown`, `vmix_title_animation`, `vmix_title_preset`, `vmix_title_text_color`, `vmix_title_text_visible`, and `vmix_ticker_speed` require `VMIX_CONTROL_MODE=true`.

## State To Inspect

```text
vmix://server/status
vmix://inputs
vmix://inputs/fields
vmix://state/relationships
vmix://docs/production-patterns
```

Check:

1. Exact title input names.
2. Available text and image fields.
3. Whether the title is live on an overlay.
4. Whether the requested field exists and is case-correct.
5. Whether a countdown, ticker, or title preset has special state.

## Title Field Rules

GT titles commonly use dot notation:

```text
Name.Text
Title.Text
Headline.Text
Logo.Source
Background.Color
```

Field names are case-sensitive. Use `vmix://inputs/fields` and `vmix_explain_input` before generating any update plan.

## Review-First Patterns

### Plan Lower Third Update

```text
1. Use vmix_find_input for the lower third.
2. Check vmix://inputs/fields for exact field names.
3. Use vmix_generate_api_sequence for:
   "Set Name.Text and Title.Text, then show overlay channel 1 for five seconds."
4. Return assumptions, exact fields, command plan, and operator test steps.
```

### Review A Live Graphic

```text
1. Read vmix://state/summary and vmix://state/relationships.
2. Identify which overlay channel contains the graphic.
3. Explain what would change if the title fields were updated.
4. Flag any risk from editing a graphic while it is live.
```

### Generate A Timed Graphics Script

```text
1. Use vmix_generate_script for repeated lower thirds, countdown cues, or data-driven updates.
2. Validate the returned script.
3. Include setup assumptions and rollback steps.
```

## Operator Reference

Only use these when Control Mode is active and the user explicitly wants live control:

```text
Set name:          vmix_title_set_text(input: "LT", field: "Name.Text", value: "Jane")
Set title:         vmix_title_set_text(input: "LT", field: "Title.Text", value: "CTO")
Set logo:          vmix_title_set_image(input: "LT", field: "Logo.Source", value: "C:\\logo.png")
Start countdown:   vmix_title_countdown(input: "Timer", action: "start")
Animate in:        vmix_title_animation(input: "LT", animation: "TransitionIn")
Hide element:      vmix_title_text_visible(input: "LT", field: "Subtitle", visible: false)
```

For Review Mode, use `vmix_generate_api_sequence` to return the same commands as a reviewable plan.

## Common Pitfalls

1. Field name does not exist or uses different casing.
2. `.Text` or `.Source` suffix is missing.
3. Windows file path is not escaped correctly in a generated script.
4. The graphic is already live and will visibly update.
5. Animation or title preset name is guessed instead of verified.

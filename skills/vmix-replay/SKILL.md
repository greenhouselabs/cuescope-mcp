# vmix-replay

> Review-first guidance for vMix replay workflows, sports highlights, camera-angle planning, replay scripting, and operator review.

## Mode Boundary

Assume Review Mode unless `vmix://server/status` reports `mode: "control"` or `mode: "highImpactControl"`. In Review Mode, explain replay setup and generate reviewable plans; do not mark, play, pause, or route replay live.

Use these default tools first:

| Tool | Purpose |
|------|---------|
| `vmix_analyze_preset` | Identify replay inputs and show shape |
| `vmix_find_input` | Locate replay, cameras, scorebugs, and graphics |
| `vmix_explain_input` | Inspect replay-related inputs |
| `vmix_generate_script` | Generate reviewable replay automation scripts |
| `vmix_generate_api_sequence` | Build reviewable replay command plans |

Control Mode replay tools such as `vmix_replay_live`, `vmix_replay_mark_in`, `vmix_replay_mark_out`, `vmix_replay_mark_cancel`, `vmix_replay_play`, `vmix_replay_pause`, `vmix_replay_speed`, `vmix_replay_jump`, `vmix_replay_play_event`, `vmix_replay_play_last`, `vmix_replay_camera`, `vmix_replay_channel`, and `vmix_replay_toggle_event_camera` require `VMIX_CONTROL_MODE=true`. Replay recording with `vmix_replay_record` is high-impact and also requires `VMIX_HIGH_IMPACT=true`.

## State To Inspect

```text
vmix://server/status
vmix://state/summary
vmix://inputs
vmix://state/relationships
vmix://docs/production-patterns
```

Check:

1. Whether a replay input exists.
2. Which camera inputs appear to feed replay.
3. Program/preview state before any replay output plan.
4. Audio routing for replay playback.
5. Whether replay output should go to Program, Preview, or an auxiliary output.

## Replay Concepts

```text
Live cameras
  -> replay recording buffer
  -> mark in/out points
  -> event list
  -> playback output
```

Common replay outputs:

| Output | Use |
|--------|-----|
| A | Main replay output |
| B | Secondary or preview replay output |

Typical camera roles:

| Camera | Common Use |
|--------|------------|
| 1 | Main wide shot |
| 2 | Reverse angle |
| 3 | Tight or close-up |
| 4 | Goal, net, finish line, or specialty angle |
| 5-8 | Extra angles |

## Review-First Patterns

### Review Replay Readiness

```text
1. Use vmix_analyze_preset.
2. Find replay input and camera inputs.
3. Check whether replay audio and output routing are understood.
4. Return readiness notes, missing pieces, and operator test steps.
```

### Plan A Quick Replay

```text
1. Confirm replay input and desired output.
2. Generate an API sequence for mark/play/camera selection.
3. Include a manual operator confirmation point before taking replay to program.
```

### Generate Replay Automation

```text
1. Use vmix_generate_script for repeated replay logic or hotkey-style workflows.
2. Validate loop timing and state checks.
3. Return failure modes such as missing replay input, wrong camera, or output mismatch.
```

## Operator Reference

Only use these when Control Mode is active and the user explicitly wants live control:

```text
Mark in:           vmix_replay_mark_in()
Mark out:          vmix_replay_mark_out()
Select channel:    vmix_replay_channel(channel: "A")
Play replay:       vmix_replay_play()
Pause replay:      vmix_replay_pause()
Set speed:         vmix_replay_speed(speed: 0.5)
Select camera:     vmix_replay_camera(camera: 2)
Play last event:   vmix_replay_play_last()
Return live:       vmix_replay_live()
```

## Common Pitfalls

1. Replay input is missing or not recording.
2. Camera angle does not match the operator's intended view.
3. Replay audio is routed differently than program audio.
4. Replay output is not routed to the expected mix or output.
5. A replay automation script lacks safe waits or clear stop conditions.

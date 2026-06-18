# vmix-audio

> Review-first guidance for diagnosing vMix audio, buses, mutes, calls, ducking, monitoring, and mix-minus routing. Load for audio review, guest audio issues, IFB/monitoring questions, and go-live checks.

## Mode Boundary

Assume Review Mode unless `vmix://server/status` reports `mode: "control"` or `mode: "highImpactControl"`. In Review Mode, diagnose and plan; do not change audio routing or levels.

Use these default tools first:

| Tool | Purpose |
|------|---------|
| `vmix_show_review` | Use first for broad "check my show" or go-live audio review requests; pass an explicit saved preset path when supplied so audio and preset-audit evidence can be included |
| `vmix_diagnose_audio` | Review buses, mutes, solos, calls, and mix-minus risk |
| `vmix_diagnose_outputs` | Use when the question is whether stream/record/external destinations receive the intended audio path |
| `vmix_analyze_preset` | Understand the show shape around the audio setup |
| `vmix_find_input` | Resolve mics, music, calls, videos, or replay inputs |
| `vmix_explain_input` | Inspect one input's audio and role |
| `vmix_generate_api_sequence` | Build a reviewable audio change plan |
| `vmix_generate_script` | Generate reviewable ducking or monitoring scripts |

Control Mode audio tools such as `vmix_audio_volume`, `vmix_audio_mute`, and `vmix_audio_bus` require `VMIX_CONTROL_MODE=true`.

## State To Inspect

```text
vmix://server/status
vmix://audio
vmix://inputs
vmix://state/relationships
vmix://docs/audio-routing
```

Check:

1. Which inputs have audio enabled.
2. Current volume, mute, and solo state.
3. Bus assignments for Master and auxiliary buses.
4. vMix Call or remote guest routing.
5. Whether monitoring buses are isolated from the program feed.
6. Whether audio scripts form a reset/promote family where one script prepares
   a roster and another promotes selected sources.

## Audio Architecture

```text
Inputs
  -> Bus routing: M, A, B, C, D, E, F, G
  -> Master, streams, recordings, monitors, returns, and external feeds
```

Bus conventions:

| Bus | Common Role |
|-----|-------------|
| `M` | Master/program audio for stream and recording |
| `A-G` | Auxiliary feeds for ISO records, headphones, remote returns, or mix-minus |

## Review-First Patterns

### Review Production Audio Script Families

```text
1. Read vmix://docs/audio-routing, especially production audio workflow patterns.
2. Separate general workflow patterns from preset-specific names and bus letters.
3. Identify reset/demote scripts, promote/go-live scripts, and any role-group
   In/Out scripts.
4. Verify which reset script covers which promoted sources.
5. Flag order dependencies, off-screen hot-mic risk, wrong reset selection, and
   title/shortTitle drift.
```

### Diagnose Guest Cannot Hear Host

```text
1. Use vmix_diagnose_audio.
2. Find host mic, guest call, and return/monitor bus.
3. Check whether host audio is routed to the guest return bus.
4. Check whether the guest's own audio is excluded from their return.
5. Return likely cause, confidence, and operator review steps.
```

### Plan Music Ducking

```text
1. Identify mic inputs and music input.
2. Use vmix_generate_script for a reviewable ducking script.
3. Validate that loops include Sleep().
4. Return test steps and failure modes before any operator use.
```

### Review Go-Live Audio

```text
1. Use vmix_show_review for broad pre-show language, especially when the user has a saved preset path.
2. Use vmix_diagnose_audio for deeper audio-only review.
3. Confirm master is not muted.
4. Confirm program sources have intended audio.
5. Confirm music or replay audio is not unexpectedly live.
6. Confirm remote return buses avoid feedback.
```

## Common Setups

Talk show:

| Input | M | A | B | Notes |
|-------|---|---|---|-------|
| Host Mic | X | X | | Main plus ISO/record |
| Guest Mic | X | X | | Main plus ISO/record |
| Music | X | | | Main only |
| Comms | | | X | Headphones only |

Remote guest mix-minus:

| Feed | Include | Exclude |
|------|---------|---------|
| Guest return | Host, music as needed, program mix | Guest's own mic |
| Host monitor | Guest, program cues | Host's own mic if delayed |

## Operator Reference

Only use these when Control Mode is active and the user explicitly wants live control:

```text
Set mic level:       vmix_audio_volume(target: "Mic", volume: 85)
Fade music down:     vmix_audio_volume(target: "Music", volume: 25, fade_ms: 1000)
Mute guest:          vmix_audio_mute(target: "Guest", state: "on")
Toggle master mute:  vmix_audio_mute(target: "master", state: "toggle")
Route to bus A:      vmix_audio_bus(input: "Mic", bus: "A", enabled: true)
```

For Review Mode, use `vmix_generate_api_sequence` or `vmix_generate_script` to return a reviewable plan.

## Common Pitfalls

1. Feedback loop from monitor or call return back into Master.
2. Guest hears themselves because their audio is in their return bus.
3. Master is muted or too hot.
4. A music or replay input remains live unexpectedly.
5. Lowering an input on Master also affects an aux feed the show depends on.
6. Treating caller returns, Return Feed, IFB, talkback, or mix-minus paths as music beds for playback automation.

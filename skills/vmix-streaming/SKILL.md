# vmix-streaming

> Review-first guidance for recording, streaming, external outputs, go-live readiness, and high-impact production safety.

## Mode Boundary

Assume Review Mode unless `vmix://server/status` reports `mode: "control"` or `mode: "highImpactControl"`. In Review Mode, review status and generate plans; do not start or stop recording, streaming, snapshots, or external outputs.

Use these default tools first:

| Tool | Purpose |
|------|---------|
| `vmix_show_review` | Use first for broad "am I ready", "check my show", or go-live review requests; includes output readiness and can use an explicit saved preset path for saved audio and trigger-drift evidence |
| `vmix_analyze_preset` | Review recording, streaming, output readiness, preflight status, active input, and show risks |
| `vmix_generate_show_checklist` | Generate a reviewable go-live, rehearsal, recovery, or end-show handoff |
| `vmix_diagnose_outputs` | Use first for focused recording, streaming, external-output, destination-binding, or output-audio readiness questions |
| `vmix_diagnose_audio` | Check go-live audio readiness |
| `vmix_find_input` | Resolve standby, intro, slate, or program sources |
| `vmix_generate_api_sequence` | Build a preflight-aware reviewable go-live or end-show command plan |
| `vmix_generate_script` | Generate preflight-aware reviewable go-live automation scripts |
| `vmix_compare_xml_snapshots` | Compare before/after go-live state |

High-Impact Control tools such as `vmix_record`, `vmix_stream`, `vmix_snapshot`, `vmix_output_set`, `vmix_output_fullscreen`, and `vmix_output_external` require both `VMIX_CONTROL_MODE=true` and `VMIX_HIGH_IMPACT=true`.

When Review Mode blocks recording, streaming, snapshots, or output control, do not provide or echo raw vMix HTTP URLs, curl/Invoke-WebRequest commands, shell-bang commands, or direct shortcut-function strings as a workaround, even as negative examples. Offer read-only preflight checks, reviewable artifacts, or the required MCP opt-in/restart steps instead.

## State To Inspect

```text
vmix://server/status
vmix://state/summary
vmix://state/relationships
vmix://inputs
vmix://audio
vmix://docs/production-patterns
```

Check:

1. Recording state.
2. Streaming state.
3. Active/program input.
4. Master audio, mutes, and suspicious bus routing.
5. Overlays, countdowns, starting soon graphics, and slate state.
6. Output routing if using external, fullscreen, NDI, SRT, or auxiliary feeds.

## Go-Live Review

Use this Review Mode checklist:

```text
1. Confirm the correct preset is open.
2. Confirm program is on the intended input or standby graphic.
3. Confirm Master audio is not muted and expected sources are live.
4. Review `vmix_analyze_preset` preflight status and resolve blocked or caution checks.
5. Confirm stream destinations and keys inside vMix, without exposing secrets.
6. Confirm recording settings and save location in vMix.
7. Confirm overlays and countdowns are intentional.
8. Confirm network and platform health outside vMix.
9. Generate a reviewable go-live plan rather than executing it.
```

## Review-First Patterns

### Safe Go-Live Plan

```text
1. Use vmix_show_review for the broad read-only go-live review.
2. Use vmix_diagnose_outputs for focused recording/streaming/external destination readiness.
3. Use vmix_analyze_preset, vmix_generate_show_checklist, or vmix_diagnose_audio only when deeper detail is needed.
4. Use vmix_generate_show_checklist with scenario "goLive" for a standalone operator handoff.
5. Use vmix_generate_api_sequence for:
   "Start recording, wait three seconds, start stream 0, and keep Starting Soon on program."
6. Review automationPreflight in the generated plan before any operator execution.
7. Return operator confirmation points and rollback steps.
```

### End Of Show Plan

```text
1. Generate a plan to stop streaming first.
2. Keep recording for a short safety tail.
3. Stop recording after the tail.
4. Confirm file saved and stream ended outside vMix.
```

### Compare Go-Live State

```text
1. Capture XML before and after the go-live procedure.
2. Use vmix_compare_xml_snapshots.
3. Explain recording, streaming, active input, and overlay changes.
```

## Operator Reference

Only use these when High-Impact Control is active and the user explicitly wants live control:

```text
Start recording:       vmix_record(action: "start")
Stop recording:        vmix_record(action: "stop")
Start stream 0:        vmix_stream(action: "start", stream: 0)
Stop stream 0:         vmix_stream(action: "stop", stream: 0)
Take snapshot:         vmix_snapshot()
Set output 2:          vmix_output_set(output: 2, source: "Program")
Fullscreen on:         vmix_output_fullscreen(enabled: true)
External output on:    vmix_output_external(enabled: true)
```

Recording, streaming, output, and snapshot tools are high-impact. Prefer rehearsal verification before live use.

## Common Pitfalls

1. Stream key or destination is wrong inside vMix.
2. The stream key is logged or pasted into a chat transcript.
3. Recording was not started before streaming.
4. Program is on the wrong input when the stream begins.
5. Master audio is muted, clipped, or missing a critical source.
6. Stream is stopped but recording is left running unintentionally.
7. External output is routed to the wrong source.

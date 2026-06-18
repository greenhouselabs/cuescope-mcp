# vmix-show-building

> Review-first guidance for planning, reviewing, and validating podcast, talk show, sports, and multi-participant vMix setups.

## Mode Boundary

Assume Review Mode unless `vmix://server/status` reports `mode: "control"` or `mode: "highImpactControl"`. In Review Mode, analyze the existing preset and produce setup plans; do not add inputs, build shows, or mutate the preset.

Use these default tools first:

| Tool | Purpose |
|------|---------|
| `vmix_show_review` | Use first for broad existing-show review or readiness requests; includes output readiness and can use explicit saved preset context for saved audio and trigger-drift evidence |
| `vmix_analyze_preset` | Understand current show structure and risks |
| `vmix_find_input` | Locate participants, cameras, mics, titles, and media |
| `vmix_explain_input` | Inspect one component of the show |
| `vmix_diagnose_audio` | Review mics, buses, call audio, and mix-minus |
| `vmix_generate_api_sequence` | Build reviewable setup/change plans |
| `vmix_generate_script` | Generate reviewable automation for repeated setup tasks |

Control Mode show tools require `VMIX_CONTROL_MODE=true`. Read/review helpers such as `vmix_show_template_list`, `vmix_show_template_details`, and `vmix_show_validate` are available in Control Mode. Mutating tools such as `vmix_show_build`, `vmix_participant_add`, and `vmix_multiview_create` are high-impact and also require `VMIX_HIGH_IMPACT=true`.

## State To Inspect

```text
vmix://server/status
vmix://state/summary
vmix://state/relationships
vmix://inputs
vmix://audio
vmix://docs/production-patterns
vmix://docs/examples
```

Check:

1. Participant count and roles.
2. Camera, mic, title, logo, video, and music inputs.
3. Multiviews or split-screen inputs.
4. Overlay channel conventions.
5. Audio buses, call returns, and recording/streaming status.

## Planning A Show

For a four-person podcast, gather:

```text
1. Participant names and roles.
2. Camera source for each participant.
3. Audio source and bus needs for each participant.
4. Lower third template and field names.
5. Logo, intro, outro, stinger, music, and standby graphics.
6. Recording, stream, and monitor requirements.
```

Example review model:

```text
Inputs:
  - Alice Camera
  - Bob Camera
  - Charlie Camera
  - Dana Camera
  - Quad View
  - Lower Third
  - Logo Bug
  - Starting Soon
  - Intro
  - Outro
  - Background Music

Audio:
  - Master: all program mics plus show music
  - Bus A: ISO or recording feed
  - Bus B: host monitoring or guest return

Overlays:
  - Channel 1: lower thirds
  - Channel 2: logo bug
  - Channel 3: alerts or PIP
  - Channel 4: full-screen graphics
```

## Review-First Patterns

### Review Existing Show

```text
1. Use vmix_show_review for the broad read-only review.
2. Use vmix_analyze_preset or vmix_diagnose_audio only when deeper detail is needed.
3. Explain missing or suspicious inputs.
4. Return a show-readiness checklist.
```

### Plan A New Show

```text
1. Gather requirements.
2. Map required inputs, audio buses, overlays, and media.
3. Use vmix_generate_api_sequence for reviewable setup phases.
4. Separate safe manual setup from operator-only build steps.
```

### Add A Late Guest

```text
1. Identify the required camera and audio source.
2. Decide whether a lower third, multiview, and mix-minus return are needed.
3. Return a staged plan with validation steps before any operator action.
```

## Operator Reference

Only use these when Control Mode is active and the user explicitly wants live show-building:

```text
List templates:      vmix_show_template_list()
Template details:    vmix_show_template_details("four-person-podcast")
Dry-run build:       vmix_show_build(config, dryRun: true)
Build show:          vmix_show_build(config, dryRun: false)
Validate show:       vmix_show_validate("four-person-podcast")
Add participant:     vmix_participant_add({ name, camera, microphone })
Create multiview:    vmix_multiview_create({ name, layout, inputs })
```

Prefer dry-run or review output before any execute-style operator action.

## Common Pitfalls

1. Building into the wrong preset or live show file.
2. Participant camera exists but mic is missing or misrouted.
3. Lower third fields do not match the template.
4. Multiview order does not match the show's editorial plan.
5. Music or comms is routed to Master unintentionally.
6. Recording or streaming is already active before setup changes.

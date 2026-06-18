# Paired-Audio Video Shows

A paired-audio video show uses video files as silent visuals and separate audio/music inputs as the audible bed for each video.

## Common Structure

- Each video input is routed to a non-Master bus such as `A`, `B`, `C`, or `D`.
- Each matching music/audio input is routed to the same bus.
- Video inputs are muted so clip audio is not heard.
- Music/audio inputs are played, paused, restarted, or resumed as Program changes.
- Utility sources such as mic, desktop capture, clocks, and timers may remain on Master.

## Why Professionals Use It

- The video file may contain unwanted camera audio, crowd audio, or inconsistent audio levels.
- The production may want a separate music bed or replacement soundtrack.
- Each video can have a dedicated bus for monitoring, external routing, or downstream mixing.
- Longform shows can swap visuals while preserving creative control over music timing.

## Review Mode Detection

Treat this as likely when:

- Two or more media/video inputs share non-Master buses with separate audio/music inputs.
- The videos are muted.
- The paired audio inputs are named as music, bed, song, audio, or use audio file extensions.
- The input order or bus layout suggests 1:1 pairing.

Do not call this certain unless the operator confirms the design intent.

## Correct Severity

Muted Program video is not automatically a critical blocker when a same-bus music bed is visible. It should usually be a warning:

- The video mute may be intentional.
- The paired music must be playing.
- The paired music must reach the actual stream/record output.
- The operator must choose restart-vs-resume behavior.

Critical severity is appropriate when there is no paired bed, no audible output path, or the requested output is known to be silent.

## Preflight Checks

1. Confirm which bus feeds stream/recording.
2. Confirm each video/music pair.
3. Confirm all music beds are routed to the intended bus.
4. Confirm whether music beds should restart or resume on Program changes.
5. Confirm what happens on an unmapped Program input.
6. Confirm duplicate timer/title inputs are targeted by number or key.
7. Confirm content-rights risk for any commercial or unreleased tracks.

## Automation Pattern

A reviewable monitor script can poll Program input, match the Program video key to a music input key, pause non-matching beds, and play or restart the matching bed.

Rules:

- Use stable keys where available.
- Do not target repeated title inputs by shared title.
- Include `Sleep()` inside the polling loop.
- Validate with `vmix_validate_script`.
- Run in rehearsal or duplicate preset before live use.

## Useful MCP Surfaces

- `vmix_analyze_preset`: show-pattern detection and high-level risks.
- `vmix_diagnose_audio`: bus routing and muted-video/music-bed caveats.
- `vmix_generate_script`: reviewable Program-follow script.
- `vmix_generate_api_sequence`: one-shot current Program pair command plan.
- `vmix://inputs/fields`: timer/title fields with duplicate-title handling.
- `vmix://docs/examples`: paired-audio aux-bus video-show example.

---
source_type: example
example_type: preset-notes
last_reviewed: 2026-06-06
---

# Podcast Preset Notes

Scenario: two hosts, one remote guest, lower thirds, intro video, and music bed.

Likely inputs:

- Host Camera: capture input with audio routed to `M,A`.
- Co-Host Camera: capture input with audio routed to `M,A`.
- Remote Guest: vMix Call or browser input routed to `M`.
- Lower Third: GT title with `Name.Text` and `Title.Text`.
- Intro Video: media playback input with duration.
- Music Bed: audio input routed to `M`.

Review Mode questions:

- Which inputs are currently program and preview?
- Are title fields visible for the lower third?
- Does the guest return bus exclude the guest input?
- Is the music bed muted or intentionally routed to master?
- Does any generated script use keys instead of titles?

Useful docs resources:

- `vmix://docs/audio-routing`
- `vmix://docs/scripting`
- `vmix://docs/production-patterns`

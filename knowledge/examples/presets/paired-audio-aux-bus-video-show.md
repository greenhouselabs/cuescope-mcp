---
source_type: example
example_type: preset-notes
last_reviewed: 2026-06-08
---

# Paired-Audio Aux-Bus Video Show

Scenario: a video-heavy show where each silent video input is paired with a separate music bed on the same aux bus.

This pattern appears in skate, music-video, highlight-reel, concert-visual, and longform playback shows where the video files are treated as silent visuals and separate audio files carry the music or bed.

## Typical Shape

- Video 1 is muted and routed to Bus A.
- Music Bed 1 is routed to Bus A.
- Video 2 is muted and routed to Bus B.
- Music Bed 2 is routed to Bus B.
- Video 3 is muted and routed to Bus C.
- Music Bed 3 is routed to Bus C.
- Video 4 is muted and routed to Bus D.
- Music Bed 4 is routed to Bus D.
- Timers, clocks, mic, and desktop/system capture may remain on Master.

## How Review Mode Should Interpret It

Do not automatically treat a muted Program video as a catastrophic audio failure when a same-bus music bed is visible. Treat it as an intentional paired-audio design with caveats:

- The muted video may be deliberate.
- The matching music bed must be playing at the right time.
- Non-matching music beds should usually pause.
- If the music beds are aux-only, Master-fed stream/record outputs may not hear them.
- If the encoder or external workflow listens to the aux bus, the setup may be correct.

## Good Questions To Ask

- Which bus feeds the stream or recording output?
- Should the matching bed restart from 0:00 or resume from its current position?
- Should all music pause when Program goes to an unmapped input?
- Are video files intentionally muted?
- Are duplicate timer titles targeted by number/key instead of title?

## Good Automation Artifact

A reviewable VB.NET monitor script can watch Program changes and:

1. Resolve the current Program input key.
2. Match the Program video key to its paired music key.
3. Pause non-matching music beds.
4. Play or restart the matching music bed depending on operator intent.
5. Optionally pause every paired music bed when Program is unmapped.
6. Sleep inside the loop so vMix remains responsive.

## Risks To Call Out

- Aux-only music may not reach a Master-fed stream or recording.
- Music tracks can be paused while their video is on Program.
- Restart-vs-resume behavior changes creative timing.
- Duplicate title inputs such as repeated timers should not be targeted by title.
- Copyright-sensitive commercial or unreleased music may create platform risk even when routing is correct.

## Useful MCP Checks

- `vmix_diagnose_audio` for same-bus video/music pairing and bus-routing caveats.
- `vmix_analyze_preset` for overall show shape and severity calibration.
- `vmix://inputs/fields` for duplicate timer fields with number/key identity.
- `vmix_generate_script` for a reviewable paired-audio follow script.
- `vmix_validate_script` before any script is pasted into vMix.

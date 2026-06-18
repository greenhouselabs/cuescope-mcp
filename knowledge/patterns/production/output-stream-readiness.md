# Output And Stream Readiness

Use output readiness checks to separate visible vMix state from destination
facts that still need operator confirmation.

## Visible In Live State

- Recording, streaming, external output, and Fade to Black on/off flags.
- Program and Preview input numbers and titles.
- Parsed Mix active/preview paths when vMix exposes them.
- Master and aux bus mute/volume state when present in XML.
- Input audio bus assignments.
- Output-like helper inputs, such as vMix `Output` inputs or return/clean-feed
  helper inputs, when they appear in the input list.

## Not Proven By Live XML

- Stream URL, key, platform account, profile, and platform health.
- Recording filename/path, codec/container, disk space, and write health.
- Which video mix feeds each stream, recording, external, fullscreen, NDI, SRT,
  or hardware destination.
- Which audio bus feeds each stream, recording, external, or hardware path.
- Downstream device status, such as monitors, switchers, converters, and
  recorders.

## Review Pattern

1. Check whether any output is already active.
2. If an output is active, treat Fade to Black, Master mute, Master zero volume,
   and unexpected aux-only audio as high-priority findings.
3. If outputs are idle before go-live, label the result as not armed yet and
   ready for operator verification rather than ready, failed, or broken.
4. Confirm the actual destination in vMix settings without exposing stream
   keys, URLs with credentials, private recording paths, passwords, or private
   network details.
5. Listen to and watch the actual destination feed, not only local meters.
6. Re-run the output review after arming recording, streaming, or external
   output for final confidence.

## Multi-Mix And Helper Inputs

Output-like inputs and parsed mix paths are useful evidence, but they are not
final destination bindings by themselves. Treat them as prompts for operator
verification:

- Which Mix feeds the real stream or recording?
- Is the `Output` input a preview helper, a return feed, or a source for a
  vMix Call return?
- Does a clean feed intentionally exclude overlays or graphics?
- Does the destination use Master audio or a specific aux bus?

## Review Mode Boundary

In Review Mode, review output readiness and generate reviewable plans only. Do
not start/stop streams, recordings, external output, fullscreen, NDI, SRT, or
hardware outputs. Do not provide raw mutating API calls as a workaround for
operator gates.

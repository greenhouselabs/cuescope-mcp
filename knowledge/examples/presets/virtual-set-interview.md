---
source_type: example
example_type: preset-notes
last_reviewed: 2026-06-06
---

# Virtual Set Interview Preset Notes

Scenario: host camera and remote guest are composited into a virtual set input.

Likely structure:

- Host Camera: source input.
- Guest Call: remote guest input.
- Interview Set: virtual set or multiview input with host and guest as layers.
- Lower Third: title overlay.
- Timer: title or browser input.

Analysis checklist:

- Identify layer source inputs by number, key, and title.
- Explain which layer likely corresponds to host and guest windows.
- Check whether the virtual set itself is program or preview.
- Keep layout edits as reviewable plans unless Control Mode is enabled.
- Recommend visual verification for pan/zoom/crop changes.

Failure modes:

- Replacing a source input can break a layer reference.
- Layer numbers may change when the preset is rebuilt.
- XML does not prove whether the composition looks good on screen.

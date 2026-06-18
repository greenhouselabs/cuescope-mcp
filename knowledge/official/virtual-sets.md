---
source_type: official-distilled
source_basis: vMix virtual set and layer behavior plus local multiview tooling
last_reviewed: 2026-06-06
---

# Virtual Sets

Virtual sets and multiview layouts combine multiple inputs into a composed scene.

Important concepts:

- A virtual set input may contain layers that reference other inputs.
- Layer settings can include crop, pan, zoom, width, and height.
- A host/guest layout often uses one base scene with camera or call inputs layered inside.
- PTZ virtual inputs can provide alternate framings from one camera source.

Guidance:

- Explain layer relationships before suggesting changes.
- Prefer input keys when generating layer or PTZ plans.
- Treat layout edits as Control Mode actions because they can alter a visible scene.
- For Review Mode, return a plan with affected inputs, layer numbers, and rehearsal checks.

Failure modes:

- Moving or replacing a source input can break a virtual-set layer.
- Layer numbering matters and should be validated against current state.
- A scene can look correct in XML but still need visual verification in vMix.

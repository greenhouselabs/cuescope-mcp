---
source_type: official-distilled
source_basis: vMix Call production patterns and local audio routing diagnostics
last_reviewed: 2026-06-06
---

# vMix Call Audio

vMix Call guests need clean return audio. The core pattern is mix-minus: each caller receives a mix that excludes their own voice.

Common goals:

- Route host and program audio to the caller.
- Exclude the caller's own input from their return bus.
- Keep producer talkback off master unless intentionally live.
- Avoid sending delayed program audio back to talent.

Diagnostics:

- Identify call inputs by type, title, or production role.
- Check bus assignments for each caller.
- Check whether caller inputs are routed to their own return bus.
- Check mute state separately from bus membership.

Review Mode behavior:

- Diagnose likely mix-minus issues from XML.
- State assumptions where return output mapping is not visible.
- Generate reviewable routing recommendations, not immediate routing changes.

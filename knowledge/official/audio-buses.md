---
source_type: official-distilled
source_basis: vMix audio bus behavior and local normalized topology parser
last_reviewed: 2026-06-06
---

# Audio Buses

vMix uses `M` for master/main and `A` through `G` for auxiliary audio buses.

Common uses:

- `M`: stream/recording program audio.
- `A`: clean feed, recording split, or remote guest return.
- `B`: host headphones, IFB, or monitor send.
- `C-G`: additional mixes for callers, control rooms, venues, or recorders.

Routing principles:

- Avoid feeding a caller's own audio back to that caller.
- Keep comms and IFB off the master bus unless intentionally broadcast.
- Music beds usually go to `M`, but may be excluded from guest returns.
- Check muted state separately from bus assignment.

Diagnostics:

- Inputs with audio but no buses are likely unrouted.
- A bus with no sources may be unused or misconfigured.
- A remote guest receiving themselves back is a mix-minus failure.
- A monitoring bus routed to `M` can create feedback or accidental broadcast.

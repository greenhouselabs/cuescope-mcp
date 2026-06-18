---
source_type: example
example_type: routing-diagram
last_reviewed: 2026-06-06
---

# Podcast Mix-Minus Routing

Goal: remote guest hears the show without hearing their own voice back.

```text
Host Mic       -> M, A
Co-Host Mic    -> M, A
Remote Guest   -> M          (exclude from A)
Intro Video    -> M, A
Music Bed      -> M          [review whether guest should hear it]

Master M       -> Stream/Recording
Bus A          -> Remote Guest Return
```

Review Mode checks:

- Flag `Remote Guest -> A` as a likely self-return problem.
- Confirm bus `A` actually feeds the guest return.
- Confirm comms/talkback are not routed to `M`.
- Check mute state separately from bus routing.

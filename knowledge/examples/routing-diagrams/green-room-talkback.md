---
source_type: example
example_type: routing-diagram
last_reviewed: 2026-06-06
---

# Green Room And Talkback Routing

Goal: off-air guests hear program and producer cues without comms leaking to stream.

```text
Program Mix     -> M
Host Mic        -> M, B
Guest Mic       -> M, B
Producer Mic    -> B          (exclude from M)
Playback        -> M, B

Master M        -> Stream/Recording
Bus B           -> Green Room / IFB
```

Review Mode checks:

- Flag producer/talkback sources routed to `M`.
- Confirm guest mics are not sent back to themselves when bus `B` is personal return.
- Ask what physical output carries bus `B` when XML cannot prove it.

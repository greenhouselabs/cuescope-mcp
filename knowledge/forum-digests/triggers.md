---
source_type: curated-forum-summary
curation_note: Clean summary of recurring trigger questions, not raw forum content.
last_reviewed: 2026-06-06
---

# Triggers

Recurring community patterns:

- Operators often want actions when a video ends, a title appears, audio becomes active, or a timer expires.
- vMix native triggers and scripts can overlap; avoid duplicating the same action in both places.
- Polling scripts need `Sleep()` and fresh `API.XML()` reads.
- One-shot triggers should exit or latch after firing.

Review Mode response:

- Ask whether a native vMix trigger already exists when state or user context suggests it.
- Generate scripts only when the condition cannot be represented more safely.
- Include rehearsal tests that prove the action fires once.

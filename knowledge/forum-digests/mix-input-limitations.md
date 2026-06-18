---
source_type: curated-forum-summary
curation_note: Clean summary of recurring mix-input and multi-view limitations.
last_reviewed: 2026-06-06
---

# Mix Input Limitations

Recurring community patterns:

- Mix inputs are useful for alternate program outputs but can confuse audio routing assumptions.
- Layered inputs and mix inputs may not expose every relationship clearly in simple XML summaries.
- Automation that targets program/preview may need a `Mix` parameter for multi-mix productions.
- Operators often expect overlays or transitions to affect all mixes, but vMix behavior can be mix-specific.

Review Mode response:

- Surface assumptions when a preset uses multiple mixes.
- Recommend explicit `Mix` parameters when the requested target mix is known.
- Avoid guessing multi-mix routing from title names alone.

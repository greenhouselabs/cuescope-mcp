---
source_type: curated-forum-summary
curation_note: Clean summary of repeated scripting issues, not raw forum content.
last_reviewed: 2026-06-06
---

# Scripting Gotchas

Recurring community patterns:

- Infinite loops without `Sleep()` freeze vMix.
- Scripts that read XML once before a loop keep using stale state.
- Title field names must match exactly.
- Input titles are easy to break by renaming; keys are safer.
- `Thread.Sleep()` is a common .NET habit but vMix scripts should use `Sleep()`.
- One-shot trigger scripts need an `Exit Do` or latch to avoid repeated firing.

Review Mode response:

- Flag these as validation warnings or errors.
- Prefer a reviewable script artifact over immediate execution.
- Ask the operator to test in a duplicate preset.

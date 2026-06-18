---
source_type: curated-forum-summary
curation_note: Clean summary of recurring API edge cases, not raw forum content.
last_reviewed: 2026-06-06
---

# API Edge Cases

Recurring community patterns:

- Function names are exact and sometimes differ from visible UI labels.
- Some functions accept `Value`; others need `Input`, `SelectedName`, `SelectedIndex`, `Duration`, `Channel`, or `Mix`.
- Input titles are case-sensitive.
- Dynamic script variables cannot always be statically validated.
- HTTP command success does not guarantee the visible production changed as intended.

Review Mode response:

- Validate function names against the local allowlist.
- Include parameter assumptions in generated API sequences.
- Prefer keys over titles.
- Recommend manual verification for show-critical actions.

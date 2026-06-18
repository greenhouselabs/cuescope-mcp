---
source_type: curated-forum-summary
curation_note: Clean summary of recurring list playback behavior questions.
last_reviewed: 2026-06-06
---

# List Playback

Recurring community patterns:

- List inputs can contain multiple media items, but scripts often need selected-index awareness.
- `NextItem`, `PreviousItem`, and `SelectIndex` affect the list input, not every media file independently.
- Automation should account for whether the list is playing, paused, looping, or at the end.
- Removing or shuffling list items during a show is show-critical.

Review Mode response:

- Prefer validation and planning before list mutation.
- Include test steps for list item order and selected index.
- Treat destructive playlist changes as Control Mode actions.

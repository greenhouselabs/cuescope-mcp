---
source_type: internal-pattern
example_type: script
last_reviewed: 2026-06-06
---

# Timed Lower Third

Use case: update a title, show it briefly, and clear the overlay.

Key review points:

- Confirm exact title field names.
- Confirm overlay channel 1 through 4.
- Confirm the same overlay channel will not be reused while the script sleeps.

Template:

```vb
API.Function("SetText", Input:="{title-key}", SelectedName:="Name.Text", Value:="Jane Host")
API.Function("OverlayInput1In", Input:="{title-key}")
Sleep(5000)
API.Function("OverlayInput1Out")
```

---
source_type: example
example_type: xml-snapshot
last_reviewed: 2026-06-06
---

# Audio Routing Before/After Snapshot

Before:

```xml
<input number="2" key="{guest}" title="Remote Guest" muted="False" audiobusses="M,A" />
```

After:

```xml
<input number="2" key="{guest}" title="Remote Guest" muted="False" audiobusses="M" />
```

Interpretation:

- The guest was removed from bus `A`.
- If bus `A` is the guest return, this may fix a self-return echo.
- If bus `A` is an isolated recording or monitor feed, this may remove needed guest audio.
- XML alone may not reveal what output bus `A` feeds.

Recommended Review response:

- State the confirmed bus change.
- Ask or infer cautiously what bus `A` represents.
- Recommend monitoring the return feed in rehearsal.

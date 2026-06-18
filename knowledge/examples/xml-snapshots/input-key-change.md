---
source_type: example
example_type: xml-snapshot
last_reviewed: 2026-06-06
---

# Input Key Change Snapshot

Before:

```xml
<input number="4" key="{lower-third-old}" type="GT" title="Lower Third">
  <text name="Name.Text">Jane Host</text>
</input>
```

After:

```xml
<input number="4" key="{lower-third-new}" type="GT" title="Lower Third">
  <text name="Name.Text">Jane Host</text>
</input>
```

Interpretation:

- The title and number stayed the same.
- The key changed, which usually means the input was replaced or recreated.
- Scripts that reference `{lower-third-old}` need review.
- Title-field validation may still pass if fields are unchanged, but stable-reference validation should warn or block old keys.

Recommended Review response:

- Report this as a stable-reference change.
- Suggest regenerating scripts or updating stored references.
- Avoid assuming the replacement template is visually identical.

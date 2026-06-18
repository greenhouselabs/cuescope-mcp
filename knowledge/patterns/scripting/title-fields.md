# Title Fields

Title scripts should be generated from actual visible fields, not guessed field names.

Safe pattern:

```vb
API.Function("SetText", Input:="{title-key}", SelectedName:="Name.Text", Value:="Jane Host")
```

Review steps:

- Confirm the target input is a title or GT input.
- Confirm `SelectedName` appears in current XML.
- Use exact capitalization.
- Separate text fields from image fields.
- Mark scripts with placeholder values as needing human edits.

Failure modes:

- Replacing a title template can invalidate field names.
- Multiple titles may share similar names.
- A title input can exist without exposing fields in the current XML.

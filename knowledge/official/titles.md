---
source_type: official-distilled
source_basis: vMix title and GT input behavior plus local parser support
last_reviewed: 2026-06-06
---

# Titles

Title and GT inputs expose text and image fields in the vMix XML when available. Fields are addressed by exact `SelectedName` values.

Common field names:

- `Name.Text`
- `Title.Text`
- `Headline.Text`
- `Score.Text`
- `Image.Source`

Guidance:

- Field names are case-sensitive and template-specific.
- `SetText` updates text fields.
- `SetImage` updates image fields.
- Use `vmix://inputs/fields` or `vmix_explain_input` before generating title scripts.
- If a generated script uses placeholder title values, mark it as needing human edits.

Failure modes:

- Template replacement can change field names.
- Inputs with no visible fields cannot be fully validated for `SelectedName`.
- Image fields should not be updated with `SetText`.

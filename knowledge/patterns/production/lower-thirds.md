# Lower Thirds

Lower thirds combine title fields, overlay channels, and production timing.

Safe generation pattern:

- Resolve the title input by key.
- Validate visible fields such as `Name.Text` and `Title.Text`.
- Generate `SetText` calls first.
- Show the overlay after fields are updated.
- Optionally hide after a reviewed duration.

Review checks:

- Confirm guest/host identity and spelling.
- Confirm overlay channel.
- Confirm the title template has the expected fields.
- Test animation timing in rehearsal.

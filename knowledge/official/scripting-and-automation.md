---
source_type: official-distilled
source_basis: vMix scripting help and local script-validator rules
last_reviewed: 2026-06-06
---

# Scripting And Automation

vMix scripting uses VB.NET-style syntax. Scripts can call `API.Function()` and read state with `API.XML()`.

Required conventions:

- Declare variables with `Dim`.
- Compare with `=`, not `==`.
- Concatenate strings with `&`.
- Use `Sleep(milliseconds)` for waits.
- Never use a `Do While True` or similar loop without `Sleep()`.
- Null-check XML nodes before reading attributes or inner text.

Review Mode contract:

- `vmix_generate_script` returns reviewable artifacts only.
- It does not save scripts, call `ScriptStartDynamic`, or execute vMix functions.
- Execution requires manual vMix review or explicit High-Impact Control tooling.

Script review checklist:

- Confirm each `Input` value exists in current state.
- Prefer input keys over numbers and titles.
- Confirm each title `SelectedName` exists on the target input.
- Confirm any polling loop refreshes `API.XML()` inside the loop.
- Confirm all loops include `Sleep()`.
- Test in rehearsal or a duplicate preset before live use.

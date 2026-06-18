# vmix-scripting

> Review-first VB.NET script generation and validation for vMix automation. Load for automation requests, timing logic, state monitoring, title updates, audio ducking, or any workflow that may become a script.

## Mode Boundary

Assume Review Mode unless `vmix://server/status` reports `mode: "control"` or `mode: "highImpactControl"`.

Review Mode tools return reviewable artifacts only:

| Tool | Purpose | Key Params |
|------|---------|------------|
| `vmix_generate_script` | Generate a preflight-aware reviewable VB.NET script artifact | `goal` |
| `vmix_validate_script` | Validate script text and state references | `code` |
| `vmix_explain_preset_scripts` | Review saved `.vmix` scripts plus script-set risks | `path` or `content` |
| `vmix_generate_api_sequence` | Generate a preflight-aware reviewable API call sequence | `goal` |
| `vmix_find_input` | Resolve exact inputs before scripting | `query` |
| `vmix_explain_input` | Inspect fields, audio, and role for one input | `input` |

High-Impact Control tools such as `vmix_script_run`, `vmix_script_stop`, `vmix_script_save`, and legacy `vmix_script_generate` require both `VMIX_CONTROL_MODE=true` and `VMIX_HIGH_IMPACT=true`. Do not suggest execution from this skill unless High-Impact Control is active and the user explicitly asks for live execution.

## When To Generate Scripts

Scripts are useful when the request needs:

- Loops that monitor vMix state.
- Conditional behavior based on active input, video state, audio state, or title fields.
- Timed sequences with waits between actions.
- Reusable automation that an operator can review and paste into vMix.
- Logic that would be awkward as one-off tool calls.

Use `vmix_generate_api_sequence` instead when the request is a finite sequence of vMix shortcut functions and does not need loops, XML parsing, or conditional logic.

## Complex Script Stance

Do not avoid complex scripts when the show logic calls for them. vMix scripts may be hundreds or thousands of lines if explicit structure makes the result safer and easier for an operator to review.

Prefer two compatibility levels:

- **Copy-ready basic**: flat action blocks, clear comments, `Sleep()` waits, exact input references, and minimal cleverness.
- **Advanced structured**: variables, arrays, loops, XML polling, latches, helper routines, and large mappings when they make real show logic clearer.

`Dim` is correct and should be used for declarations. Arrays and dynamic references are not automatically wrong, but they should be documented as review points when the MCP cannot fully verify every runtime value from current state.

For long scripts, include a header, input manifest, operator settings, main logic, cleanup/exit behavior, review notes, and rehearsal test steps. Do not compress a readable large reset script into opaque arrays merely to make it shorter.

When reviewing or generating scripts from real production examples, do not
memorize one preset's names or bus letters as universal. Extract reusable
patterns, then verify them against the current user's preset. Common examples
include reset-then-promote audio families, multiview-driven routing, per-slot
In/Out scripts, lower-third row selection, talkback returns, long-running
watchers, sparse-layer cleanup helpers, and high-impact top-of-show resets.
Use `vmix://docs/scripting` for the generalized production script workflow
patterns before turning an example into generated code.

## Review-First Flow

```text
User: "Create a script that shows a lower third when I cut to the guest camera."

Assistant:
1. Read vmix://server/status to confirm mode and safety boundary.
2. Read vmix://state/summary and vmix://inputs.
3. Use vmix_find_input for "guest camera" and "lower third".
4. Use vmix_explain_input to inspect title fields if needed.
5. Call vmix_generate_script with the natural-language goal.
6. Review the returned `automationPreflight` and `productionReview` sections before any operator execution.
7. Validate the returned code with vmix_validate_script if code is edited or supplied by the user.
8. Return the artifact, assumptions, review checklist, test steps, and failure modes.
```

## Essential vMix VB.NET

### API.Function() Calls vMix Functions

```vbnet
API.Function("Cut", Input:="Camera 1")
API.Function("Fade", Input:="2", Duration:=1000)
API.Function("SetText", Input:="Lower Third", SelectedName:="Name.Text", Value:="John")
API.Function("OverlayInput1In", Input:="Lower Third")
```

### API.XML() Reads Current State

```vbnet
Dim xml As String = API.XML()
Dim x As New System.Xml.XmlDocument
x.LoadXml(xml)
Dim active As String = x.SelectSingleNode("//active").InnerText
```

### Sleep() Is Required In Loops

```vbnet
Do While True
    ' Monitor state here.
    Sleep(100)
Loop
```

Loops without `Sleep()` can freeze vMix.

## Syntax Rules

| Rule | Correct | Wrong |
|------|---------|-------|
| Variables | `Dim x As String` | `var x` |
| Concatenation | `a & b` | `a + b` |
| Equality | `If x = "True" Then` | `If x == true Then` |
| Delay | `Sleep(1000)` | `Thread.Sleep(1000)` |
| Loops | Include `Sleep()` | Tight loop with no delay |

## State-Aware References

Before generating or reviewing a script, prefer real state over guessed names:

```text
1. vmix://inputs
2. vmix://inputs/fields
3. vmix://audio
4. vmix://state/relationships
5. vmix_find_input
6. vmix_explain_input
```

Input names are case-sensitive. Prefer stable keys when the generated artifact provides them, and call out any unresolved references in the review notes.

## Common Script Patterns

### Wait For Video Complete

```vbnet
Do While True
    Dim xml As String = API.XML()
    Dim x As New System.Xml.XmlDocument
    x.LoadXml(xml)

    If x.SelectSingleNode("//input[@title='Video']/@state").Value = "Completed" Then
        Exit Do
    End If

    Sleep(100)
Loop

API.Function("Fade", Input:="Host", Duration:=1000)
```

### Monitor Active Input Change

```vbnet
Dim lastActive As String = ""

Do While True
    Dim xml As String = API.XML()
    Dim x As New System.Xml.XmlDocument
    x.LoadXml(xml)

    Dim current As String = x.SelectSingleNode("//active").InnerText
    If current <> lastActive Then
        lastActive = current
        If current = "3" Then
            API.Function("OverlayInput1In", Input:="Guest Lower Third")
        End If
    End If

    Sleep(100)
Loop
```

### Timed Sequence

```vbnet
API.Function("Cut", Input:="Intro")
API.Function("Play", Input:="Intro")
Sleep(10000)
API.Function("Fade", Input:="Host", Duration:=1000)
Sleep(1500)
API.Function("OverlayInput1In", Input:="Lower Third")
Sleep(5000)
API.Function("OverlayInput1Out")
```

## Review Checklist

Before recommending use in vMix, verify:

1. The script was generated from current state or clearly documented assumptions.
2. Every loop includes `Sleep()`.
3. The code uses VB.NET syntax, not JavaScript, C#, or Python.
4. Input names, keys, and title fields exist in the user's setup.
5. Validator warnings for smart quotes, missing `Then`, unguarded XML lookups, vMix Call bus syntax, `SetLayer` value shape, data-source row maps, loop churn, high-impact loop actions, and exact-time polling have been reviewed.
6. Saved-preset reviews include `scriptSetReview` findings for paired slot drift, broad slot precompute, sibling row-map drift, and shared talkback mic-bus risk when applicable.
7. Slot-driven lower-third scripts keep unknown data-source row maps as reviewed placeholders, not invented defaults.
8. Slot-driven talkback scripts keep caller return sources and operator mic bus roles as reviewed placeholders unless the preset context proves them.
9. Sparse-layer cleanup scripts verify the target layout, reviewed clear input, and layer list before using `SetLayer`.
10. Layout scripts that combine layer mapping with audio or routing changes have explicit review notes and state-change guards.
11. Paired video/music follow scripts never infer vMix Call inputs, caller returns, Return Feed, IFB, talkback, or mix-minus paths as music beds; require explicit video/music pairs instead.
12. Generated `productionReview` notes for persistent loops, high live-impact automation, and show-critical functions are included in the handoff.
13. Streaming, recording, output routing, overlay-all-off, bus master/solo, preset, batch, and script-control actions are explicitly called out.
14. The operator has a rehearsal test plan.

## Quick Reference

```text
Generate reviewable script:
  vmix_generate_script(goal: "rotate cameras every 30 seconds")

Validate script text:
  vmix_validate_script(code: "...")

Generate reviewable API sequence:
  vmix_generate_api_sequence(goal: "show lower third for five seconds")

Find exact input before scripting:
  vmix_find_input(query: "guest camera")
```

## Control Mode Note

If `VMIX_CONTROL_MODE=true` and `VMIX_HIGH_IMPACT=true` are active, and the user explicitly asks to run a reviewed script, the High-Impact Control scripting tools may be used. Keep the response explicit about live impact, confirm the target preset/show context, and prefer testing on a rehearsal preset first.

## Related Skills

- `vmix-basics` for switching and preview patterns.
- `vmix-graphics` for title fields and lower thirds.
- `vmix-audio` for ducking and routing patterns.
- `vmix-overlays` for overlay timing.
- `vmix-streaming` for high-impact recording and go-live workflows.

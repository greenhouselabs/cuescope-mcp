---
source_type: internal-pattern
last_reviewed: 2026-06-13
---

# Complex Script Design

vMix scripts can be large, structured automation programs. Do not avoid a long
script when explicit structure makes the result safer, easier to review, or more
reliable for a show operator.

Use a short API sequence when the work is a finite list of actions with no
branching. Use a script when the work needs timing, loops, state polling,
conditional behavior, latches, helper routines, or reusable show logic.

## Compatibility Levels

Generated scripts should declare the intended compatibility level.

### Copy-Ready Basic

Use this when the operator needs a script they can inspect quickly and paste
into vMix with minimal edits.

Preferred traits:

- Straight-line `API.Function(...)` calls.
- `Sleep(ms)` between timed actions.
- `Dim` declarations only where they improve clarity.
- Comments beside action blocks with input number, title, key, and intent.
- No placeholder values when the user provided exact values.
- No compact cleverness that hides what will happen live.

Arrays and loops are not forbidden, but avoid them in copy-ready basic scripts
when repeated explicit calls are clearer for review.

### Advanced Structured

Use this when the request genuinely needs reusable logic, large mappings,
polling, state machines, or many repeated branches.

Allowed traits:

- `Dim` variables, typed values, booleans, integers, strings, dates, and XML nodes.
- Arrays or lists when they reduce real duplication and the syntax is known to
  work in the target vMix scripting host.
- `For`, `For Each`, `If`, `ElseIf`, `Select Case`, helper functions, and
  subroutines when they make the script easier to reason about.
- Thousands of lines when explicit action blocks are safer than compressed logic.

Advanced scripts require stronger review notes, a rehearsal plan, and a clear
stop condition or safe polling delay.

## Large Script Structure

Use this order for complex generated scripts:

1. Header: purpose, compatibility level, live impact, and rehearsal warning.
2. Input manifest: input number, title, key, type, and role.
3. Operator settings: buses, timings, thresholds, overlay channels, and flags.
4. Helper routines: small, named routines only when they improve clarity.
5. Startup checks: optional state reads, latch initialization, and comments.
6. Main logic: straight-line sequence or loop/state machine.
7. Cleanup/exit behavior: what happens when the script finishes or is stopped.
8. Review checklist: assumptions, failure modes, and what to test first.

## Readability Rules

Every generated command that references an input should be auditable without
searching elsewhere. Prefer a nearby comment like:

```vb
' #12 HOST CAM | key=abc123 | action=AudioOn | bus=M,A
API.Function("AudioOn", Input:="abc123")
Sleep(50)
```

For long reset scripts, repeated explicit calls are acceptable. A thousand-line
script with clear labels can be better than a fifty-line script that hides the
show map inside arrays.

## vMix Compiler Nuance

`Dim` is correct and should be used for variables.

Known-safe patterns should stay allowed. For example, simple typed declarations,
XML parsing, polling loops with `Sleep()`, and one-line variable initialization
are normal vMix scripting patterns.

Some VB.NET syntax can be valid in general but brittle in the vMix scripting
host or hard for the MCP to verify. Treat these as review items, not automatic
failures:

- Multi-line array initializers with brace literals and line continuations.
- Dynamic input references such as `Input:=inputs(index)`.
- XPath queries built through string concatenation.
- Tight polling below `Sleep(50)` unless a show-specific reason is documented.
- Large scripts that mutate recording, streaming, outputs, presets, or input
  structure.

When a construct is valid but hard to verify, the MCP should say so directly:
"This may be valid vMix VB.NET, but the validator cannot prove every dynamic
reference from current state."

## State And Reference Rules

Use current state before generating or reviewing a script:

1. Resolve exact inputs with live state or `vmix_find_input`.
2. Prefer input keys for generated executable references.
3. Include human-readable titles and numbers in comments.
4. Validate title fields before emitting `SetText`.
5. Avoid fuzzy matches in executable code.
6. State whether dynamic references are fully verified, partially verified, or
   review-only.

## Long-Running Scripts

Every unbounded loop must include `Sleep()`. Long-running scripts should also
use latches or state-change checks so they do not repeat the same live action on
every poll.

Safe polling shape:

```vb
Dim lastActive As String = ""

Do While True
    Dim xml As String = API.XML()
    Dim x As New System.Xml.XmlDocument
    x.LoadXml(xml)

    Dim active As String = x.SelectSingleNode("//active").InnerText
    If active <> lastActive Then
        lastActive = active
        ' React to the change once.
    End If

    Sleep(100)
Loop
```

## Review Standard

A generated complex script is not good merely because it validates. It should
also be:

- Intent-correct: it does what the user asked, not a nearby workflow.
- Operator-readable: names, numbers, keys, and action purposes are visible.
- State-grounded: references come from current state or documented assumptions.
- Rehearsable: test steps are concrete and low-risk.
- Honest: dynamic or unverified parts are called out instead of hidden.

---
source_type: internal-pattern
last_reviewed: 2026-06-15
derived_from: sanitized production-script comprehension evals
---

# Production Audio Workflow Patterns

Real vMix shows often use families of scripts rather than one isolated audio
command. Treat these as production patterns to recognize and verify, not as
universal bus or naming rules.

## Generalization Rule

Never assume a specific preset's conventions apply to another user.

Examples from production scripts can teach reusable patterns:

- reset-then-promote audio routing
- green-room and live-bus state changes
- multiview-driven audio follow
- per-slot audio buttons
- group In/Out scripts
- caller return source changes with `VideoCallAudioSource`
- script-family drift and reset-coverage gaps

They must not become constants:

- Bus `A` is not always Program.
- Bus `C` is not always Green Room.
- `Host 1 Call` and `Guest 1 Call` are example names, not required names.
- `Audio Mix`, `Mix Layouts`, and `Mix Layouts 2` are example multiview names.
- Even overlay positions such as `{0, 2, 4, 6}` are a pattern to verify, not a rule.

Before applying a pattern, verify the current user's state, comments, bus labels,
output routing, script family, or operator-provided context.

## Reset-Then-Promote

Many caller workflows have two script roles:

1. Reset or demote a roster to an off-air/green-room state.
2. Promote the currently visible or selected sources to live/program.

Typical shape:

- Reset: route all relevant callers to a green-room bus, remove them from the
  live bus, and set call return audio to the green-room bus.
- Promote: route selected callers to the live bus, remove them from the
  green-room bus, and set call return audio to the live/program bus.

Safety checks:

- Confirm the reset script covers every source the promote script can make live.
- Confirm the reset runs before the promote when changing layouts.
- Confirm the selected layout or multiview has updated before the promote reads
  `API.XML()`.
- Confirm the wrong reset script cannot leave production mics or prior callers
  live on the program bus.
- Confirm reverse order is documented as a failure mode.

Common residual risks:

- A brief audio drop if a source is reset and then immediately re-promoted.
- A hot mic if a source is promoted by one script family but reset by a narrower
  family.
- Silent or wrong callers if the N-up script does not match the visible layout.

## State-Aware Multiview Audio Follow

Some scripts read vMix XML, inspect a multiview input's internal overlay nodes,
resolve the inputs in visible slots, then route matching audio sources.

Review steps:

- Identify the multiview input being read.
- Identify whether the script matches visible sources by `title`, `shortTitle`,
  key, number, or another attribute.
- Map the slot indexes used. Remember that `NodeList.Item(n)` is ordinal order,
  not necessarily a visible layer number.
- Check whether the script reads only the slots it needs or precomputes extra
  slots that can fail before the used slot is reached.
- Check for null guards before `.SelectNodes`, `.Item(n)`, `.Attributes`, and
  `.GetNamedItem(...)`.
- Check whether stale XML after a layout recall could route the previous
  occupants.

Generation guidance:

- Prefer stable input keys when generating new executable references.
- When reading dynamic layout occupants, add null guards and clear fallback
  behavior.
- If matching by title or shortTitle, state why and warn about rename drift.
- If routing one slot, do not require unrelated slots to exist.

## Per-Slot In/Out Buttons

Some productions use one In and one Out script for each visible slot. Each script
reads the current occupant of that slot and routes only that occupant.

This is useful for manual control, but it is still additive:

- Running slot In after a slot occupant changes promotes the new occupant but
  does not demote the previous occupant.
- Running slot Out after a slot occupant changes demotes the new occupant, not
  the previous occupant.

Tests:

- Promote slot 1, change slot 1 to a new source, promote slot 1 again, and check
  whether the previous source remained live.
- Demote before swapping a slot, or use a broad reset before the new promote.
- Verify title/shortTitle matching against the actual source preset.

## Flat Group In/Out Scripts

Flat group scripts route a hard-coded roster without inspecting XML. They are
often easier to reason about than state-aware scripts, but they can be broader
than intended.

Review checks:

- List every input in the roster.
- Confirm whether the group includes only talent or also producers/operators.
- Confirm the In and Out scripts are true mirrors.
- Confirm local microphones are not given `VideoCallAudioSource`, because that
  setting applies to call-style return audio.
- Confirm a broad reset script covers the same roster as the broad In script.

High-risk pattern:

- A role-group In script routes production or operator microphones to the live
  bus, but the usual "all guests out" reset does not clear those sources.

When found, label the operator risk plainly: the matching group Out script is
required to clear that workflow.

## Caller Return Source

`VideoCallAudioSource` uses values such as `BusA` or `BusC`, while bus routing
functions typically use bus letters such as `A` or `C`.

Correct examples:

```vb
API.Function("AudioBusOn", Input:="Caller 1", Value:="A")
API.Function("AudioBusOff", Input:="Caller 1", Value:="C")
API.Function("VideoCallAudioSource", Input:="Caller 1", Value:="BusA")
```

Do not treat `A` and `BusA` as interchangeable syntax. They belong to different
vMix functions.

## Common Fragility Patterns

Flag these during script comprehension, validation, and generation:

- `Console.WriteLine` for operator diagnostics; it is usually invisible in vMix.
- String concatenation with `+`; use `&` for strings in VB.NET.
- Missing null guards before XML node, attribute, or item access.
- Dynamic XPath values that cannot be proven from current state.
- Exact, case-sensitive name rosters with no fallback.
- Script families copied many times, where a roster or bus edit can drift in one
  file.
- Source blocks that include an input absent from bus on/off blocks.
- Reset scripts that cover a smaller roster than the matching promote scripts.
- Scripts that precompute more slots than they actually use.

## How To Answer Users

When analyzing a user's real script:

1. Separate direct facts from inferred production intent.
2. State whether the current live preset matches the script's input names.
3. If the script is from another preset, do not penalize missing inputs as code
   defects; treat them as current-state mismatch.
4. Identify the script family and sequence, not just the individual file.
5. Explain whether a risk is intrinsic or mitigated by a companion script.
6. Give rehearsal tests that prove the workflow, ordering, and failure modes.

When generating new scripts:

1. Verify bus roles before assuming live/program/green-room semantics.
2. Prefer state-driven lookup only when the state source is stable enough.
3. Use explicit comments that name inputs, keys, buses, and intent.
4. Include reset coverage and order-dependency notes when audio routing is
   additive.
5. Do not overfit names or bus letters from examples unless the user's current
   state or prompt confirms them.

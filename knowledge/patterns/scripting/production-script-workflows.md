---
source_type: internal-pattern
last_reviewed: 2026-06-15
derived_from: sanitized real-world script corpus evals
---

# Production Script Workflow Patterns

Real vMix production scripts are evidence of workable show logic, not universal
rules. Use them to recognize patterns, ask better verification questions, and
generate safer reviewable artifacts. Do not copy one show's names, bus letters,
data sources, output numbers, layer indexes, or timing values into another
user's preset unless current state or operator context confirms them.

## Generalization Rule

Treat real scripts as examples of how vMix can be tied together:

- XML state can drive graphics, audio, video returns, outputs, and timers.
- Multiview slots can act as the source of truth for who is currently assigned
  to a layout position.
- Title fields and data sources can be coordinated with overlays.
- Long-running watchers can keep timers, layouts, and return feeds in sync.
- Show-control scripts can reset many domains before a live segment.

Do not treat example constants as universal:

- `Mix Layouts`, `Audio Mix`, `Script Monitor`, or `Master Timer` are sample
  input names, not required names.
- Bus `A`, `C`, `D`, or `E` roles vary by preset.
- `Output2` and `Output3` roles vary by preset.
- Sheet names, row numbers, title field names, and layer geometry are
  production-specific.

## Slot-Driven Workflows

Some productions use a multiview input as a control surface. A script reads the
input's overlay nodes, resolves the source assigned to a slot, then performs an
action for that source.

Common action families:

- route the source's audio live or off-air
- set the source's vMix Call return audio
- show a lower third for the source
- route talkback to the source
- copy the source into another layout

Review checks:

- Which input is being treated as the slot map?
- Which slot indexes are read, and are they layer indexes or XML node ordinals?
- Does the script read only the needed slot, or can unrelated missing slots
  break the action?
- Does it match by key, title, shortTitle, number, or another attribute?
- What happens if the slot changes between paired On and Off scripts?

Generated scripts should prefer stable keys for fixed targets and clearly label
any dynamic slot lookup as state-dependent.

## Lower-Third And Data-Source Patterns

A common graphics pattern is:

1. Read the current layout or participant state.
2. Map the participant to a data-source row or title field set.
3. Update the graphic.
4. Bring the overlay in.
5. Hide it after a reviewed duration.

The pattern is reusable. The row mapping is not.

Generation guidance:

- Parameterize the data source, row map, overlay channel, display duration, and
  title field names.
- Generate slot-driven lower-thirds as reviewed scaffolds when the row map is
  unknown; do not invent participant-to-row mappings.
- Validate title fields before `SetText`, `SetImage`, or `SetColor`.
- Treat dynamic `DataSourceSelectRow` values as reviewed row-map logic; confirm
  the data source, table, and row expression against the current roster.
- Warn when sibling scripts use different row maps.
- Warn when a timed `Sleep(...)` can hide an overlay after a later trigger has
  reused the same overlay channel.

## Talkback Return Patterns

Talkback scripts may change what a remote caller hears rather than changing
what the production hears. In vMix Call workflows, `VideoCallAudioSource` uses
values such as `BusE`, while `AudioBusOn` and `AudioBusOff` use bus letters such
as `E`.

Review checks:

- Is the talkback bus truly private?
- Is the operator/producer mic excluded from Master/program?
- Does Talkback Off target the same caller who was put into talkback?
- Can one per-slot Off remove a shared operator mic while another caller still
  hears the talkback bus?
- Is there an all-talkback reset script?

Generated talkback helpers should make the target model explicit: fixed caller,
current slot occupant, or global reset. When bus roles are unknown, generate a
reviewed scaffold with placeholders for caller return sources and the operator
mic bus instead of assuming one show's Bus A/E convention.

Saved-preset reviews should flag per-slot On/Off pairs that both resolve the
current slot occupant and toggle the same operator mic bus. That shape can be
valid, but it depends on operator sequencing or a separate all-talkback reset.

## Watcher Patterns

Long-running watcher scripts should have a predictable shape:

```vb
Try
    API.Function("SetText", Input:="Script Monitor", SelectedName:="Status.Text", Value:="Watcher is Running")

    Do While True
        Dim x As New System.Xml.XmlDocument
        x.LoadXml(API.XML())

        ' Read state, compare with last known state, and act only when needed.

        Sleep(250)
    Loop
Finally
    API.Function("SetText", Input:="Script Monitor", SelectedName:="Status.Text", Value:="Watcher has Stopped")
End Try
```

Review checks:

- Every unbounded loop includes `Sleep()`.
- `API.XML()` is refreshed inside the loop.
- High-impact functions are not repeated on every poll without a latch or
  state-change check.
- The polling interval matches the operational need.
- A stopped/running indicator is visible to the operator when practical.

## Layer Cleanup And Layout Mapping

Sparse multiview layers can break scripts that expect fixed indexes. A useful
cleanup pattern is to inspect expected layer indexes and fill missing layers
with a known transparent or clear input.

Large layout mapping scripts can also be legitimate. They often encode
production-specific geometry, speaker order, media-share variants, and dynamic
values. Treat them as evidence for generator requirements, not as text to copy.

Generation guidance:

- Prefer small helper data structures or explicit phases over giant copy/paste
  branch tables when generating new code.
- Keep exact geometry and dynamic values configurable.
- Validate that every referenced layer and clear/transparent input exists.
- Validate `SetLayer` values as `LayerIndex,SourceInput`; dynamic values should
  be reviewed against the layer map and source manifest.
- Generate cleanup helpers as reviewed scaffolds that confirm the layout input,
  clear input, and layer list before using `SetLayer`.
- Warn when layout scripts update audio, video, and geometry in the same loop.

## High-Impact Show-Control Scripts

Top-of-show, go-live, record, stream, output, and script start/stop automation
should be handled as reviewable orchestration plans.

High-impact functions include:

- recording and streaming start/stop
- output and fullscreen routing
- overlay-all-off commands
- bus master sends and solos
- broad audio bus resets
- vMix Call return audio/video changes
- script start/stop controls
- preset, input, or destructive show-building actions

Generation guidance:

- Decompose show-control into phases: graphics, media, timers, audio, returns,
  outputs, recording/streaming, and companion scripts.
- Label the blast radius of each phase.
- Use Review Mode artifacts unless explicit Control Mode or High-Impact Control permits live
  execution.
- Avoid exact wall-clock equality triggers; use latches and explicit fired
  state.
- Use unambiguous date/time handling instead of string comparisons when
  scheduling live actions.

## Validator Signals

Useful warnings from real production scripts:

- Smart or curly quotes in VB.NET strings.
- Missing `Then` after `If`.
- `+` used for string concatenation instead of `&`.
- `VideoCallAudioSource` values that look like `AudioBusOn`/`AudioBusOff`
  single-letter bus values instead of Bus-prefixed caller return sources.
- Unguarded `SelectSingleNode`, `SelectNodes`, `.Item(n)`, `.Attributes`,
  `.GetNamedItem(...)`, or `.InnerText`.
- Unbounded loops without `Sleep()`.
- High-impact functions inside polling loops.
- Large repeated API update blocks inside polling loops without a clear
  last-state or change guard.
- Time equality checks that can fire repeatedly.
- Paired On/Off scripts that resolve targets from current state independently.
- Scripts that precompute more slots than they use.

These are warnings and review prompts, not automatic proof that a real show
script never worked.

Saved-preset script reviews can also surface script-set findings that require
multiple scripts to compare, such as paired On/Off slot drift and per-slot
scripts that precompute many multiview positions before acting on one target,
or sibling lower-third scripts whose data-source row maps have drifted.

## How To Answer Users

When reviewing real scripts:

1. Explain what the script does in operator language.
2. Separate direct facts from inferred production intent.
3. Identify which details are preset-specific conventions.
4. Identify companion scripts and ordering assumptions.
5. Label high-impact actions plainly.
6. Recommend rehearsal tests.

When generating scripts:

1. Verify current state and exact references first.
2. Preserve useful production patterns while parameterizing show-specific
   details.
3. Include review notes, assumptions, and failure modes.
4. Prefer warnings and phased plans for high-impact workflows.

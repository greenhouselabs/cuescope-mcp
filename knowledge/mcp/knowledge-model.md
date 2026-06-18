# MCP Knowledge Model And Confidence

This note explains what CueScope knows, where that knowledge comes from, how it should be used, and where assistants must be careful.

## Knowledge Layers

CueScope combines several kinds of knowledge. They should not be treated as equal.

1. Live vMix state
   - Source: current vMix XML and parsed MCP resources.
   - Examples: Program, Preview, parsed mix active/preview paths, inputs, keys, titles, types, playback state, overlays, title fields, basic audio routing, recording/streaming flags.
   - Use this as the highest-priority source for the current show.

2. Normalized/derived state
   - Source: parser helpers and state relationship builders.
   - Examples: input roles, title-input lists, bus-to-input relationships, Program/Preview input summaries, mix active/preview relationships, overlay relationships, likely usage tags.
   - Use this for explanation and diagnosis, but disclose that roles and likely usage are heuristic.

3. Review tools
   - Source: read-only tools in `src/tools/brain/`.
   - Examples: preset analysis, audio diagnosis, input explanation, script validation, script generation, API plan generation, XML snapshot comparison.
   - Use these when the user asks for interpretation, review, validation, or a reviewable artifact.

4. Curated knowledge resources
   - Source: `knowledge/` files exposed through `vmix://docs/*`.
   - Examples: API notes, scripting rules, audio routing patterns, production patterns, forum-derived gotchas, example scripts and snapshots.
   - Use these to explain stable vMix concepts and common production patterns.

5. Assistant skills
   - Source: `skills/`.
   - Examples: compact task guidance for audio, graphics, overlays, replay, scripting, show-building, streaming, and basic switching.
   - Use these as workflow instructions: which resources/tools to consult and what risks to check.

6. Operator tools
   - Source: gated tool registry.
   - Examples: direct switching, audio changes, title updates, playback control, recording, streaming, scripts, batch, presets, outputs, show-building.
   - Use only when the server exposes Control Mode or High-Impact Control. Review Mode must not work around these gates.

## Source Priority

When sources conflict, prefer them in this order:

1. Current live vMix XML or resource output.
2. Raw XML details when available.
3. Normalized parser output.
4. Review tool analysis.
5. Curated docs and skills.
6. General assistant knowledge.

If the parser and raw XML disagree, state the disagreement. If a resource omits a detail, do not claim the detail is absent unless the raw XML confirms it.

## Confidence Language

Use high confidence when:

- The current vMix XML directly exposes the fact.
- The input is referenced by stable key or exact number.
- The relevant parser field is covered by tests.
- The conclusion is descriptive, not interpretive.

Use medium confidence when:

- The fact is derived from multiple XML fields.
- The conclusion depends on a known production pattern.
- The parser exposes input routing but not final output routing.
- A role label such as camera, title graphic, audio bed, or media playback is inferred.

Use low confidence or ask for verification when:

- The XML does not expose the required state.
- The answer depends on visual appearance, rendered title output, stream destination settings, aux bus output state, or operator intent.
- The assistant is inferring from filenames, input order, or common show patterns.

## Current Strengths

- Read-first safety boundary with Review Mode as default.
- Real input identity through numbers, exact titles, and stable keys.
- State-aware script generation and validation.
- Strong VB.NET loop-safety checks.
- Useful audio-routing and paired-audio diagnostics.
- Per-input title field visibility, including duplicate-title handling.
- Parsed multi-mix active/preview paths when vMix exposes a `<mixes>` section.
- Output-readiness summaries that separate active output facts from unknown destination binding.
- Structured preflight reports inside `vmix_analyze_preset`, with go/caution/blocked status, category checks, checklist items, and known unknowns.
- Dedicated show checklist handoffs through `vmix_generate_show_checklist` for rehearsal, go-live, recovery, and end-show workflows.
- Preflight-aware script/API artifacts that surface blocked or caution status before any operator execution.
- Reviewable API sequence generation without execution.
- Curated docs and examples available inside MCP resources.

## Current Blind Spots

- Aux bus output mute/volume and whether buses feed stream/recording outputs.
- Mix output destination binding, including which mix feeds a given stream, recording, external output, or screen.
- Actual visual pixels on Program/Preview.
- Rendered GT/title values when vMix exposes only field definitions or format strings.
- Stream profile destinations, recording format/path, and platform health.
- Deep trigger/shortcut lists, data source internals, playlist/list contents, replay internals, PTZ state, color correction state, and full virtual-set internals.
- Operator intent and show rundown context unless the user provides it.

## Response Rules

- Separate observed facts from inferences.
- Name confidence when a recommendation affects live output.
- Prefer stable keys in generated scripts and API plans.
- Never execute or bypass live-control gates in Review Mode.
- For gated actions, offer read-only checks, reviewable artifacts, or the proper opt-in/restart path.
- Do not print raw mutating HTTP URLs, shell commands, or shortcut-function strings as Review Mode bypasses, even as negative examples.

---
source_type: official-distilled
source_basis: vMix preset file format, confirmed schema inspection, and CueScope preset-awareness implementation
last_reviewed: 2026-06-10
---

# Preset Files (.vmix)

A `.vmix` file is vMix's saved configuration format. It is a separate data source from the live `/api/` XML, not a richer view of the same data.

## Saved file vs. live API

| | Live `/api/` XML | `.vmix` preset file |
|---|---|---|
| Transport | HTTP, generated on demand | File on disk |
| Unique content | Current program/preview, audio meters, current title-field values, recording/streaming runtime state | Scripts (VB.NET source), input trigger definitions, data-source configuration |
| Freshness | Always "now" | As of last save — can be stale |
| Script source | Not available | Present under `<Scripting><ArrayOfScript>` |
| Input triggers | Not available | Stored as entity-escaped XML in each input's `Triggers="…"` attribute |

## The three-state model

There are three distinct states, only two of which are readable:

1. **Live running vMix** — always current; read via `/api/`. No scripts or trigger definitions.
2. **The `.vmix` file on disk** — has scripts and triggers, but reflects the preset as last saved. Readable via the preset-file tools.
3. **vMix's in-memory config** — what is loaded and potentially edited in the UI but not yet saved. Not accessible via any API or file.

Never claim a saved file accurately describes what is currently on air. Always label output from the file as "as last saved."

## Root element and key structure

- Root element is `<XML>`, not `<vmix>`. A `<Version>` child gives the preset format version (e.g. `9`).
- Scripts live under `<Scripting><ArrayOfScript><Script>`, each with `<Name>` and `<Code>` (entity-escaped VB.NET, no CDATA). VB.NET `&` appears as `&amp;`; smart/curly quotes are common.
- Inputs appear as top-level `<Input …>` elements with `Title`, `Key` (GUID), and numeric `Type` attributes. Only elements that carry a `Title="…"` attribute are real input definitions; attribute-less `<Input>` references nested inside shortcuts or triggers are not input definitions.
- Input triggers are stored in a `Triggers="…"` attribute on each `<Input>`, holding an entity-escaped `<ArrayOfInputTrigger>` document. Parsing requires two stages: decode the attribute, then parse `<InputTrigger>` records. Each record includes `<Trigger>` (event name), `<Function>`, `<Value>`, `<Duration>`, `<Delay>`, `<Mix>`, and a nested `<Input><Key>/<Number>` for target identification.
- Data sources live under `<DataSources><datasources><datasource friendlyName="…"><instance title="…"><tables><table name="…" index="…"/>`.
- Provider-specific configuration and credentials (e.g. `<Google_API_Key>`) live inside each data source's `<state>` subtree. These are treated as secrets.

## Review Mode preset-file tools

Three read-only Review Mode tools expose the saved preset as a complementary source:

- `vmix_read_preset_file` — structured, redacted inventory of scripts, input triggers, data sources, and inputs. Accepts an absolute path to a `.vmix` file or raw XML content. Defaults to compact `summary` output; use `detailMode="full"` only when the complete script source and trigger bodies are needed. Labeled "as last saved".
- `vmix_explain_preset_scripts` — plain-language review and risk flags for saved VB.NET scripts, validated against current live state. Supports filtering to a single named script.
- `vmix_audit_preset_file` — cross-references the saved preset against live vMix state; flags ScriptStart triggers calling missing scripts, triggers targeting absent inputs, and saved-vs-live drift.

## Security and filesystem boundary

- These tools accept only an explicit caller-supplied path or raw content; no directory scanning or auto-discovery.
- Only `.vmix` files are accepted; files over 25 MB are rejected.
- Secrets (API keys, stream keys, Call passwords, passphrases, tokens) are redacted before output. The input GUID (`<Key>`) is not a secret and is never redacted.

## Guidance

- Always label preset-file output as "as last saved" — it may not reflect what vMix is currently running.
- Use `vmix_analyze_preset` for live state (program/preview, audio, overlays, recording). Use the preset-file tools for saved scripts, triggers, and data-source configuration.
- The cross-reference tool (`vmix_audit_preset_file`) is the right first step when a user reports a trigger or script "not working" — it surfaces stale saved references before the user digs into the UI.

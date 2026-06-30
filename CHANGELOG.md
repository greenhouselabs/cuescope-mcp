# Changelog

All notable changes to this project will be documented in this file.

This project follows the spirit of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses semantic versioning.

## [Unreleased]

## [1.0.3] - 2026-06-29

### Fixed

- Script validator now rejects `Sub`/`Function`/`Module`/`Class`/`Structure`/`Namespace`/`Property`/`Enum`/`Interface` definitions: vMix runs a script as a single implicit procedure, so helper-routine definitions cannot compile. `Exit Sub`/`Exit Function` and inline `Function(...)` lambdas remain valid.
- Validator keyword and operator scans (`Thread.Sleep`, `var`, `+` string concatenation, long `Sleep`, `Console.Write`) no longer false-positive on tokens that appear only inside `'` comments or string literals, and a `Sleep()` mentioned only in a comment no longer hides a freeze-prone loop.
- State-aware polling validator accepts a variable `Sleep(interval)` (reported as an info item to confirm the interval is greater than 0) instead of falsely erroring that the loop has no `Sleep()`.

### Added

- Validator warns on bare `CreateObject(...)` (which does not compile in the vMix host) and points to `Microsoft.VisualBasic.Interaction.CreateObject(...)` or `Type.GetTypeFromProgID` + `Activator.CreateInstance`.
- New `knowledge/patterns/scripting/vmix-host-constraints.md` single source of truth for vMix scripting host constraints.
- Script-validator function allowlist updated to recognize 82 vMix 29 shortcut functions — overlay channels 5–8 (`OverlayInput5..8`, `PreviewOverlayInput5..8`), replay C/D channels and quad mode, stinger 5–8, master/bus volume fades (`SetMasterVolumeFade`, `SetBus{A–G}VolumeFade`), OMT source selection, and video-call connect/reconnect — via a curated vMix 29 supplement merged into the generated allowlist (the upstream `vmix-function-list` package is still at v27). Deeper v29 feature support (8/16 overlay channels, master/bus volume-fade adoption) is tracked for a later release.

### Changed

- vMix scripting knowledge (`complex-script-design.md`, `vbnet-basics.md`) replaces helper-function/subroutine guidance with the single-implicit-procedure rule.
- `vmix_generate_script` and `vmix_validate_script` tool descriptions and the server instructions state the single-procedure, no-Console-output, and CreateObject constraints up front.

## [1.0.2] - 2026-06-19

### Added

- Add `vmix_inspect_input`, a live-first Review Mode tool for current input questions such as "what is Input 8", with explicit saved `.vmix` guidance only when scripts, triggers, data-source bindings, or saved-vs-live drift are needed.
- Parse saved GT/title `CountdownXML` and per-title `DataSourcesXML` metadata from `.vmix` input definitions so saved-preset reviews can expose countdown settings and title field data-source bindings, including nested `dataSource` + `mapper` records.
- Add target-input reference summaries to `vmix_audit_preset_file` for saved-preset questions about one input's own triggers, inbound trigger references, and scripts that reference the input.

### Changed

- Clarify tool descriptions and skill guidance so current show/input questions use live state first, while saved-preset tools prefer an explicit server-host `.vmix` path and treat raw XML content as a fallback.
- Clarify saved-preset routing so clients prefer compact one-input summaries before full script dumps, reserving full script review for exact script logic, validation, or rewrite requests.

## [1.0.1] - 2026-06-18

### Changed

- Refresh public launch docs and setup guidance now that the npm package is published.
- Fix CueScope GitHub security-advisory link and remaining stale CuePilot/CueScope launch wording.

## [1.0.0] - 2026-06-16

Initial public release of CueScope.

### Added

- Review-first MCP server compatible with vMix, with read-only advisory tools enabled by default.
- Review Mode tools for preset analysis, input lookup, input explanation, audio diagnosis, script generation, script validation, API sequence planning, XML snapshot comparison, saved preset-file review, go-live preflight checks, show checklists, and connection diagnostics.
- MCP resources for server status, version/build metadata, live state, input fields, audio state, relationships, script context, skills, tally, curated docs, and copilot context.
- Curated vMix knowledge covering the developer API, shortcut functions, scripting, audio buses, vMix Call audio, preset files, production patterns, forum-pattern digests, and review-first examples.
- User-authorable skills through `VMIX_USER_SKILLS_PATH`, merged with bundled vMix skills.
- Production script workflow knowledge from sanitized real-world script evaluations, covering reset-then-promote audio workflows, multiview-driven audio follow, per-slot lower thirds, talkback return routing, sparse layout cleanup, watcher loops, and show-control sequencing.
- Production troubleshooting knowledge and a `vmix-troubleshooting` skill for interpreting pasted errors, explicit log excerpts, Blackmagic/capture-device mismatches, audio-device issues, NDI/network symptoms, and MCP startup failures.
- Source-grounded sanitized troubleshooting corpus examples for capture, audio, NDI, MCP startup, script syntax, and API ambiguity diagnosis.
- `vmix_diagnose_logs` Review Mode tool for bounded diagnosis of pasted log text or one explicit log file, with redaction, confidence-labeled likely causes, safe next checks, and corpus-backed troubleshooting categories.
- State-aware troubleshooting handoff guidance for combining log evidence with connection tests, live state, audio diagnosis, saved preset facts, and script/API validation without overclaiming from any one source.
- Desktop install and first-run smoke-test guidance for source-checkout setup, Claude Desktop, Codex, published-package setup, runtime build-health checks, and Review Mode verification before any control opt-in.
- Review Mode script generators for copy-safe program watchers, slot lower-third row-map scaffolds, talkback return scaffolds, and sparse layout cleanup scaffolds.
- `vmix_preflight` Review Mode go-live readiness report: composes live-state checks into a prioritized verdict (`ready`/`caution`/`not-ready`), with optional `.vmix` preset cross-reference.
- Saved preset-file awareness through `vmix_read_preset_file`, `vmix_explain_preset_scripts`, and `vmix_audit_preset_file`.
- Saved `.vmix` audio and vMix Call metadata parsing, including last-saved input mute/bus flags and raw vMix Call return audio/video fields.
- `vmix_connection_test` diagnostic tool for vMix connectivity.
- `vmix_show_review` Review Mode orchestration tool for natural-language show review, combining live state, audio diagnosis, preflight, checklist guidance, and optional saved-preset context.
- `vmix_diagnose_outputs` Review Mode tool for recording, streaming, external output, video path, audio path, output-like helper inputs, and destination-readiness blind spots.
- A `vmix://tally` resource exposing real-time on-air tally from the TCP subscription.
- MCP prompts for common workflows.
- Published-package MCP setup guidance for Claude Code CLI, Codex CLI, JSON MCP configs, and source-tree development.
- Release checklist, release-candidate test plan, CI, Dependabot, security policy, contribution guide, issue templates, and `.env.example`.
- `--version` and `--help` CLI flags.
- Source-available licensing and third-party notices for the public launch package.

### Changed

- Control tools are gated behind explicit `VMIX_CONTROL_MODE=true`.
- High-impact tools are gated behind `VMIX_CONTROL_MODE=true` plus `VMIX_HIGH_IMPACT=true`.
- Review Mode script generation produces reviewable VB.NET artifacts and does not execute them.
- `vmix_show_build` defaults to dry-run and labels steps that require manual setup.
- `vmix_script_run` rejects ambiguous name-plus-code combinations.
- State cache deduplicates concurrent fetches.
- Boolean environment variables accept `1`/`yes`/`on` and `0`/`no`/`off`, and reject invalid values at startup.
- `LOG_LEVEL` is honored by the HTTP/TCP clients and the state cache.
- `vmix_batch` validates every function name against the official vMix allowlist and bounds batches to 1-50 commands.
- `vmix_switch_preview` pre-validates inputs with smart matching and stable keys.
- `vmix_preset_open` and `vmix_preset_save` require a `.vmix` extension; saving warns about overwrites.
- `vmix://state/live` reports `recordingDurationSeconds`.
- `vmix://state/full` reads through the state cache and prepends a size warning on very large productions.
- The server shuts down cleanly when the MCP client disconnects.
- Saved-preset script review surfaces production risk notes for additive audio routing, incomplete reset coverage, polling loop churn, sibling row-map drift, shared talkback buses, data-source row maps, layout mutation scripts, and high-impact loop actions.
- Script validation treats production-grade but preset-specific constructs as reviewable warnings where possible, instead of treating any single preset as a universal convention.
- `vmix_diagnose_audio` now words shared caller-return bus guidance more precisely: shared returns are caller-safe only when every listener should hear the same mix and caller self-audio cannot fold back.
- `vmix_diagnose_audio` can include optional saved-preset audio evidence from `presetPath` or `presetContent`, while keeping live XML as the current runtime view.
- `vmix_read_preset_file` now defaults to compact `summary` output and supports `detailMode="full"` for complete script source and trigger bodies.
- `vmix_show_review` includes compact saved-preset audit findings when explicit `presetPath` or `presetContent` context is supplied, so natural-language go-live reviews can surface trigger/script drift without a second specialist tool call.
- `vmix_diagnose_outputs` includes a reader-facing readiness summary so idle outputs are described as not armed yet / operator-verification-needed instead of failed.
- `vmix_show_review` now folds in the output-readiness diagnostic summary so broad "check my show" reviews include calibrated recording/streaming/external readiness language.
- `vmix_show_review` includes presentation guidance that reserves blocker/red-alert wording for true blocked categories and labels non-blocking warnings as priority checks or cautions.

### Fixed

- vMix connectivity health check uses GET instead of HEAD.
- TCP socket errors no longer crash the server when vMix TCP is unavailable, and tally subscription reconnects after TCP reconnects.
- Live-state XML parser decodes entities and parses attributed status tags.
- Input key lookup matches the unbraced keys real vMix emits.
- `vmix_audio_bus`, `vmix_output_external`, `vmix_replay_mark_cancel`, and `vmix_participant_add` audio routing call the correct vMix API functions.
- Script validator catches `==` / `!=` comparisons without surrounding whitespace while ignoring string literals and comments.
- HTTP request timeouts abort the underlying request and surface as a dedicated error type.
- Raw `>` inside XML attribute values no longer corrupts state parsing.
- Master/bus volume requests with `fade_ms` apply volume immediately and say so, instead of calling fade functions vMix does not have.
- Validator allowlist is generated from the full official `vmix-function-list` function set.
- Saved-preset script review validates input references against live state plus the saved preset, treating inputs present in neither as warnings rather than blocking errors.

### Security

- Review Mode is read-first by default and does not mutate vMix.
- Review Mode refusals and guidance avoid raw vMix HTTP, shell, or shortcut-function bypasses for gated actions.
- Preset-file reads enforce a filesystem trust boundary: explicit path or content only, no directory scanning, `.vmix` extension checks, size guards, and secret redaction before output.
- Preset secret redaction handles values containing `&`, whitespace, and URL-embedded credentials.
- Saved vMix Call keys from `.vmix` inputs are redacted before preset-derived data leaves the server.
- Troubleshooting guidance and `vmix_diagnose_logs` require explicit pasted text or a caller-supplied log path, avoid directory scanning, bound log reads, and redact secrets before repeating log details.
- vMix Call join URLs are not returned by default.
- Browser input additions are restricted to `http` and `https` URLs.
- vMix Web Controller network exposure risks and mode boundaries are documented.
- Package contents are hardened so raw real-world script corpus files stay local-only while curated knowledge and sanitized corpus guidance ship publicly.
- Vulnerable transitive development dependencies reported by `npm audit` were updated.

---
source_type: example
example_type: script-corpus-guide
last_reviewed: 2026-06-13
---

# Real-World Script Corpus

This folder is reserved for sanitized scripts that have worked in real vMix
productions. These examples teach the MCP what practical vMix scripting looks
like: style, structure, naming, safe waits, large mappings, and operator review
habits.

Do not store secrets here.

Remove or replace:

- vMix Call links and passwords.
- Stream URLs, stream keys, API tokens, and credentials.
- Private IPs, private hostnames, usernames, and local file paths.
- Client names or show names that should not ship publicly.

## Suggested Metadata

Each script example should include a markdown wrapper with:

- Purpose.
- Approximate production context.
- vMix version if known.
- Compatibility level: `copy-ready-basic` or `advanced-structured`.
- Required inputs and title fields.
- Known-good constructs used.
- Known risks or limitations.
- Expected validator result.
- Expected operator review notes.

## Useful First Examples

Prioritize examples in this order:

1. Audio reset / go-live audio normalization.
2. Title update with exact field names.
3. Countdown or timer control.
4. Overlay/lower-third timed sequence.
5. vMix Call or mix-minus helper.
6. Program-change polling script.
7. Large show reset or setup script.
8. Replay or sports scorebug helper.

## Evaluation Use

These scripts are not hidden training data. They should become fixtures and
golden examples:

- Validator tests prove known-good scripts remain accepted.
- Generator tests compare generated style against real operator-readable style.
- Review tests ensure risky constructs are warnings when valid, not blanket
  failures.
- Privacy tests ensure examples and tool output never leak sensitive values.

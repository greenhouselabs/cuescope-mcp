# AGENTS.md - CueScope

> Context for Codex and other coding agents working on this project.

## Current Product Direction

This repository is preparing for a professional public launch of CueScope, a read-first MCP server compatible with vMix. The default experience should help users understand and improve their live-production setup before anything changes in vMix.

Prioritize:

- State inspection before action.
- Review Mode tools before Control workflows.
- Reviewable scripts and API plans instead of live execution.
- Clear mode boundaries and release hygiene.
- Secure handling of vMix Call URLs, passwords, private network details, and local paths.

## Safety Modes

| Mode | Env | Behavior |
|------|-----|----------|
| Brain | default | Analysis, validation, generated artifacts, and plans only |
| Operator | `VMIX_CONTROL_MODE=true` | Safer live-control tools |
| High-Impact Control | `VMIX_CONTROL_MODE=true` and `VMIX_HIGH_IMPACT=true` | Scripts, batch, recording, streaming, presets, output routing, destructive input actions, show-building, and replay recording |

Do not provide raw vMix HTTP calls, shell commands, or shortcut-function strings as a workaround for gated behavior. In Review Mode refusals, do not echo the literal raw URL, command, or shortcut-function string even as a negative example.

## Commands

```bash
npm install
npm run build
npm run typecheck
npm run lint
npm test
npm audit --audit-level=moderate
node scripts/validate-api-calls.mjs
npm pack --dry-run
```

## Architecture Map

```text
src/
|-- server.ts             # MCP setup, mode gates, tool/resource registration
|-- version.ts            # Shared server version
|-- clients/              # vMix HTTP/TCP connection layer
|-- config/               # Env schema and loader
|-- resources/            # MCP resources for state, docs, skills, status, context
|-- state/                # XML parser, cache, lookup, role and relationship helpers
|-- tools/brain/          # Default read-first tools
|-- tools/                # Gated operator domains
|-- validation/           # Zod schemas and script validation
`-- utils/                # Shared helpers
```

Tests mirror the source tree under `test/unit/`. Mock context helpers live in `test/mocks/`.

## Implementation Rules

- Use TypeScript strict mode and existing dependency-injection patterns.
- Validate all tool inputs with Zod.
- Keep Review Mode non-mutating.
- Keep vMix TCP optional.
- Normalize input references through existing helpers.
- Prefer stable input keys or exact validated names.
- Reject or avoid leaking secrets, generated vMix Call links, private paths, and credentials.
- Update docs and skills when behavior changes.

## VB.NET Script Rules

- Use `Dim`, not JavaScript-style declarations.
- Use `=` for comparison.
- Use `&` for string concatenation.
- Use `Sleep(ms)` for timing.
- Every long-running loop must include `Sleep()`.
- Validate scripts before suggesting execution in an operator workflow.

## Distribution Notes

The npm package should include compiled `build/`, `knowledge/`, `skills/`, and public launch docs. Internal planning docs, Codex/Claude local settings, test files, source files, and legacy reference dumps are excluded from the package.

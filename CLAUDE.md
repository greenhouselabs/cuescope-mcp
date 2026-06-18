# CLAUDE.md - CueScope

> Maintainer context for Claude Code and other assistants working in this repository.

## Product Shape

CueScope is a read-first MCP server compatible with vMix. The default product experience is advisory: inspect the user's actual vMix state, explain the setup, diagnose risks, generate reviewable VB.NET scripts, and produce reviewable API plans.

Live-control tools are preserved for advanced users, but they are not the default product:

- Review Mode: default, read-first, no vMix mutation.
- Control Mode: `VMIX_CONTROL_MODE=true`, exposes safer live-control tools.
- High-Impact Control: `VMIX_CONTROL_MODE=true` plus `VMIX_HIGH_IMPACT=true`, exposes scripts, batch commands, recording, streaming, presets, output routing, destructive input actions, show-building, and replay recording.

Do not bypass these mode boundaries with raw HTTP examples, shell commands, or shortcut-function strings. In Review Mode refusals, do not echo the literal raw URL, command, or shortcut-function string even as a negative example.

## Development Commands

```bash
npm install
npm run build
npm run typecheck
npm run lint
npm test
```

Release verification:

```bash
npm run build
npm run typecheck
npm run lint
npm test
npm audit --audit-level=moderate
node scripts/validate-api-calls.mjs
npm pack --dry-run
```

## Architecture

```text
src/
|-- index.ts              # Entry point
|-- server.ts             # MCP server setup, mode gates, tool/resource registration
|-- version.ts            # Shared server/package version
|-- clients/              # vMix HTTP and TCP clients
|-- config/               # Environment parsing and validation
|-- errors/               # Custom error types
|-- resources/            # MCP resources for state, docs, skills, status, context
|-- state/                # XML parser, cache, lookup helpers, normalized relationships
|-- tools/                # Review tools plus gated operator domains
|-- validation/           # VB.NET and schema validation
`-- utils/                # Shared helpers
```

Curated assistant knowledge lives in `knowledge/`. Compact skill guidance lives in `skills/`.

## Tool And Resource Patterns

Tools use `createTool` with Zod schemas and dependency-injected context. Resources use `createResource` and return MCP content objects. Keep new handlers small, domain-focused, and covered by unit tests.

When adding tools:

1. Put the tool in the closest domain under `src/tools/`.
2. Use existing schemas from `src/validation/schemas.ts` where possible.
3. Register through the domain index and central registry.
4. Add or update tests under `test/unit/`.
5. Update skills, knowledge, and README behavior tables when user-visible.

When adding resources:

1. Put the resource in `src/resources/`.
2. Register it in `src/resources/index.ts`.
3. Add tests under `test/unit/resources/`.
4. Document the URI in `README.md` if public.

## vMix Rules To Preserve

- vMix Web Controller normally runs at `http://localhost:8088/api/`.
- TCP tally subscriptions normally run at port `8099` and must remain optional.
- Input names are case-sensitive; prefer stable keys or validated exact names.
- Overlay channels are 1-4.
- vMix Call join URLs and passwords are sensitive.
- Browser inputs should accept only `http` and `https` URLs.
- State cache defaults to 100 ms.

## VB.NET Script Rules

| Rule | Correct | Avoid |
|------|---------|-------|
| Variables | `Dim x As String` | `var x` |
| Comparison | `If x = "True" Then` | `If x == "True" Then` |
| Concatenation | `a & b` | `a + b` |
| Timing | `Sleep(1000)` | `Thread.Sleep(1000)` |
| Loops | `Do While True ... Sleep(100) ... Loop` | Infinite loops without `Sleep()` |

Always validate generated scripts before suggesting operator execution.

## Documentation Expectations

Public docs should lead with Review Mode. Operator and High-Impact Control should be documented as explicit opt-ins with rehearsal and safety language. Keep `README.md`, `DEMO.md`, `MIGRATION.md`, `SECURITY.md`, `CHANGELOG.md`, `skills/`, and relevant `knowledge/` files aligned with behavior changes.

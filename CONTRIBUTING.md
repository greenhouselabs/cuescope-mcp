# Contributing

CueScope is source-available, not open source. Greenhouse Ventures LLC is
not accepting unsolicited code contributions, forks, or feature pull requests at
public launch.

We still welcome:

- security reports through the process in [SECURITY.md](SECURITY.md)
- bug reports with clear reproduction steps
- documentation corrections
- compatibility notes from real vMix setups
- private partnership or commercial licensing inquiries

By submitting issues, suggestions, patches, examples, documentation, or other
materials to Greenhouse Ventures LLC or Greenhouse Labs, you agree to the
feedback and contribution grant in [LICENSE](LICENSE).

## Development Setup

Use these commands for internal development and verification:

```bash
npm install
npm run build
npm run typecheck
npm run lint
npm test
```

Use Node.js 20 or newer.

## Testing

- `npm test` - unit tests. Hermetic: no live vMix required, safe to run anywhere.
- `npm run test:integration` - read-only integration tests against a live vMix instance; the suite self-skips when vMix is unreachable.
- `npm run test:coverage` - unit tests with coverage reporting.

## Release Verification

Run the full local gate before a release:

```bash
npm run build
npm run typecheck
npm run lint
npm test
npm audit --audit-level=moderate
node scripts/validate-api-calls.mjs
npm pack --dry-run
```

For the full release and versioning workflow — branching, CHANGELOG, version
bump, PR, squash-merge, annotated tagging, `npm publish`, and the GitHub release —
see [RELEASING.md](RELEASING.md).

## Product Safety Boundaries

Review Mode is the default. It should inspect state, explain what it sees,
validate scripts, generate reviewable artifacts, and plan API sequences without
mutating vMix.

Control Mode is opt-in through `VMIX_CONTROL_MODE=true`. High-Impact Control is
opt-in through both `VMIX_CONTROL_MODE=true` and `VMIX_HIGH_IMPACT=true`.

Do not bypass those mode boundaries with raw HTTP URLs, shell commands,
generated curl examples, or shortcut-function strings. If a workflow controls
vMix directly, expose it through the appropriate gated tool path and document
the safety implications.

## Code Style

- TypeScript strict mode.
- Zod schemas for tool and config validation.
- Dependency injection through the existing client and state interfaces.
- Keep tools and resources small, domain-focused, and testable.
- Prefer stable input keys or validated exact names when generating vMix scripts or API plans.
- VB.NET loops must include `Sleep()` so generated scripts cannot freeze vMix.

## Documentation

Update user-facing docs, skills, and curated knowledge when behavior changes.
Public docs should describe Review Mode first and mention Control Mode only
where direct control is intentionally relevant.

Avoid documenting secrets, private preset details, vMix Call URLs, or
production-specific credentials.

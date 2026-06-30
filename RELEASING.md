# Releasing CueScope

Maintainer runbook for shipping a new version of `@greenhouselabs/cuescope-mcp`.
This is the documented, repeatable process — follow it for every feature, fix,
and release. (CueScope is source-available; this is for the Greenhouse Labs
maintainer team.)

## Versioning

- **SemVer.** `MAJOR.MINOR.PATCH`:
  - **PATCH** — bug fixes, validator accuracy, docs (e.g. `1.0.3`).
  - **MINOR** — backward-compatible features/tools.
  - **MAJOR** — breaking changes to tool surface or behavior.
- **The version must match in two places:** `package.json` `version` and
  `src/version.ts` `SERVER_VERSION`. Tests assert this — keep them in sync.
- **CHANGELOG.md** follows [Keep a Changelog](https://keepachangelog.com/): an
  `## [Unreleased]` section at top, then `## [X.Y.Z] - YYYY-MM-DD` with
  `### Fixed` / `### Added` / `### Changed` subsections.

## Branching

- `main` is the released/stable branch.
- Do work on a **`release/X.Y.Z`** branch (cut from `main`). Multiple
  features/fixes for the same version can land on the one release branch.
- Never commit feature work directly to `main`.

## Per-change workflow

1. Branch: `git checkout main && git pull && git checkout -b release/X.Y.Z`.
2. Implement with tests (TDD where practical). Small, focused commits.
3. Update `CHANGELOG.md` under `## [X.Y.Z]` (add the section if new).
4. Bump the version in **both** `package.json` and `src/version.ts`.
5. Run the release gate (below) until green.

## Commit conventions

- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, etc.
- Commits are authored by the Greenhouse Labs identity
  (`Greenhouse Labs <admin@greenhouselabs.io>`) — set locally in the repo.
- **No co-author / AI-attribution trailers.** Commit messages carry no
  `Co-Authored-By` lines. (Verify before pushing:
  `git log main..HEAD --format='%B' | grep -ci 'co-authored-by'` should be `0`.)

## Release gate (must be green before publish)

```bash
npm run build
npm run typecheck
npm run lint
npm test
npm audit --audit-level=moderate
node scripts/validate-api-calls.mjs
npm pack --dry-run
```

## Publish

The remote (`origin`) uses the SSH alias `github-greenhouselabs`. `gh` and `npm`
must be authenticated on the publishing machine.

1. **Push** the release branch: `git push -u origin release/X.Y.Z`.
2. **PR** into `main`:
   `gh pr create --base main --head release/X.Y.Z --title "Release CueScope X.Y.Z" --fill`.
3. **Wait for CI green** (Ubuntu Node 20 & 22 + Windows Node 20):
   `gh pr checks <PR#> --watch`.
4. **Squash and merge** into `main` — one clean commit titled
   `Release CueScope X.Y.Z`. (Keeps `main` history one-commit-per-release.)
5. **Update local main:** `git checkout main && git pull`.
6. **Annotated tag** (all release tags are annotated):
   ```bash
   git tag -a vX.Y.Z -m "CueScope X.Y.Z"
   git push origin vX.Y.Z
   ```
7. **Publish to npm** (verify identity first):
   ```bash
   npm whoami            # must be an account with @greenhouselabs publish rights
   npm publish --dry-run # optional: confirm version, file list, public access
   npm publish           # publishConfig.access=public + a prepare-build are configured
   ```
   The package requires npm 2FA — have your OTP ready.
8. **GitHub release** from the tag, using the `[X.Y.Z]` CHANGELOG section as notes:
   `gh release create vX.Y.Z --title "CueScope X.Y.Z" --notes-file <notes.md>`.

## After release

- Delete the merged remote branch: `git push origin --delete release/X.Y.Z`.
- Delete local release/working branches once merged.

## Updating the vMix function allowlist (new vMix versions)

The script-validator allowlist (`src/validation/vmix-functions.generated.ts`) is
generated from the `vmix-function-list` npm package (a devDependency) via
`npm run generate:functions`. That package tracks vMix's official
ShortcutFunctionReference and can lag the latest vMix release.

- **If upstream is current**, just regenerate: bump the devDependency, run
  `npm run generate:functions`, commit the regenerated file.
- **If vMix is ahead of the package** (as in 1.0.3, where vMix was 29 but the
  package was 27): add the net-new function names to
  `scripts/vmix-functions.v29-supplement.mjs` (sourced from
  `https://www.vmix.com/help<N>/ShortcutFunctionReference.html`). The generator
  **unions** the supplement into the package list — additive, so it can never
  drop existing names. Retire supplement entries once the upstream package
  catches up, then regenerate.

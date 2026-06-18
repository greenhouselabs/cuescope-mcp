// Stamps the current git short SHA into src/generated/build-info.ts.
// Runs automatically via the prebuild / pretypecheck / pretest npm hooks, so the
// build marker always reflects the exact commit it was built from. If git is not
// available (e.g. building straight from a tarball), it falls back to "unknown"
// so the build never fails.
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

let sha = 'unknown';
try {
  const out = execSync('git rev-parse --short HEAD', {
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .toString()
    .trim();
  if (out) sha = out;
} catch {
  sha = 'unknown';
}

mkdirSync('src/generated', { recursive: true });
writeFileSync(
  'src/generated/build-info.ts',
  `/* eslint-disable */\n// AUTO-GENERATED at build time by scripts/gen-build-info.mjs. Do not edit or commit.\nexport const BUILD_SHA = '${sha}';\n`
);
console.log(`build-info: BUILD_SHA=${sha}`);

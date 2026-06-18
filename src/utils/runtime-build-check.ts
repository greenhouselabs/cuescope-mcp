import { existsSync, readdirSync, statSync } from 'fs';
import { dirname, join, relative, sep } from 'path';
import { fileURLToPath } from 'url';

const PROCESS_STARTED_AT_MS = Date.now() - process.uptime() * 1000;
const CLOCK_SKEW_TOLERANCE_MS = 1000;

interface FileStamp {
  relativePath: string | null;
  mtime: string | null;
}

interface NewestFile {
  path: string;
  mtimeMs: number;
}

function toIso(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toISOString();
}

function normalizeRelative(path: string | null): string | null {
  return path ? path.split(sep).join('/') : null;
}

function relativePath(root: string, path: string | null): string | null {
  if (!path) return null;
  const value = relative(root, path);
  if (value.startsWith('..') || value === '') return null;
  return normalizeRelative(value);
}

function findProjectRoot(startDir: string): string | null {
  let current = startDir;

  for (let depth = 0; depth < 12; depth++) {
    if (existsSync(join(current, 'package.json'))) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}

function newestFileUnder(dir: string): NewestFile | null {
  if (!existsSync(dir)) return null;

  let newest: NewestFile | null = null;
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = newestFileUnder(path);
      if (nested && (!newest || nested.mtimeMs > newest.mtimeMs)) newest = nested;
      continue;
    }

    if (!entry.isFile()) continue;
    const stat = statSync(path);
    if (!newest || stat.mtimeMs > newest.mtimeMs) {
      newest = { path, mtimeMs: stat.mtimeMs };
    }
  }

  return newest;
}

function fileStamp(root: string, file: NewestFile | null): FileStamp {
  return {
    relativePath: relativePath(root, file?.path ?? null),
    mtime: toIso(file?.mtimeMs ?? null),
  };
}

export function getRuntimeBuildCheck() {
  const modulePath = fileURLToPath(import.meta.url);
  const projectRoot = findProjectRoot(dirname(modulePath)) ?? findProjectRoot(process.cwd());
  const sourceNewest = projectRoot ? newestFileUnder(join(projectRoot, 'src')) : null;
  const buildNewest = projectRoot ? newestFileUnder(join(projectRoot, 'build')) : null;
  const processStartedAt = PROCESS_STARTED_AT_MS;
  const buildMissing = sourceNewest !== null && buildNewest === null;
  const sourceNewerThanBuild =
    sourceNewest !== null &&
    buildNewest !== null &&
    sourceNewest.mtimeMs > buildNewest.mtimeMs + CLOCK_SKEW_TOLERANCE_MS;
  const buildNewerThanProcess =
    buildNewest !== null &&
    buildNewest.mtimeMs > processStartedAt + CLOCK_SKEW_TOLERANCE_MS;
  const buildRecommended = buildMissing || sourceNewerThanBuild;
  const restartRecommended = buildNewerThanProcess;
  const health = buildRecommended
    ? 'build-recommended'
    : restartRecommended
      ? 'restart-recommended'
      : 'current';

  return {
    health,
    recommendations: {
      buildRecommended,
      restartRecommended,
      message: buildMissing
        ? 'Compiled build files were not found. Run npm run build, then start the MCP server.'
        : buildRecommended
        ? 'Source files are newer than compiled build files. Run npm run build, then restart the MCP server.'
        : restartRecommended
          ? 'Compiled build files changed after this MCP process started. Restart the MCP server.'
          : 'Runtime build check is current.',
    },
    runtime: {
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      startedAt: toIso(processStartedAt),
      uptimeSeconds: Number(process.uptime().toFixed(1)),
      entrypoint: relativePath(projectRoot ?? process.cwd(), process.argv[1] ?? null),
    },
    files: {
      newestSource: projectRoot ? fileStamp(projectRoot, sourceNewest) : null,
      newestBuild: projectRoot ? fileStamp(projectRoot, buildNewest) : null,
    },
    checks: {
      sourceNewerThanBuild,
      buildMissing,
      buildNewerThanProcess,
    },
  };
}

/**
 * Obtain raw .vmix XML from an explicit path or supplied content.
 * No filesystem scanning or auto-discovery — the caller authorizes the exact source.
 * When a preset root is configured (VMIX_PRESET_ROOT or an explicit argument),
 * path-based reads are confined to that directory after symlink resolution.
 */
import { readFileSync, realpathSync, statSync } from 'fs';
import { extname, isAbsolute, relative } from 'path';
import { VmixError } from '../../errors/index.js';

/** 25 MB cap — presets are normally well under this. */
const MAX_PRESET_BYTES = 25 * 1024 * 1024;

export interface LoadPresetInput {
  path?: string;
  content?: string;
}

export interface LoadedPreset {
  xml: string;
  path: string | null;
  modifiedAt: string | null;
}

/**
 * Resolve the optional confinement root for path-based preset reads.
 *
 * NOTE: this reads process.env.VMIX_PRESET_ROOT directly at call time. It
 * should migrate to the config schema (src/config) once that schema owns the
 * variable; reading it here keeps the change local to the preset domain.
 * With no root configured the historical behavior (any .vmix path) is kept.
 */
function resolveAllowedRoot(explicitRoot?: string): string | null {
  const configured = explicitRoot ?? process.env.VMIX_PRESET_ROOT;
  const trimmed = configured?.trim() ?? '';
  if (trimmed === '') return null;

  try {
    // Resolve the real path so symlinked roots compare consistently.
    return realpathSync(trimmed);
  } catch {
    throw new VmixError(
      'Configured preset root (VMIX_PRESET_ROOT) does not exist or is not accessible.',
      'PRESET_ROOT_INVALID'
    );
  }
}

/** Prefix containment check on resolved real paths (never on raw user input). */
function isPathWithin(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

export function loadPresetFile(input: LoadPresetInput, allowedRoot?: string): LoadedPreset {
  if (typeof input.content === 'string' && input.content.length > 0) {
    if (input.content.length > MAX_PRESET_BYTES) {
      throw new VmixError('Preset content exceeds the maximum supported size.', 'PRESET_TOO_LARGE');
    }
    return { xml: input.content, path: null, modifiedAt: null };
  }

  const path = input.path?.trim() ?? '';
  if (path === '') {
    throw new VmixError('A preset file path or content is required.', 'PRESET_INPUT_MISSING');
  }

  if (extname(path).toLowerCase() !== '.vmix') {
    throw new VmixError('Preset path must point to a .vmix file.', 'PRESET_BAD_EXTENSION');
  }

  const root = resolveAllowedRoot(allowedRoot);
  let readPath = path;
  if (root !== null) {
    try {
      // realpath follows symlinks, so a link pointing outside the root is rejected.
      readPath = realpathSync(path);
    } catch {
      throw new VmixError(`Preset file not found: ${path}`, 'PRESET_NOT_FOUND');
    }
    if (!isPathWithin(root, readPath)) {
      throw new VmixError(
        'Preset path resolves outside the configured preset root (VMIX_PRESET_ROOT).',
        'PRESET_OUTSIDE_ROOT'
      );
    }
  }

  let stats;
  try {
    stats = statSync(readPath);
  } catch {
    throw new VmixError(`Preset file not found: ${path}`, 'PRESET_NOT_FOUND');
  }

  if (stats.size > MAX_PRESET_BYTES) {
    throw new VmixError('Preset file exceeds the maximum supported size.', 'PRESET_TOO_LARGE');
  }

  return { xml: readFileSync(readPath, 'utf-8'), path, modifiedAt: stats.mtime.toISOString() };
}

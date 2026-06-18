import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { loadPresetFile } from '../../../../src/state/preset/preset-loader.js';
import { VmixError } from '../../../../src/errors/index.js';

const FIXTURES_DIR = join(__dirname, '../../../mocks/fixtures');
const FIXTURE = join(FIXTURES_DIR, 'preset-sample.vmix');

describe('loadPresetFile', () => {
  it('loads xml and metadata from a .vmix path', () => {
    const loaded = loadPresetFile({ path: FIXTURE });
    expect(loaded.xml.length).toBeGreaterThan(0);
    expect(loaded.path).toBe(FIXTURE);
    expect(loaded.modifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('accepts raw content with null path/modifiedAt', () => {
    const xml = readFileSync(FIXTURE, 'utf-8');
    const loaded = loadPresetFile({ content: xml });
    expect(loaded.xml).toBe(xml);
    expect(loaded.path).toBeNull();
    expect(loaded.modifiedAt).toBeNull();
  });

  it('rejects a non-.vmix extension', () => {
    expect(() => loadPresetFile({ path: '/tmp/foo.txt' })).toThrow(VmixError);
  });

  it('rejects a missing file', () => {
    expect(() => loadPresetFile({ path: '/no/such/file.vmix' })).toThrow(VmixError);
  });

  it('rejects empty input', () => {
    expect(() => loadPresetFile({})).toThrow(VmixError);
  });
});

describe('loadPresetFile preset-root confinement', () => {
  let savedRoot: string | undefined;

  beforeEach(() => {
    savedRoot = process.env.VMIX_PRESET_ROOT;
    delete process.env.VMIX_PRESET_ROOT;
  });

  afterEach(() => {
    if (savedRoot === undefined) {
      delete process.env.VMIX_PRESET_ROOT;
    } else {
      process.env.VMIX_PRESET_ROOT = savedRoot;
    }
  });

  it('keeps current behavior when no root is configured', () => {
    const loaded = loadPresetFile({ path: FIXTURE });
    expect(loaded.path).toBe(FIXTURE);
  });

  it('allows paths inside the VMIX_PRESET_ROOT directory', () => {
    process.env.VMIX_PRESET_ROOT = FIXTURES_DIR;
    const loaded = loadPresetFile({ path: FIXTURE });
    expect(loaded.xml.length).toBeGreaterThan(0);
    expect(loaded.path).toBe(FIXTURE);
  });

  it('rejects paths outside the VMIX_PRESET_ROOT directory', () => {
    process.env.VMIX_PRESET_ROOT = join(FIXTURES_DIR, 'user-skills');
    expect(() => loadPresetFile({ path: FIXTURE })).toThrow(/outside the configured preset root/i);
  });

  it('rejects traversal attempts that resolve outside the root', () => {
    process.env.VMIX_PRESET_ROOT = join(FIXTURES_DIR, 'user-skills');
    const traversal = join(FIXTURES_DIR, 'user-skills', '..', 'preset-sample.vmix');
    expect(() => loadPresetFile({ path: traversal })).toThrow(VmixError);
  });

  it('prefers an explicit allowedRoot argument over the env var', () => {
    process.env.VMIX_PRESET_ROOT = join(FIXTURES_DIR, 'user-skills');
    const loaded = loadPresetFile({ path: FIXTURE }, FIXTURES_DIR);
    expect(loaded.path).toBe(FIXTURE);
  });

  it('rejects a configured root that does not exist', () => {
    process.env.VMIX_PRESET_ROOT = join(FIXTURES_DIR, 'no-such-directory');
    expect(() => loadPresetFile({ path: FIXTURE })).toThrow(VmixError);
  });

  it('does not confine explicit content input', () => {
    process.env.VMIX_PRESET_ROOT = join(FIXTURES_DIR, 'user-skills');
    expect(loadPresetFile({ content: '<XML></XML>' }).xml).toBe('<XML></XML>');
  });
});

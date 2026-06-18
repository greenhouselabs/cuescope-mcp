/**
 * Tests for the public-safe troubleshooting corpus.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const corpusPath = join(process.cwd(), 'knowledge', 'examples', 'troubleshooting', 'README.md');
const packageJsonPath = join(process.cwd(), 'package.json');

function readCorpus(): string {
  return readFileSync(corpusPath, 'utf-8');
}

describe('troubleshooting corpus', () => {
  it('includes the planned source-grounded fixture set', () => {
    const text = readCorpus();

    for (const id of [
      'TR-001',
      'TR-002',
      'TR-003',
      'TR-004',
      'TR-005',
      'TR-006',
      'TR-007',
      'TR-008',
      'TR-009',
    ]) {
      expect(text).toContain(id);
    }

    expect(text).toContain('Source Anchors');
    expect(text).toContain('https://www.vmix.com/help28/DeveloperAPI.html');
    expect(text).toContain('https://www.blackmagicdesign.com/support/family/capture-and-playback');
    expect(text).toContain('https://docs.ndi.video/all/using-ndi/ndi-tools/ndi-tools-for-windows/access-manager');
    expect(text).toContain('https://nodejs.org/api/errors.html');
  });

  it('keeps fixtures sanitized and answer-key shaped', () => {
    const text = readCorpus();

    expect(text).not.toMatch(/advanced\.vmixcall\.com/i);
    expect(text).not.toMatch(/streamkey|stream_key|password=/i);
    expect(text).not.toMatch(
      /\b(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/
    );
    expect(text).not.toMatch(/C:\\Users\\[A-Za-z0-9_.-]+\\/);

    const fixtureCount = (text.match(/^## TR-\d{3}/gm) ?? []).length;
    expect(fixtureCount).toBe(9);
    expect((text.match(/Expected summary:/g) ?? []).length).toBe(9);
    expect((text.match(/Safe next checks:/g) ?? []).length).toBe(9);
    expect((text.match(/Must not claim:/g) ?? []).length).toBe(9);
    expect((text.match(/Redaction expectations:/g) ?? []).length).toBe(9);
  });

  it('ships in the public package allowlist', () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
      files?: string[];
    };

    expect(packageJson.files).toContain('knowledge/examples/troubleshooting/');
  });
});

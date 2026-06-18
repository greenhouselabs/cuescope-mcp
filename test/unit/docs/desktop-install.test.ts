/**
 * Tests for desktop install and first-run guidance.
 */

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const desktopInstallPath = new URL('../../../docs/DESKTOP-INSTALL.md', import.meta.url);
const packageJsonPath = new URL('../../../package.json', import.meta.url);

describe('desktop install guide', () => {
  it('documents source-checkout setup and first-run Review Mode smoke tests', async () => {
    const text = await readFile(desktopInstallPath, 'utf8');

    expect(text).toContain('# Desktop Install And First Run');
    expect(text).toContain('Source-checkout setup');
    expect(text).toContain('Claude Desktop: Source Checkout');
    expect(text).toContain('Codex: Source Checkout');
    expect(text).toContain('codex.cmd mcp add cuescope');
    expect(text).toContain('[mcp_servers.cuescope]');
    expect(text).toContain('First-Run Smoke Test');
    expect(text).toContain('vmix_server_version');
    expect(text).toContain('runtimeBuildCheck.health');
    expect(text).toContain('restart-recommended');
    expect(text).toContain('build-recommended');
    expect(text).toContain('Control Mode Is Not A First-Run Step');
    expect(text).toContain('spawn npx ENOENT');
    expect(text).toContain('Connection refused');
  });

  it('ships the desktop install guide in the npm package allowlist', async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
      files?: string[];
    };

    expect(packageJson.files).toContain('docs/DESKTOP-INSTALL.md');
  });
});

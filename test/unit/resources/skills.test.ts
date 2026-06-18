/**
 * Tests for the vmix://skills resource (disk discovery + user-authored skills)
 */

import { describe, expect, it } from 'vitest';
import { join } from 'path';
import { skillsResource } from '../../../src/resources/skills.js';
import { createMockStateCache } from '../../mocks/tool-context.mock.js';
import { createMockVmixClient } from '../../mocks/vmix-client.mock.js';
import { createTestConfig } from '../../../src/config/index.js';
import type { ConfigOverrides } from '../../../src/config/index.js';
import type { ResourceContext } from '../../../src/resources/base.js';

function ctxWith(overrides: ConfigOverrides = {}): ResourceContext {
  return {
    state: createMockStateCache(),
    vmix: createMockVmixClient(),
    config: createTestConfig(overrides),
  };
}

describe('vmix://skills resource', () => {
  it('auto-discovers bundled skills from disk (no hardcoded list)', async () => {
    const result = await skillsResource.handler(ctxWith());
    const text = result.contents[0]?.text ?? '';
    expect(text).toContain('## vmix-basics');
    expect(text).toContain('## vmix-scripting');
    expect(text).toContain('## vmix-troubleshooting');
    expect(text).toContain('Blackmagic');
    expect(text).toContain('State-Aware Escalation Contract');
    expect(text).toContain('Troubleshooting Handoff Report');
    expect(text).toContain('Log evidence');
    expect(text).toContain('State evidence');
    expect(text).toMatch(/bundled skill\(s\) loaded/i);
  });

  it('merges user-authored skills from VMIX_USER_SKILLS_PATH', async () => {
    const userDir = join(process.cwd(), 'test', 'mocks', 'fixtures', 'user-skills');
    const result = await skillsResource.handler(ctxWith({ VMIX_USER_SKILLS_PATH: userDir }));
    const text = result.contents[0]?.text ?? '';
    expect(text).toContain('# User Skills');
    expect(text).toContain('## custom-skill');
    expect(text).toContain('user-authored skill');
  });

  it('handles a missing user skills directory gracefully', async () => {
    const result = await skillsResource.handler(ctxWith({ VMIX_USER_SKILLS_PATH: '/no/such/skills/dir' }));
    const text = result.contents[0]?.text ?? '';
    expect(text).toMatch(/No user skills found/i);
  });
});

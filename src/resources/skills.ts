/**
 * vmix://skills - Review-first guidance skills for vMix.
 *
 * Skills are discovered from disk (no hardcoded list): every `<dir>/<name>/SKILL.md`
 * under the bundled skills directory is loaded. Users can add their own skills by
 * pointing VMIX_USER_SKILLS_PATH at a directory of `<name>/SKILL.md` folders — those
 * are merged in addition to the bundled ones, with no code change required.
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createResource, markdownContent, type ResourceContext } from './base.js';

const RESOURCE_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(RESOURCE_DIR, '..', '..');
const BUNDLED_SKILLS_ROOT = join(PACKAGE_ROOT, 'skills');

interface DiscoveredSkill {
  name: string;
  path: string;
}

/** Find every `<dir>/<name>/SKILL.md`, sorted by name. A missing/unreadable dir yields []. */
function discoverSkills(dir: string): DiscoveredSkill[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const skills: DiscoveredSkill[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillPath = join(dir, entry.name, 'SKILL.md');
    if (existsSync(skillPath)) {
      skills.push({ name: entry.name, path: skillPath });
    }
  }
  return skills.sort((left, right) => left.name.localeCompare(right.name));
}

function renderSkills(skills: DiscoveredSkill[]): string {
  let out = '';
  for (const skill of skills) {
    try {
      out += `## ${skill.name}\n\n${readFileSync(skill.path, 'utf-8')}\n\n---\n\n`;
    } catch {
      out += `## ${skill.name}\n\n> Error reading skill file: ${skill.path}\n\n---\n\n`;
    }
  }
  return out;
}

export const skillsResource = createResource({
  name: 'vMix Skills',
  uri: 'vmix://skills',
  description: 'Available CueScope skills - Review-first guidance files (bundled plus user-authored)',
  mimeType: 'text/markdown',
  handler: (ctx: ResourceContext) => {
    const bundledDir = ctx.config.SKILLS_PATH ?? BUNDLED_SKILLS_ROOT;
    const bundled = discoverSkills(bundledDir);

    let content =
      '# CueScope Skills\n\nSkills provide Review-first guidance for vMix analysis, diagnosis, reviewable automation, and explicit control workflows.\n\n';

    if (bundled.length > 0) {
      content += `${bundled.length} bundled skill(s) loaded.\n\n${renderSkills(bundled)}`;
    } else {
      content += `> No bundled skills found at: ${bundledDir}\n\n`;
    }

    const userDir = ctx.config.VMIX_USER_SKILLS_PATH;
    if (userDir) {
      const userSkills = discoverSkills(userDir);
      content += '# User Skills\n\n';
      content +=
        userSkills.length > 0
          ? `${userSkills.length} user skill(s) loaded from ${userDir}.\n\n${renderSkills(userSkills)}`
          : `> No user skills found at: ${userDir} (expected <dir>/<name>/SKILL.md).\n\n`;
    }

    return Promise.resolve({
      contents: [markdownContent('vmix://skills', content)],
    });
  },
});

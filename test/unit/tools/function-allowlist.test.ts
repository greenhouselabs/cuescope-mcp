/**
 * Regression guard: every vMix function name written as a literal in
 * src/tools must exist in the official vMix function allowlist
 * (src/validation/vmix-functions.generated.ts).
 *
 * Covers:
 * - execute('FunctionName', ...) string literals
 * - execute(`Template${...}`) template literals at the callsite (expanded with
 *   representative values)
 *
 * Names composed into variables before the execute() call cannot all be
 * resolved statically - those are covered at runtime by asserting recorded
 * mock calls via expectExecutedFunctionsAllowlisted (allowlist-helper.ts),
 * and by scripts/validate-api-calls.mjs which traces variable assignments.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAllowlistedVmixFunction } from '../../../src/validation/script-validator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = path.resolve(__dirname, '../../../src/tools');

function findTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

/** Expand one template literal into representative concrete names. */
function expandTemplate(template: string): string[] {
  const placeholder = template.match(/\$\{([^}]*)\}/);
  if (!placeholder) return [template];

  const expr = placeholder[1] ?? '';
  let alternatives: string[];

  const quoted = [...expr.matchAll(/['"]([A-Za-z0-9]+)['"]/g)].map((m) => m[1]!);
  if (quoted.length > 0) {
    alternatives = quoted;
  } else if (/SetOutput\$\{/i.test(template)) {
    alternatives = ['2', '3', '4'];
  } else if (/Channel\$\{/i.test(template)) {
    alternatives = ['A', 'B'];
  } else if (/direction/i.test(expr)) {
    alternatives = ['Up', 'Down'];
  } else if (/bus|target/i.test(expr)) {
    alternatives = ['A', 'G'];
  } else {
    alternatives = ['1'];
  }

  const results: string[] = [];
  for (const alt of alternatives) {
    results.push(...expandTemplate(template.replace(placeholder[0], alt)));
    if (results.length > 32) break;
  }
  return results;
}

/** Function-name shaped: stripping placeholders leaves a PascalCase identifier. */
function isFunctionNameShaped(template: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(template.replace(/\$\{[^}]*\}/g, ''));
}

interface FoundCall {
  file: string;
  name: string;
}

function extractLiteralCalls(filePath: string): FoundCall[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relative = path.relative(TOOLS_DIR, filePath);
  const calls: FoundCall[] = [];

  // execute('FunctionName' / execute("FunctionName"
  for (const match of content.matchAll(/\.execute\s*\(\s*['"]([^'"`$]+)['"]/g)) {
    calls.push({ file: relative, name: match[1]! });
  }

  // execute(`Template${...}`) at the callsite
  for (const match of content.matchAll(/\.execute\s*\(\s*`([^`]+)`/g)) {
    const template = match[1]!;
    if (!isFunctionNameShaped(template)) continue;
    for (const expanded of expandTemplate(template)) {
      calls.push({ file: relative, name: expanded });
    }
  }

  return calls;
}

describe('vMix function allowlist (static scan of src/tools)', () => {
  const files = findTsFiles(TOOLS_DIR);

  it('finds tool source files to scan', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('only executes function names from the official vMix allowlist', () => {
    const violations: string[] = [];

    for (const file of files) {
      for (const call of extractLiteralCalls(file)) {
        if (!isAllowlistedVmixFunction(call.name)) {
          violations.push(`${call.file}: "${call.name}"`);
        }
      }
    }

    expect(violations, `Unknown vMix function names found:\n${violations.join('\n')}`).toEqual([]);
  });

  it('finds a meaningful number of literal execute() calls', () => {
    const total = files.flatMap((f) => extractLiteralCalls(f)).length;
    expect(total).toBeGreaterThan(50);
  });
});

describe('isAllowlistedVmixFunction', () => {
  it('accepts known functions case-insensitively', () => {
    expect(isAllowlistedVmixFunction('Cut')).toBe(true);
    expect(isAllowlistedVmixFunction('audiobuson')).toBe(true);
    expect(isAllowlistedVmixFunction('StartExternal')).toBe(true);
    expect(isAllowlistedVmixFunction('ReplayMarkCancel')).toBe(true);
  });

  it('accepts pattern families (layers, PTZ, outputs, overlays, bus audio)', () => {
    expect(isAllowlistedVmixFunction('SetLayer3Zoom')).toBe(true);
    expect(isAllowlistedVmixFunction('PTZMoveUpLeft')).toBe(true);
    expect(isAllowlistedVmixFunction('SetOutput3')).toBe(true);
    expect(isAllowlistedVmixFunction('OverlayInput4Out')).toBe(true);
    expect(isAllowlistedVmixFunction('BusGAudioOn')).toBe(true);
  });

  it('rejects the broken names from the audit', () => {
    expect(isAllowlistedVmixFunction('AudioBusAOn')).toBe(false);
    expect(isAllowlistedVmixFunction('SetOutputExternal2On')).toBe(false);
    expect(isAllowlistedVmixFunction('SetMasterVolumeFade')).toBe(false);
    expect(isAllowlistedVmixFunction('SetBusAVolumeFade')).toBe(false);
    expect(isAllowlistedVmixFunction('DataSourceAutoNextPlay')).toBe(false);
  });

  it('rejects unknown and empty names', () => {
    expect(isAllowlistedVmixFunction('NotARealFunction')).toBe(false);
    expect(isAllowlistedVmixFunction('')).toBe(false);
  });
});

/**
 * Generate src/validation/vmix-functions.generated.ts from the official
 * vmix-function-list package (a devDependency). Committing the output keeps the
 * runtime validator dependency-free — the published server never pulls in
 * vmix-function-list (and its axios/lodash/xpath deps).
 *
 * Usage: npm run generate:functions
 */
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import V from 'vmix-function-list';
import { V29_SUPPLEMENT } from './vmix-functions.v29-supplement.mjs';

const require = createRequire(import.meta.url);
const version = require('vmix-function-list/package.json').version;

const Cls = V.default || V;
const all = new Cls().all();
const names = [...new Set([
  ...all.map((f) => f.function.toLowerCase()),
  ...V29_SUPPLEMENT.map((n) => n.toLowerCase()),
])].sort();

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '..', 'src', 'validation', 'vmix-functions.generated.ts');

const header = `/**
 * AUTO-GENERATED FILE — do not edit by hand.
 *
 * Lowercased official vMix shortcut-function names, used as the script-validator
 * allowlist. Source: vmix-function-list@${version} plus a curated vMix 29
 * supplement (scripts/vmix-functions.v29-supplement.mjs, ${V29_SUPPLEMENT.length} names).
 * Regenerate with: npm run generate:functions
 */
`;
const body =
  `export const VMIX_FUNCTION_NAMES: readonly string[] = [\n` +
  names.map((n) => `  '${n}',`).join('\n') +
  `\n];\n`;

writeFileSync(outPath, `${header}\n${body}`, 'utf-8');
console.log(`Wrote ${names.length} function names (vmix-function-list@${version} + ${V29_SUPPLEMENT.length} v29 supplement) to ${outPath}`);

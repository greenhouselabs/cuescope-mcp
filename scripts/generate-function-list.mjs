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

const require = createRequire(import.meta.url);
const version = require('vmix-function-list/package.json').version;

const Cls = V.default || V;
const all = new Cls().all();
const names = [...new Set(all.map((f) => f.function.toLowerCase()))].sort();

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '..', 'src', 'validation', 'vmix-functions.generated.ts');

const header = `/**
 * AUTO-GENERATED FILE — do not edit by hand.
 *
 * Lowercased official vMix shortcut-function names, used as the script-validator
 * allowlist. Source: vmix-function-list@${version}.
 * Regenerate with: npm run generate:functions
 */
`;
const body =
  `export const VMIX_FUNCTION_NAMES: readonly string[] = [\n` +
  names.map((n) => `  '${n}',`).join('\n') +
  `\n];\n`;

writeFileSync(outPath, `${header}\n${body}`, 'utf-8');
console.log(`Wrote ${names.length} function names (from vmix-function-list@${version}) to ${outPath}`);

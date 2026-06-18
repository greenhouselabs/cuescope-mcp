/**
 * Validate all vMix API calls in the codebase against official function list
 *
 * Usage: npx ts-node scripts/validate-api-calls.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import vmixFunctions from 'vmix-function-list';

// Get all functions
const allFunctions = vmixFunctions.all();
type VmixFunctionEntry = (typeof allFunctions)[number];
const functionMap = new Map<string, VmixFunctionEntry>();

// Build lookup map (case-insensitive)
for (const func of allFunctions) {
  functionMap.set(func.function.toLowerCase(), func);
}

console.log(`Loaded ${allFunctions.length} vMix functions from official list\n`);

// Categories summary
const categories = new Set(allFunctions.map((f: VmixFunctionEntry) => f.category));
console.log('Categories:', Array.from(categories).join(', '));
console.log('');

// Find all .ts files in src/tools
function findTsFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

// Extract API calls from source code
interface ApiCall {
  file: string;
  line: number;
  function: string;
  params: string[];
}

function extractApiCalls(filePath: string): ApiCall[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const calls: ApiCall[] = [];

  // Pattern: ctx.vmix.http.execute('FunctionName', { ... })
  // Or: await ctx.vmix.http.execute('FunctionName', ...)
  const executePattern = /\.execute\s*\(\s*['"`]([^'"`]+)['"`]/g;

  // Pattern for template literals: `SetLayer${num}Zoom`
  const templatePattern = /\.execute\s*\(\s*`([^`]+)`/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Regular string matches
    let match;
    while ((match = executePattern.exec(line)) !== null) {
      calls.push({
        file: filePath,
        line: i + 1,
        function: match[1],
        params: extractParams(line),
      });
    }

    // Template literal matches (extract base function name)
    while ((match = templatePattern.exec(line)) !== null) {
      const template = match[1];
      // Extract static parts, e.g., "SetLayer${num}Zoom" -> "SetLayer1Zoom"
      const staticName = template
        .replace(/\$\{[^}]+\}/g, '1')  // Replace ${...} with 1
        .replace(/\$\{[^}]+\}/g, '');

      calls.push({
        file: filePath,
        line: i + 1,
        function: staticName,
        params: extractParams(line),
      });
    }
  }

  return calls;
}

function extractParams(line: string): string[] {
  // Simple extraction of parameter names from { Key: value } patterns
  const paramPattern = /(\w+)\s*:/g;
  const params: string[] = [];
  let match;

  // Skip 'type' and 'text' which are MCP response fields
  while ((match = paramPattern.exec(line)) !== null) {
    const param = match[1];
    if (!['type', 'text', 'content', 'isError'].includes(param)) {
      params.push(param);
    }
  }

  return params;
}

// Validate a function call
interface ValidationResult {
  valid: boolean;
  function: string;
  file: string;
  line: number;
  issues: string[];
  officialParams?: string[];
}

function validateCall(call: ApiCall): ValidationResult {
  const funcName = call.function.toLowerCase();
  const official = functionMap.get(funcName);

  if (!official) {
    // Check if it's a layer function pattern
    const layerMatch = funcName.match(/^setlayer(\d+)(zoom|panx|pany|x|y|width|height|crop.*)$/i);
    if (layerMatch) {
      // These are valid layer functions
      return {
        valid: true,
        function: call.function,
        file: call.file,
        line: call.line,
        issues: [],
        officialParams: ['Input', 'Value'],
      };
    }

    return {
      valid: false,
      function: call.function,
      file: call.file,
      line: call.line,
      issues: [`Function "${call.function}" not found in official vMix function list`],
    };
  }

  const issues: string[] = [];
  const officialParams = Object.keys(official.parameters || {});

  // Check for required parameters
  // (This is a basic check - we'd need more context for full validation)

  return {
    valid: issues.length === 0,
    function: call.function,
    file: call.file,
    line: call.line,
    issues,
    officialParams,
  };
}

// Main
const srcDir = path.join(process.cwd(), 'src', 'tools');
const files = findTsFiles(srcDir);

console.log(`\nScanning ${files.length} files in src/tools/...\n`);

const allCalls: ApiCall[] = [];
for (const file of files) {
  const calls = extractApiCalls(file);
  allCalls.push(...calls);
}

// Deduplicate by function name
const uniqueFunctions = new Map<string, ApiCall>();
for (const call of allCalls) {
  const key = call.function.toLowerCase();
  if (!uniqueFunctions.has(key)) {
    uniqueFunctions.set(key, call);
  }
}

console.log(`Found ${allCalls.length} API calls (${uniqueFunctions.size} unique functions)\n`);

// Validate each unique function
const results: ValidationResult[] = [];
for (const [, call] of uniqueFunctions) {
  results.push(validateCall(call));
}

// Report
const valid = results.filter(r => r.valid);
const invalid = results.filter(r => !r.valid);

console.log('='.repeat(60));
console.log('VALIDATION RESULTS');
console.log('='.repeat(60));

console.log(`\n✓ Valid functions: ${valid.length}`);
console.log(`✗ Invalid/Unknown functions: ${invalid.length}\n`);

if (invalid.length > 0) {
  console.log('INVALID FUNCTIONS:');
  console.log('-'.repeat(40));
  for (const r of invalid) {
    const relPath = path.relative(process.cwd(), r.file);
    console.log(`\n✗ ${r.function}`);
    console.log(`  File: ${relPath}:${r.line}`);
    for (const issue of r.issues) {
      console.log(`  Issue: ${issue}`);
    }
  }
}

console.log('\n');
console.log('VALID FUNCTIONS USED:');
console.log('-'.repeat(40));
for (const r of valid.sort((a, b) => a.function.localeCompare(b.function))) {
  console.log(`✓ ${r.function}`);
}

// Summary by category
console.log('\n');
console.log('FUNCTIONS BY CATEGORY:');
console.log('-'.repeat(40));
const byCategory = new Map<string, string[]>();
for (const r of valid) {
  const official = functionMap.get(r.function.toLowerCase());
  const category = official?.category || 'Layer';
  if (!byCategory.has(category)) {
    byCategory.set(category, []);
  }
  byCategory.get(category)!.push(r.function);
}
for (const [category, funcs] of Array.from(byCategory.entries()).sort()) {
  console.log(`\n${category}:`);
  for (const f of funcs.sort()) {
    console.log(`  - ${f}`);
  }
}

// Exit with error code if invalid functions found
process.exit(invalid.length > 0 ? 1 : 0);

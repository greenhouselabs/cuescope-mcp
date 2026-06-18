/**
 * Validate all vMix API calls in the codebase against official function list
 *
 * Usage: node scripts/validate-api-calls.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import VmixFunctionListClass from 'vmix-function-list';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Get all functions - it's a class that needs to be instantiated
const VmixFunctionList = VmixFunctionListClass.default || VmixFunctionListClass;
const vmixFunctions = new VmixFunctionList();
const allFunctions = vmixFunctions.all();
const functionMap = new Map();

// Build lookup map (case-insensitive)
for (const func of allFunctions) {
  functionMap.set(func.function.toLowerCase(), func);
}

console.log(`Loaded ${allFunctions.length} vMix functions from official list\n`);

// Categories summary
const categories = new Set(allFunctions.map(f => f.category));
console.log('Categories:', Array.from(categories).join(', '));
console.log('');

// Find all .ts files in src/tools
function findTsFiles(dir) {
  const files = [];
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

// Expand a template literal like `AudioBus${bus}${enabled ? 'On' : 'Off'}` into
// concrete candidate function names. Placeholders that contain quoted string
// alternatives (ternaries) expand to each alternative; other placeholders use
// pattern heuristics.
function expandTemplate(template) {
  const placeholder = template.match(/\$\{([^}]*)\}/);
  if (!placeholder) {
    return [template];
  }

  const expr = placeholder[1];
  let alternatives = [];

  // Placeholder contains quoted strings (e.g. `${enabled ? 'On' : 'Off'}`) - use them
  const quoted = [...expr.matchAll(/['"]([A-Za-z0-9]+)['"]/g)].map((m) => m[1]);
  if (quoted.length > 0) {
    alternatives = quoted;
  } else if (template.match(/SetOutput\$\{/i)) {
    alternatives = ['2', '3', '4'];
  } else if (template.match(/Channel\$\{/i)) {
    alternatives = ['A', 'B'];
  } else if (/direction/i.test(expr)) {
    alternatives = ['Up', 'Down'];
  } else if (/bus|target/i.test(expr) || /(^|[^A-Za-z])Bus\$\{/.test(template)) {
    // Bus letter placeholders (SetBus${target}Volume, Bus${target}Audio, ...)
    alternatives = ['A', 'G'];
  } else {
    // Numeric placeholders (layer numbers, overlay channels, camera numbers, ...)
    alternatives = ['1'];
  }

  const results = [];
  for (const alt of alternatives) {
    const expanded = template.replace(placeholder[0], alt);
    results.push(...expandTemplate(expanded)); // expand remaining placeholders
    if (results.length > 32) break; // safety cap
  }
  return results;
}

// Does this look like a function name template once placeholders are removed?
// (Filters out non-function templates like `${name} Camera` or `Colour|${value}`.)
function isFunctionNameShaped(template) {
  const remainder = template.replace(/\$\{[^}]*\}/g, '');
  return /^[A-Z][A-Za-z0-9]*$/.test(remainder);
}

// Extract candidate function-name literals from an assignment right-hand side.
// Handles plain literals, ternaries, template literals, and map lookups.
function extractCandidatesFromRhs(rhs, content) {
  // String concatenation with a runtime identifier - cannot be checked statically.
  // (Runtime tests assert recorded mock calls against the allowlist instead.)
  const withoutLiterals = rhs
    .replace(/`[^`]*`/g, '``')
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""');
  if (/\+\s*[A-Za-z_$(]/.test(withoutLiterals) || /[A-Za-z_$)\]]\s*\+/.test(withoutLiterals)) {
    return [];
  }

  const candidates = [];

  // Template literals (taken from the full RHS so a `?` inside a placeholder
  // is not mistaken for a ternary operator)
  for (const match of rhs.matchAll(/`([^`]+)`/g)) {
    const template = match[1];
    if (!isFunctionNameShaped(template)) continue;
    for (const expanded of expandTemplate(template)) {
      candidates.push({ name: expanded, isTemplate: true, template });
    }
  }

  // For plain string literals, remove template literals first, then strip a
  // leading ternary condition so comparison literals (e.g. `action === 'start'`)
  // are not treated as function names.
  const rhsNoTemplates = rhs.replace(/`[^`]*`/g, '``');
  const questionIndex = rhsNoTemplates.indexOf('?');
  const valuePart = questionIndex >= 0 ? rhsNoTemplates.slice(questionIndex + 1) : rhsNoTemplates;

  for (const match of valuePart.matchAll(/['"]([A-Za-z][A-Za-z0-9]{2,})['"]/g)) {
    if (/^[A-Z]/.test(match[1])) {
      candidates.push({ name: match[1], isTemplate: false });
    }
  }

  // Map lookup (e.g. `ACTION_TO_FUNCTION[action]`): extract the map's string values
  const mapLookup = rhs.match(/([A-Za-z_$][\w$]*)\s*\[/);
  if (mapLookup) {
    const mapName = mapLookup[1];
    const mapDef = content.match(
      new RegExp(`(?:const|let|var)\\s+${mapName}\\b[^=]*=\\s*\\{([\\s\\S]*?)\\}\\s*;`)
    );
    if (mapDef) {
      for (const valueMatch of mapDef[1].matchAll(/:\s*['"]([A-Za-z][A-Za-z0-9]{2,})['"]/g)) {
        if (/^[A-Z]/.test(valueMatch[1])) {
          candidates.push({ name: valueMatch[1], isTemplate: false });
        }
      }
    }
  }

  return candidates;
}

// Extract API calls from source code
function extractApiCalls(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const calls = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Pattern: .execute('FunctionName', ...)
    const matches = line.matchAll(/\.execute\s*\(\s*['"]([^'"`$]+)['"]/g);
    for (const match of matches) {
      calls.push({
        file: filePath,
        line: i + 1,
        function: match[1],
      });
    }

    // Pattern for template literals at the callsite: .execute(`SetLayer${num}Zoom`)
    const templateMatches = line.matchAll(/\.execute\s*\(\s*`([^`]+)`/g);
    for (const match of templateMatches) {
      const template = match[1];
      for (const staticName of expandTemplate(template)) {
        calls.push({
          file: filePath,
          line: i + 1,
          function: staticName,
          isTemplate: true,
          template: template,
        });
      }
    }
  }

  // Variable-assigned function names: `const func = enabled ? 'X' : 'Y'; ... execute(func)`.
  // The callsite-only patterns above miss these (this is how the broken
  // AudioBus${bus}On / SetOutputExternal2On names slipped through).
  const executeVarNames = new Set();
  for (const match of content.matchAll(/\.execute\s*\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g)) {
    executeVarNames.add(match[1]);
  }

  for (const varName of executeVarNames) {
    // Declarations and reassignments of the variable, RHS up to the terminating ';'
    const assignmentPattern = new RegExp(
      `(?:^|[^.\\w])${varName}\\s*(?::[^=\\n]*)?=(?!=)([\\s\\S]*?);`,
      'g'
    );
    for (const match of content.matchAll(assignmentPattern)) {
      const lineNumber = content.slice(0, match.index).split('\n').length;
      for (const candidate of extractCandidatesFromRhs(match[1], content)) {
        calls.push({
          file: filePath,
          line: lineNumber,
          function: candidate.name,
          isTemplate: candidate.isTemplate,
          template: candidate.template,
          viaVariable: varName,
        });
      }
    }
  }

  return calls;
}

// Validate a function call
function validateCall(call) {
  const funcName = call.function.toLowerCase();
  const official = functionMap.get(funcName);

  if (official) {
    return {
      valid: true,
      function: call.function,
      file: call.file,
      line: call.line,
      category: official.category,
      description: official.description,
      parameters: Object.keys(official.parameters || {}),
    };
  }

  // Check if it's a layer function pattern (SetLayer1Zoom, SetLayer2PanX, etc.)
  const layerMatch = funcName.match(/^setlayer(\d+)(zoom|panx|pany|x|y|width|height|crop.*)$/i);
  if (layerMatch) {
    return {
      valid: true,
      function: call.function,
      file: call.file,
      line: call.line,
      category: 'Layer',
      description: `Layer ${layerMatch[1]} ${layerMatch[2]} control`,
      parameters: ['Input', 'Value'],
    };
  }

  // Check if it's a PTZ movement function (PTZMoveUp, PTZMoveDown, etc.)
  const ptzMoveMatch = funcName.match(/^ptzmove(up|down|left|right|upleft|upright|downleft|downright|stop)$/i);
  if (ptzMoveMatch) {
    return {
      valid: true,
      function: call.function,
      file: call.file,
      line: call.line,
      category: 'PTZ',
      description: `PTZ Move ${ptzMoveMatch[1]}`,
      parameters: ['Input', 'Value'],
    };
  }

  // Check if it's a SetOutput function (SetOutput2, SetOutput3, SetOutput4)
  const outputMatch = funcName.match(/^setoutput([234])$/i);
  if (outputMatch) {
    return {
      valid: true,
      function: call.function,
      file: call.file,
      line: call.line,
      category: 'Output',
      description: `Set Output ${outputMatch[1]}`,
      parameters: ['Value', 'Input'],
    };
  }

  // Check if it's a bus audio (mute) function family. The generated list only
  // includes BusAAudio/BusBAudio, but vMix documents the family as BusXAudio for X = A-G.
  const busAudioMatch = funcName.match(/^bus([a-g])audio(on|off)?$/i);
  if (busAudioMatch) {
    return {
      valid: true,
      function: call.function,
      file: call.file,
      line: call.line,
      category: 'Audio',
      description: `Bus ${busAudioMatch[1].toUpperCase()} audio ${busAudioMatch[2] ?? 'toggle'}`,
      parameters: [],
    };
  }

  // Check if it's a ReplaySelectChannel function (ReplaySelectChannelA, ReplaySelectChannelB)
  const replayChannelMatch = funcName.match(/^replayselectchannel([ab])$/i);
  if (replayChannelMatch) {
    return {
      valid: true,
      function: call.function,
      file: call.file,
      line: call.line,
      category: 'Replay',
      description: `Select Replay Channel ${replayChannelMatch[1].toUpperCase()}`,
      parameters: [],
    };
  }

  // Check if it's a ReplayCamera function (ReplayCamera1-8)
  const replayCameraMatch = funcName.match(/^replaycamera([1-8])$/i);
  if (replayCameraMatch) {
    return {
      valid: true,
      function: call.function,
      file: call.file,
      line: call.line,
      category: 'Replay',
      description: `Select Replay Camera ${replayCameraMatch[1]}`,
      parameters: [],
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

// Main
const srcDir = path.join(rootDir, 'src', 'tools');
const files = findTsFiles(srcDir);

console.log(`Scanning ${files.length} files in src/tools/...\n`);

const allCalls = [];
for (const file of files) {
  const calls = extractApiCalls(file);
  allCalls.push(...calls);
}

// Deduplicate by function name
const uniqueFunctions = new Map();
for (const call of allCalls) {
  const key = call.function.toLowerCase();
  if (!uniqueFunctions.has(key)) {
    uniqueFunctions.set(key, call);
  }
}

console.log(`Found ${allCalls.length} API calls (${uniqueFunctions.size} unique functions)\n`);

// Validate each unique function
const results = [];
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
    const relPath = path.relative(rootDir, r.file);
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
  const params = r.parameters ? ` (${r.parameters.join(', ')})` : '';
  console.log(`✓ ${r.function}${params}`);
}

// Summary by category
console.log('\n');
console.log('FUNCTIONS BY CATEGORY:');
console.log('-'.repeat(40));
const byCategory = new Map();
for (const r of valid) {
  const category = r.category || 'Unknown';
  if (!byCategory.has(category)) {
    byCategory.set(category, []);
  }
  byCategory.get(category).push(r.function);
}
for (const [category, funcs] of Array.from(byCategory.entries()).sort()) {
  console.log(`\n${category}: (${funcs.length})`);
  for (const f of funcs.sort()) {
    console.log(`  - ${f}`);
  }
}

console.log('\n');
console.log('='.repeat(60));
if (invalid.length > 0) {
  console.log(`⚠ VALIDATION FAILED: ${invalid.length} invalid function(s) found`);
} else {
  console.log('✓ VALIDATION PASSED: All functions are valid');
}
console.log('='.repeat(60));

// Exit with error code if invalid functions found
process.exit(invalid.length > 0 ? 1 : 0);

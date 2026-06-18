/**
 * VB.NET script validation for vMix
 * Catches common errors before execution
 */

import { VMIX_FUNCTION_NAMES } from './vmix-functions.generated.js';

const VMIX_FUNCTION_ALLOWLIST = new Set(VMIX_FUNCTION_NAMES);

/**
 * Check a vMix shortcut-function name against the official v27 allowlist.
 * Includes pattern fallbacks for families the generated list represents
 * generically (numbered layers, PTZ moves, outputs, replay channels/cameras).
 */
export function isAllowlistedVmixFunction(functionName: string): boolean {
  const lower = functionName.trim().toLowerCase();
  if (lower.length === 0) return false;

  if (VMIX_FUNCTION_ALLOWLIST.has(lower)) return true;
  if (/^overlayinput[1-4](in|out)$/.test(lower)) return true;
  // Generated list only includes BusA/BusB audio toggles, but vMix documents
  // the family as BusXAudio for X = A-G.
  if (/^bus[a-g]audio(on|off)?$/.test(lower)) return true;
  if (/^setlayer\d+(zoom|panx|pany|x|y|width|height|crop.*)$/.test(lower)) return true;
  if (/^ptzmove(up|down|left|right|upleft|upright|downleft|downright|stop)$/.test(lower)) return true;
  if (/^setoutput[234]$/.test(lower)) return true;
  if (/^replayselectchannel[ab]$/.test(lower)) return true;
  if (/^replaycamera[1-8]$/.test(lower)) return true;

  return false;
}

/**
 * Strip VB.NET string literals and trailing comments from a single line of code,
 * so syntax scans don't false-positive on operators inside strings or comments.
 * Handles the VB escaped quote ("" inside a string).
 */
function stripStringsAndComments(line: string): string {
  let out = '';
  let inString = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inString) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          i++; // escaped quote inside string - stay in string
          continue;
        }
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "'") {
      // Rest of line is a VB comment
      break;
    }

    out += ch;
  }

  return out;
}

/**
 * Script validation result
 */
export interface ScriptValidationResult {
  /** Whether the script is valid and safe to execute */
  valid: boolean;
  /** Errors that must be fixed (script won't work) */
  errors: string[];
  /** Warnings that should be addressed (script may work but has issues) */
  warnings: string[];
}

/**
 * Validate a vMix VB.NET script
 *
 * Checks for common mistakes that would cause:
 * - Syntax errors (wrong VB.NET syntax)
 * - Runtime errors (wrong API usage)
 * - vMix freezes (infinite loops without Sleep)
 *
 * @param script The VB.NET script to validate
 * @returns Validation result with errors and warnings
 */
export function validateVmixScript(script: string): ScriptValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ==========================================================================
  // ERRORS - Script will fail or cause problems
  // ==========================================================================

  // Thread.Sleep instead of Sleep
  if (/Thread\.Sleep/i.test(script)) {
    errors.push(
      'Use Sleep() instead of Thread.Sleep(). ' +
        'vMix scripts use Sleep() directly: Sleep(1000) for 1 second.'
    );
  }

  // C# comparison operators instead of VB.NET.
  // Scan with string literals and comments stripped so `If a = "==" Then`
  // or commented-out C# does not flag, while `x=="y"` (no spaces) does.
  const strippedLines = script.split('\n').map(stripStringsAndComments);

  if (strippedLines.some((line) => line.includes('=='))) {
    errors.push(
      'Use = for equality comparison, not ==. ' +
        'VB.NET syntax: If x = "value" Then (not If x == "value")'
    );
  }

  if (strippedLines.some((line) => line.includes('!='))) {
    errors.push(
      'Use <> for inequality, not !=. ' +
        'VB.NET syntax: If x <> "value" Then'
    );
  }

  // C# variable declaration
  if (/\bvar\s+\w+\s*=/.test(script)) {
    errors.push(
      'Use Dim for variable declarations, not var. ' +
        'VB.NET syntax: Dim x As String = "value"'
    );
  }

  // Infinite loop without Sleep - THIS WILL FREEZE VMIX
  const loopPatterns = [
    /^[ \t]*Do\s+While\s+True\b[\s\S]*?^[ \t]*Loop\b/gim,
    /^[ \t]*Do\b[\s\S]*?^[ \t]*Loop\s+While\s+True\b/gim,
    /^[ \t]*While\s+True\b[\s\S]*?^[ \t]*End\s+While\b/gim,
  ];

  for (const pattern of loopPatterns) {
    const matches = script.match(pattern);
    if (matches) {
      for (const loop of matches) {
        // Check if the loop contains Sleep
        if (!/Sleep\s*\(/i.test(loop)) {
          errors.push(
            'Infinite loop found without Sleep() - THIS WILL FREEZE vMix! ' +
              'Always include Sleep(100) or similar in loops: Do While True ... Sleep(100) ... Loop'
          );
          break; // Only report once
        }
      }
    }
  }

  // C# style comments - only at start of line (not inside strings like XPath "//node")
  // Look for // at beginning of line (with optional whitespace) not followed by /
  // and not inside quotes
  const lines = script.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Check if line starts with // (C# comment) but not inside a string context
    if (trimmed.startsWith('//') && !trimmed.startsWith('///')) {
      // This looks like a C# comment at the start of a line
      errors.push(
        "Use ' for comments, not //. " +
          "VB.NET syntax: ' This is a comment"
      );
      break;
    }
  }

  // ==========================================================================
  // WARNINGS - Script may work but has potential issues
  // ==========================================================================

  // String concatenation with + instead of &
  // Only warn if we see string + string or string + variable patterns
  // Don't warn about numeric + operations
  if (/"\s*\+\s*"/.test(script) || /"\s*\+\s*[a-zA-Z]/.test(script)) {
    warnings.push(
      'Consider using & for string concatenation instead of +. ' +
        'VB.NET prefers: "Hello " & name (not "Hello " + name)'
    );
  }

  // Missing End If check:
  // - A line `If ... Then` with nothing after Then opens a block (needs End If).
  // - A line `If ... Then <code>` is a single-line If (no End If needed).
  // - ElseIf continues an existing block and does not need its own End If.
  // Strings and comments are stripped first so `If a = "Then" Then` parses correctly.
  let blockIfCount = 0;
  let endIfCount = 0;

  for (const rawLine of script.split('\n')) {
    const code = stripStringsAndComments(rawLine).trim();

    if (/^End\s+If\b/i.test(code)) {
      endIfCount++;
      continue;
    }

    if (/^ElseIf\b/i.test(code)) {
      continue; // part of an existing If block
    }

    const ifMatch = code.match(/^If\b.*?\bThen\b(.*)$/i);
    if (ifMatch) {
      const afterThen = (ifMatch[1] ?? '').trim();
      if (afterThen.length === 0) {
        blockIfCount++; // block If - requires End If
      }
      // Single-line If (code after Then) needs no End If
    }
  }

  if (blockIfCount > endIfCount) {
    warnings.push(
      'Possible missing End If statement. Each multi-line If...Then needs a matching End If.'
    );
  }

  // Very long Sleep that might be a mistake
  const sleepMatch = script.match(/Sleep\s*\(\s*(\d+)\s*\)/);
  if (sleepMatch && parseInt(sleepMatch[1] ?? '0', 10) > 60000) {
    warnings.push(
      `Sleep(${sleepMatch[1]}) is very long (over 60 seconds). ` +
        'Make sure this is intentional.'
    );
  }

  // Using Console.WriteLine (won't work in vMix)
  if (/Console\.Write/i.test(script)) {
    warnings.push(
      'Console.WriteLine does not produce visible output in vMix scripts. ' +
        'Consider using API.Function("SetText", ...) to display debug info.'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Common VB.NET script patterns for vMix
 * These are safe, validated patterns that can be used in script generation
 */
export const VMIX_SCRIPT_PATTERNS = {
  /** Basic API function call */
  apiCall: (func: string, params: Record<string, string>): string => {
    const paramStr = Object.entries(params)
      .map(([k, v]) => `${k}:="${v}"`)
      .join(', ');
    return `API.Function("${func}"${paramStr ? `, ${paramStr}` : ''})`;
  },

  /** Variable declaration */
  declare: (name: string, type: string, value?: string): string => {
    return value
      ? `Dim ${name} As ${type} = ${value}`
      : `Dim ${name} As ${type}`;
  },

  /** Sleep delay */
  sleep: (ms: number): string => `Sleep(${ms})`,

  /** Safe infinite loop template */
  safeLoop: (body: string, sleepMs = 100): string => {
    return `Do While True
    ${body}
    Sleep(${sleepMs})
Loop`;
  },

  /** Read vMix state */
  readState: (): string => {
    return `Dim xml As String = API.XML()
Dim x As New System.Xml.XmlDocument
x.LoadXml(xml)`;
  },

  /** Get value from state XML */
  xpathQuery: (varName: string, xpath: string): string => {
    return `Dim ${varName} As String = x.SelectSingleNode("${xpath}").InnerText`;
  },
};

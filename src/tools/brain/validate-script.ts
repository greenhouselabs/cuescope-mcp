/**
 * vmix_validate_script - Read-only state-aware VB.NET script validation
 */

import { z } from 'zod';
import { createTool, toolJsonContent, type ToolContext } from '../base.js';
import type { VmixInput, VmixState } from '../../state/types.js';
import { validateVmixScript } from '../../validation/script-validator.js';
import { VMIX_FUNCTION_NAMES } from '../../validation/vmix-functions.generated.js';
import { assumptionDetail, average, buildAnalysisConfidence } from './analysis-metadata.js';
import { AUDIO_BUS_NAMES } from './analysis-helpers.js';

export type IssueSeverity = 'error' | 'warning' | 'info';
export type IssueCategory =
  | 'vbnet'
  | 'function'
  | 'inputReference'
  | 'titleField'
  | 'audioBus'
  | 'overlay'
  | 'polling'
  | 'xpath'
  | 'layout'
  | 'dataSource'
  | 'risk'
  | 'dynamic';

export interface ScriptIssue {
  severity: IssueSeverity;
  category: IssueCategory;
  message: string;
  line?: number;
  detail?: string;
  evidence?: string[];
  recommendation?: string;
  confidence?: number;
}

export interface ApiCall {
  line: number;
  functionName: string;
  raw: string;
  params: Record<string, string>;
  dynamicParams: string[];
}

interface ResolvedInput {
  input: VmixInput;
  matchedBy: 'key' | 'number' | 'title';
}

interface LoopBlock {
  line: number;
  text: string;
}

// Allowlist of official vMix shortcut functions, generated from vmix-function-list.
// Names are already lowercased. Regenerate with: npm run generate:functions
const KNOWN_VMIX_FUNCTIONS = new Set(VMIX_FUNCTION_NAMES);

const SHOW_CRITICAL_FUNCTIONS = new Set(
  [
    'OpenPreset',
    'SavePreset',
    'RemoveInput',
    'OverlayInputAllOff',
    'StartRecording',
    'StopRecording',
    'StartStopRecording',
    'StartStreaming',
    'StopStreaming',
    'StartStopStreaming',
    'SetOutput2',
    'SetOutput3',
    'SetOutput4',
    'SetOutputFullscreen',
    'BusXSendToMasterOn',
    'BusXSendToMasterOff',
    'BusXSoloOn',
    'BusXSoloOff',
    'ScriptStart',
    'ScriptStartDynamic',
    'ScriptStop',
    'ScriptStopAll',
    'ScriptStopDynamic',
  ].map((functionName) => functionName.toLowerCase())
);

const INPUT_FUNCTIONS = new Set(
  [
    'Cut',
    'Fade',
    'PreviewInput',
    'Stinger1',
    'OverlayInput1In',
    'OverlayInput2In',
    'OverlayInput3In',
    'OverlayInput4In',
    'SetText',
    'SetImage',
    'SetVolume',
    'SetPosition',
    'SetCountdown',
    'StartCountdown',
    'StopCountdown',
    'PauseCountdown',
    'ChangeCountdown',
    'Play',
    'Pause',
    'Restart',
    'ResetInput',
    'SetInputName',
    'AudioOn',
    'AudioOff',
    'AudioBusOn',
    'VideoCallAudioSource',
    'SetLayer',
  ].map((functionName) => functionName.toLowerCase())
);

function isKnownFunction(functionName: string): boolean {
  const lower = functionName.toLowerCase();

  if (KNOWN_VMIX_FUNCTIONS.has(lower)) return true;
  if (/^overlayinput[1-4](in|out)$/i.test(functionName)) return true;
  if (/^setlayer\d+(zoom|panx|pany|x|y|width|height|crop.*)$/i.test(functionName)) return true;
  if (/^ptzmove(up|down|left|right|upleft|upright|downleft|downright|stop)$/i.test(functionName)) return true;
  if (/^setoutput[234]$/i.test(functionName)) return true;
  if (/^replayselectchannel[ab]$/i.test(functionName)) return true;
  if (/^replaycamera[1-8]$/i.test(functionName)) return true;

  return false;
}

function isLayerMutationFunction(functionName: string): boolean {
  return /^setlayer(?:\d+[a-z0-9]*)?$/i.test(functionName);
}

function isAudioRoutingFunction(functionName: string): boolean {
  return (
    /audio/i.test(functionName) ||
    /^busx(?:sendtomaster|solo)/i.test(functionName) ||
    /^setbus[a-g]/i.test(functionName)
  );
}

function parenDelta(text: string): number {
  const withoutStrings = text.replace(/"[^"]*"/g, '""');
  return (withoutStrings.match(/\(/g) ?? []).length - (withoutStrings.match(/\)/g) ?? []).length;
}

function executableLines(code: string): Array<{ line: number; text: string }> {
  const statements: Array<{ line: number; text: string }> = [];
  let pending: { line: number; text: string; depth: number } | null = null;

  for (const [index, text] of code.split(/\r?\n/).entries()) {
    if (text.trimStart().startsWith("'")) continue;

    if (pending) {
      pending.text = `${pending.text}\n${text}`;
      pending.depth += parenDelta(text);
      if (pending.depth <= 0) {
        statements.push({ line: pending.line, text: pending.text });
        pending = null;
      }
      continue;
    }

    const depth = /API\.Function\s*\(/i.test(text) ? parenDelta(text) : 0;
    if (depth > 0) {
      pending = { line: index + 1, text, depth };
      continue;
    }

    statements.push({ line: index + 1, text });
  }

  if (pending) {
    statements.push({ line: pending.line, text: pending.text });
  }

  return statements;
}

function stripVbStringsAndComments(line: string): string {
  let output = '';
  let inString = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inString && line[index + 1] === '"') {
        index += 1;
        output += ' ';
        continue;
      }

      inString = !inString;
      output += ' ';
      continue;
    }

    if (!inString && char === "'") {
      break;
    }

    output += inString ? ' ' : char;
  }

  return output;
}

function lineNumberAt(code: string, index: number): number {
  return code.slice(0, index).split(/\r?\n/).length;
}

function extractLoopBlocks(code: string): LoopBlock[] {
  const loops: LoopBlock[] = [];
  const patterns = [
    /^[ \t]*Do\s+While\s+True\b[\s\S]*?^[ \t]*Loop\b/gim,
    /^[ \t]*Do\b[\s\S]*?^[ \t]*Loop\s+While\s+True\b/gim,
    /^[ \t]*While\s+True\b[\s\S]*?^[ \t]*End\s+While\b/gim,
  ];

  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) {
      if (match.index === undefined) continue;
      loops.push({
        line: lineNumberAt(code, match.index),
        text: match[0],
      });
    }
  }

  return loops.sort((left, right) => left.line - right.line);
}

function canonicalParamName(paramName: string): string {
  const lower = paramName.toLowerCase();
  if (lower === 'input') return 'Input';
  if (lower === 'selectedname') return 'SelectedName';
  if (lower === 'selectedindex') return 'SelectedIndex';
  if (lower === 'value') return 'Value';
  return paramName;
}

function extractApiCalls(code: string): ApiCall[] {
  const calls: ApiCall[] = [];

  for (const { line, text } of executableLines(code)) {
    const callMatches = text.matchAll(/API\.Function\s*\(\s*"([^"]+)"([^)]*)\)/gi);

    for (const match of callMatches) {
      const functionName = match[1] ?? '';
      const paramText = match[2] ?? '';
      const params: Record<string, string> = {};
      const dynamicParams: string[] = [];

      for (const paramMatch of paramText.matchAll(/\b(Input|SelectedName|Value|SelectedIndex)\s*:=\s*"([^"]*)"/gi)) {
        params[canonicalParamName(paramMatch[1]!)] = paramMatch[2] ?? '';
      }

      for (const dynamicMatch of paramText.matchAll(/\b(Input|SelectedName|Value|SelectedIndex)\s*:=(?!\s*")/gi)) {
        const paramName = canonicalParamName(dynamicMatch[1]!);
        if (params[paramName] === undefined) {
          dynamicParams.push(paramName);
        }
      }

      for (const concatenatedMatch of paramText.matchAll(/\b(Input|SelectedName|Value|SelectedIndex)\s*:=\s*"[^"]*"\s*&/gi)) {
        const paramName = canonicalParamName(concatenatedMatch[1]!);
        if (!dynamicParams.includes(paramName)) {
          dynamicParams.push(paramName);
        }
      }

      calls.push({
        line,
        functionName,
        raw: match[0],
        params,
        dynamicParams,
      });
    }
  }

  return calls;
}

function extractFunctionNamesFromText(text: string): string[] {
  const names = new Set<string>();
  const regex = /API\.Function\s*\(\s*"([^"]+)"/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    names.add(match[1] ?? '');
  }

  return [...names].filter((name) => name.length > 0);
}

function formatFunctionList(names: string[]): string {
  return [...new Set(names)].sort((left, right) => left.localeCompare(right)).join(', ');
}

/** Minimal shape needed to resolve an input reference (satisfied by VmixInput and PresetInput). */
interface ResolvableInput {
  key: string | null;
  title: string;
  number?: number;
}

/** Options that adapt validation for saved-preset scripts vs. live ad-hoc scripts. */
export interface ScriptValidationOptions {
  /**
   * Inputs from a saved preset, treated as valid in addition to live state. A
   * reference found only here is reported as info (defined but not loaded now),
   * not an error.
   */
  presetInputs?: ReadonlyArray<ResolvableInput>;
  /** Severity for a reference found in neither live state nor the preset. Default 'error'. */
  unresolvedInputSeverity?: IssueSeverity;
}

function resolveInputInList<T extends ResolvableInput>(
  inputs: ReadonlyArray<T>,
  reference: string
): { input: T; matchedBy: 'key' | 'number' | 'title' } | null {
  const trimmed = reference.trim();
  const lower = trimmed.toLowerCase();

  if (lower.length > 0) {
    const keyMatch = inputs.find((input) => (input.key ?? '').toLowerCase() === lower);
    if (keyMatch) return { input: keyMatch, matchedBy: 'key' };
  }

  if (/^\d+$/.test(trimmed)) {
    const number = parseInt(trimmed, 10);
    const numberMatch = inputs.find((input) => input.number === number);
    if (numberMatch) return { input: numberMatch, matchedBy: 'number' };
  }

  const titleMatch = inputs.find((input) => input.title === trimmed);
  if (titleMatch) return { input: titleMatch, matchedBy: 'title' };

  return null;
}

function resolveInput(state: VmixState, reference: string): ResolvedInput | null {
  return resolveInputInList(state.inputs, reference);
}

function findSimilarInputs(state: VmixState, reference: string): string[] {
  const lower = reference.toLowerCase();

  return state.inputs
    .filter((input) => input.title.toLowerCase().includes(lower) || lower.includes(input.title.toLowerCase()))
    .slice(0, 5)
    .map((input) => `${input.number}: ${input.title} (${input.key || 'no key'})`);
}

function validateFunctionNames(calls: ApiCall[]): ScriptIssue[] {
  return calls
    .filter((call) => !isKnownFunction(call.functionName))
    .map((call) => ({
      severity: 'error' as const,
      category: 'function' as const,
      line: call.line,
      message: `Unknown vMix function: ${call.functionName}.`,
      detail: 'This function is not in the runtime validator allowlist or supported function-pattern families.',
    }));
}

function validateOverlayFunctions(calls: ApiCall[]): ScriptIssue[] {
  const issues: ScriptIssue[] = [];

  for (const call of calls) {
    const match = call.functionName.match(/^OverlayInput(\d+)(In|Out)$/i);
    if (!match?.[1]) continue;

    const channel = parseInt(match[1], 10);
    if (channel < 1 || channel > 4) {
      issues.push({
        severity: 'error',
        category: 'overlay',
        line: call.line,
        message: `Overlay channel ${channel} is outside vMix overlay range 1-4.`,
        detail: 'Use OverlayInput1In through OverlayInput4In, or matching Out functions.',
      });
    }
  }

  return issues;
}

function validateInputReferences(
  state: VmixState,
  calls: ApiCall[],
  options: ScriptValidationOptions = {}
): ScriptIssue[] {
  const issues: ScriptIssue[] = [];

  for (const call of calls) {
    const lowerFunction = call.functionName.toLowerCase();
    const expectsInput =
      INPUT_FUNCTIONS.has(lowerFunction) ||
      /^overlayinput[1-4]in$/i.test(call.functionName) ||
      isLayerMutationFunction(call.functionName);
    const inputReference = call.params['Input'];

    if (inputReference !== undefined) {
      const resolved = resolveInput(state, inputReference);

      if (resolved) {
        if (resolved.matchedBy === 'title' || resolved.matchedBy === 'number') {
          issues.push({
            severity: 'warning',
            category: 'inputReference',
            line: call.line,
            message: `Input reference ${inputReference} resolves by ${resolved.matchedBy}, but a stable key is available.`,
            detail: `Prefer ${resolved.input.key || resolved.input.number} for ${resolved.input.title}.`,
          });
        }
        continue;
      }

      // Not in live state. For a saved-preset script, the reference may still be
      // valid: defined in the preset (loaded later) or a dynamically-added input.
      if (options.presetInputs && resolveInputInList(options.presetInputs, inputReference)) {
        issues.push({
          severity: 'info',
          category: 'inputReference',
          line: call.line,
          message: `Input "${inputReference}" is defined in the saved preset but not loaded in the current live session.`,
          detail: 'It is likely added when the relevant segment or source loads.',
        });
        continue;
      }

      const severity = options.unresolvedInputSeverity ?? 'error';
      const suggestions = findSimilarInputs(state, inputReference);
      issues.push({
        severity,
        category: 'inputReference',
        line: call.line,
        message:
          severity === 'error'
            ? `Input reference not found in current vMix state: ${inputReference}.`
            : `Input reference not found in the saved preset or current live state: ${inputReference}.`,
        detail:
          severity === 'error'
            ? suggestions.length > 0
              ? `Similar inputs: ${suggestions.join(', ')}.`
              : 'No similar input titles were found.'
            : 'Likely a dynamically-added input (e.g. a vMix Call) or a stale reference — verify it exists at runtime.',
      });
      continue;
    }

    if (expectsInput && call.dynamicParams.includes('Input')) {
      issues.push({
        severity: 'warning',
        category: 'dynamic',
        line: call.line,
        message: `Input parameter for ${call.functionName} is dynamic and could not be checked against current state.`,
        detail: 'This can be valid, but review the variable contents before using the script.',
      });
    }
  }

  return issues;
}

function validateTitleFields(state: VmixState, calls: ApiCall[]): ScriptIssue[] {
  const issues: ScriptIssue[] = [];

  for (const call of calls) {
    if (!['settext', 'setimage', 'settextcolour', 'settickerspeed'].includes(call.functionName.toLowerCase())) {
      continue;
    }

    const inputReference = call.params['Input'];
    const selectedName = call.params['SelectedName'];

    if (selectedName === undefined) {
      if (call.dynamicParams.includes('SelectedName')) {
        issues.push({
          severity: 'warning',
          category: 'dynamic',
          line: call.line,
          message: `SelectedName for ${call.functionName} is dynamic and could not be checked.`,
        });
      }
      continue;
    }

    if (inputReference === undefined) continue;

    const resolved = resolveInput(state, inputReference);
    if (!resolved) continue;

    const fields = Object.keys(resolved.input.fields ?? {});
    if (fields.length === 0) {
      issues.push({
        severity: 'warning',
        category: 'titleField',
        line: call.line,
        message: `${resolved.input.title} has no visible title fields in current XML.`,
        detail: `Cannot confirm SelectedName="${selectedName}".`,
      });
      continue;
    }

    if (!fields.includes(selectedName)) {
      issues.push({
        severity: 'error',
        category: 'titleField',
        line: call.line,
        message: `Title field not found on ${resolved.input.title}: ${selectedName}.`,
        detail: `Available fields: ${fields.join(', ')}.`,
      });
    }
  }

  return issues;
}

function validateAudioBuses(calls: ApiCall[]): ScriptIssue[] {
  const validBuses = new Set(AUDIO_BUS_NAMES);
  const issues: ScriptIssue[] = [];

  for (const call of calls) {
    if (!call.functionName.toLowerCase().includes('audiobus')) continue;

    const value = call.params['Value'];
    if (value === undefined) continue;

    const buses = value.split(',').map((bus) => bus.trim()).filter((bus) => bus.length > 0);
    for (const bus of buses) {
      if (!validBuses.has(bus as (typeof AUDIO_BUS_NAMES)[number])) {
        issues.push({
          severity: 'error',
          category: 'audioBus',
          line: call.line,
          message: `Invalid audio bus "${bus}".`,
          detail: `Valid buses are ${AUDIO_BUS_NAMES.join(', ')}.`,
        });
      }
    }
  }

  return issues;
}

function validateVideoCallAudioSourceValues(calls: ApiCall[]): ScriptIssue[] {
  const issues: ScriptIssue[] = [];

  for (const call of calls) {
    if (call.functionName.toLowerCase() !== 'videocallaudiosource') continue;

    const value = call.params['Value']?.trim();
    if (value === undefined || value.length === 0) continue;

    if (/^[A-G]$/i.test(value)) {
      issues.push({
        severity: 'warning',
        category: 'audioBus',
        line: call.line,
        message: `VideoCallAudioSource value "${value}" looks like an AudioBusOn/Off bus letter.`,
        detail:
          'vMix Call return audio-source values commonly use BusA, BusC, and similar Bus-prefixed values, while AudioBusOn/Off uses A, C, and similar single letters.',
        recommendation: `Confirm whether this should be Value:="Bus${value.toUpperCase()}" for caller return audio.`,
        confidence: 0.86,
      });
    }
  }

  return issues;
}

function validateDataSourceRowSelection(calls: ApiCall[]): ScriptIssue[] {
  const issues: ScriptIssue[] = [];

  for (const call of calls) {
    if (call.functionName.toLowerCase() !== 'datasourceselectrow') continue;

    const value = call.params['Value'];
    const valueIsDynamic = call.dynamicParams.includes('Value');
    if (valueIsDynamic) {
      issues.push({
        severity: 'warning',
        category: 'dataSource',
        line: call.line,
        message: 'DataSourceSelectRow Value is dynamic and cannot be fully checked.',
        detail:
          'Slot-driven lower-third scripts often build the row from a Select Case map. That map is preset-specific and should be reviewed against the roster/data source.',
        recommendation: 'Keep participant-to-row mappings in one reviewed table, and document any per-slot overrides.',
        confidence: 0.82,
      });
    }

    if (value === undefined) {
      if (!valueIsDynamic) {
        issues.push({
          severity: 'error',
          category: 'dataSource',
          line: call.line,
          message: 'DataSourceSelectRow is missing Value.',
          detail: 'The value should identify the data source/table and row to select.',
          recommendation: 'Provide a reviewed data-source row selection value before using the script.',
          confidence: 0.9,
        });
      }
      continue;
    }
    if (valueIsDynamic) continue;

    const separator = value.includes('|') ? '|' : ',';
    const parts = value.split(separator).map((part) => part.trim()).filter((part) => part.length > 0);
    if (parts.length < 2) {
      issues.push({
        severity: 'error',
        category: 'dataSource',
        line: call.line,
        message: 'DataSourceSelectRow Value does not include enough row-selection parts.',
        detail:
          'Expected at least a data source/table plus row, or data source plus table plus row depending on the target setup.',
        recommendation: 'Confirm the expected vMix data-source value format for this preset.',
        confidence: 0.84,
      });
      continue;
    }

    const rowPart = parts[parts.length - 1] ?? '';
    if (!/^\d+$/.test(rowPart)) {
      issues.push({
        severity: 'warning',
        category: 'dataSource',
        line: call.line,
        message: `DataSourceSelectRow row "${rowPart}" is not a literal numeric row.`,
        detail: 'This can be valid when the row is computed, but it should trace back to a reviewed row map.',
        recommendation: 'Verify the row expression cannot select the wrong participant when slot titles drift.',
        confidence: 0.72,
      });
    }
  }

  return issues;
}

function validateLayerFunctions(
  state: VmixState,
  calls: ApiCall[],
  options: ScriptValidationOptions = {}
): ScriptIssue[] {
  const issues: ScriptIssue[] = [];

  for (const call of calls) {
    if (call.functionName.toLowerCase() !== 'setlayer') continue;

    const value = call.params['Value'];
    if (value === undefined) {
      if (call.dynamicParams.includes('Value')) {
        issues.push({
          severity: 'warning',
          category: 'layout',
          line: call.line,
          message: 'SetLayer Value is dynamic and cannot be fully checked.',
          detail:
            'SetLayer expects a value shaped like "LayerIndex,SourceInput"; confirm the runtime expression produces a reviewed layer number and source input.',
          recommendation: 'For reusable scripts, keep the layer list and clear/source input explicit in review notes.',
          confidence: 0.78,
        });
      } else {
        issues.push({
          severity: 'error',
          category: 'layout',
          line: call.line,
          message: 'SetLayer is missing Value.',
          detail: 'SetLayer expects Value:="LayerIndex,SourceInput".',
          recommendation: 'Add a one-based layer number and source input reference.',
          confidence: 0.92,
        });
      }
      continue;
    }

    const parts = value.split(',').map((part) => part.trim());
    if (parts.length !== 2 || parts.some((part) => part.length === 0)) {
      issues.push({
        severity: 'error',
        category: 'layout',
        line: call.line,
        message: 'SetLayer Value should use "LayerIndex,SourceInput".',
        detail: `Received Value:="${value}". vMix uses the comma as the layer/source separator.`,
        recommendation: 'Use a one-based layer number followed by a source input title, number, or key.',
        confidence: 0.9,
      });
      continue;
    }

    const [layerReference, sourceReference] = parts as [string, string];
    if (!/^\d+$/.test(layerReference)) {
      issues.push({
        severity: 'error',
        category: 'layout',
        line: call.line,
        message: `SetLayer layer "${layerReference}" is not a positive integer.`,
        detail: 'vMix layer numbers are one-based integers in SetLayer values.',
        recommendation: 'Use reviewed layer numbers such as 1, 2, 3, or 4.',
        confidence: 0.92,
      });
    } else {
      const layerNumber = parseInt(layerReference, 10);
      if (layerNumber < 1) {
        issues.push({
          severity: 'error',
          category: 'layout',
          line: call.line,
          message: `SetLayer layer ${layerNumber} is outside the one-based vMix layer range.`,
          detail: 'Layer 0 is not a valid SetLayer target.',
          recommendation: 'Use reviewed one-based layer numbers.',
          confidence: 0.92,
        });
      } else if (layerNumber > 20) {
        issues.push({
          severity: 'warning',
          category: 'layout',
          line: call.line,
          message: `SetLayer layer ${layerNumber} is unusually high.`,
          detail: 'Most vMix multiview/layout scripts use a small reviewed layer set.',
          recommendation: 'Confirm this preset really uses that layer index.',
          confidence: 0.72,
        });
      }
    }

    const resolvedSource = resolveInput(state, sourceReference);
    if (resolvedSource) {
      if (resolvedSource.matchedBy === 'title' || resolvedSource.matchedBy === 'number') {
        issues.push({
          severity: 'warning',
          category: 'layout',
          line: call.line,
          message: `SetLayer source "${sourceReference}" resolves by ${resolvedSource.matchedBy}, but a stable key is available.`,
          detail: `Prefer ${resolvedSource.input.key || resolvedSource.input.number} for ${resolvedSource.input.title} when the script should survive preset edits.`,
          recommendation: 'Use stable keys for generated or reusable layer-mapping scripts when practical.',
          confidence: 0.78,
        });
      }
      continue;
    }

    if (options.presetInputs && resolveInputInList(options.presetInputs, sourceReference)) {
      issues.push({
        severity: 'info',
        category: 'layout',
        line: call.line,
        message: `SetLayer source "${sourceReference}" is defined in the saved preset but not loaded in the current live session.`,
        detail: 'This can be valid for saved-preset review, but should be checked before live use.',
        confidence: 0.72,
      });
      continue;
    }

    const severity = options.unresolvedInputSeverity ?? 'error';
    issues.push({
      severity,
      category: 'layout',
      line: call.line,
      message:
        severity === 'error'
          ? `SetLayer source input not found in current vMix state: ${sourceReference}.`
          : `SetLayer source input not found in the saved preset or current live state: ${sourceReference}.`,
      detail: 'The source side of Value must resolve to the input being placed into the layer.',
      recommendation: 'Confirm the source input title, number, or key before relying on this layer mapping.',
      confidence: severity === 'error' ? 0.9 : 0.72,
    });
  }

  return issues;
}

function validateLayoutMutationPatterns(code: string, calls: ApiCall[]): ScriptIssue[] {
  const issues: ScriptIssue[] = [];
  const layerCallCount = calls.filter((call) => isLayerMutationFunction(call.functionName)).length;

  if (layerCallCount >= 25) {
    issues.push({
      severity: 'warning',
      category: 'layout',
      message: `Large layout mapping block detected (${layerCallCount} layer function calls).`,
      detail:
        'Large SetLayer/pan/zoom/crop tables can be valid production code, but the mapping is usually preset-specific.',
      recommendation: 'Review the mapping table as local preset logic; do not treat exact geometry or layer indexes as universal defaults.',
      confidence: 0.76,
    });
  }

  for (const loop of extractLoopBlocks(code)) {
    const loopLayerCallCount = [...loop.text.matchAll(/API\.Function\s*\(\s*"setlayer(?:\d+[a-z0-9]*)?"/gi)]
      .length;
    if (loopLayerCallCount === 0) continue;

    const functionNames = extractFunctionNamesFromText(loop.text);
    const audioFunctionNames = functionNames.filter(isAudioRoutingFunction);

    if (audioFunctionNames.length > 0) {
      issues.push({
        severity: 'warning',
        category: 'layout',
        line: loop.line,
        message: 'Polling loop mixes layout layer updates with audio/routing changes.',
        detail:
          'Real production scripts sometimes combine layout composition and audio state, but this creates higher blast radius when the loop condition or slot map drifts.',
        evidence: [
          `Layer calls in loop: ${loopLayerCallCount}.`,
          `Audio/routing functions: ${formatFunctionList(audioFunctionNames)}.`,
        ],
        recommendation:
          'Consider separating layout, audio, and routing phases, or add explicit state-change guards for each domain.',
        confidence: 0.8,
      });
    }
  }

  return issues;
}

function validateRiskyFunctions(calls: ApiCall[]): ScriptIssue[] {
  return calls
    .filter((call) => SHOW_CRITICAL_FUNCTIONS.has(call.functionName.toLowerCase()))
    .map((call) => ({
      severity: 'warning' as const,
      category: 'risk' as const,
      line: call.line,
      message: `${call.functionName} is show-critical.`,
      detail: 'Review timing, current production state, and operator intent before manual execution.',
    }));
}

function validateVmixDialectRisks(code: string): ScriptIssue[] {
  const issues: ScriptIssue[] = [];
  const lines = executableLines(code);

  for (const { line, text } of lines) {
    if (/[\u2018\u2019\u201C\u201D]/.test(text)) {
      issues.push({
        severity: 'warning',
        category: 'vbnet',
        line,
        message: 'Smart or curly quotes may not compile as VB.NET string delimiters.',
        detail:
          'Production scripts should use straight double quotes for string literals and named argument values.',
        recommendation: 'Replace smart quotes with straight ASCII double quotes before using the script in vMix.',
        confidence: 0.92,
      });
    }

    const stripped = stripVbStringsAndComments(text).trim();
    if (/^(If|ElseIf)\b/i.test(stripped) && !/\bThen\b/i.test(stripped)) {
      issues.push({
        severity: 'warning',
        category: 'vbnet',
        line,
        message: 'Conditional statement appears to be missing Then.',
        detail: 'VB.NET multiline If and ElseIf statements require a Then keyword.',
        recommendation: 'Add Then at the end of the condition, or rewrite the statement as a valid single-line If.',
        confidence: 0.88,
      });
    }

    if (/\bDim\b.*\bAs\b.*=\s*\{.*_\s*$/i.test(text.trim())) {
      issues.push({
        severity: 'warning',
        category: 'vbnet',
        line,
        message: 'Multiline array initializer with line continuations may not compile in every vMix scripting host.',
        detail:
          'Arrays are allowed, but this brace-plus-underscore style has caused vMix compile errors in real testing.',
        recommendation:
          'For copy-ready scripts, use a one-line initializer known to compile or expand the actions into explicit labeled calls.',
        confidence: 0.78,
      });
      continue;
    }

    if (/}\s*$/i.test(text.trim())) {
      const previousContinuation = lines
        .filter((candidate) => candidate.line < line && candidate.line >= line - 10)
        .some((candidate) => /_\s*$/.test(candidate.text.trim()));

      if (previousContinuation) {
        issues.push({
          severity: 'warning',
          category: 'vbnet',
          line,
          message: 'Array literal closes after line-continuation entries.',
          detail:
            'This may be valid VB.NET, but vMix scripting compatibility should be verified before relying on it live.',
          recommendation: 'Prefer clearer copy-ready action blocks when the script is intended for quick operator review.',
          confidence: 0.68,
        });
      }
    }
  }

  return issues;
}

function validatePollingPatterns(code: string): ScriptIssue[] {
  const issues: ScriptIssue[] = [];

  for (const loop of extractLoopBlocks(code)) {
    const isStatePolling =
      /API\.XML\s*\(/i.test(loop.text) ||
      /SelectSingleNode|SelectNodes/i.test(loop.text) ||
      /\b(active|preview|position|duration|state)\b/i.test(loop.text);
    const isTimePolling = /DateTime\.Now/i.test(loop.text);
    const highImpactFunctionNames = extractFunctionNamesFromText(loop.text).filter((functionName) =>
      SHOW_CRITICAL_FUNCTIONS.has(functionName.toLowerCase())
    );
    const apiFunctionCallCount = [...loop.text.matchAll(/API\.Function\s*\(/gi)].length;
    const hasChangeGuard = /\b(?:last|previous|prev)[A-Za-z0-9_]*\b/i.test(loop.text);
    const sleepMatches = [...loop.text.matchAll(/Sleep\s*\(\s*(\d+)\s*\)/gi)];

    if (!isStatePolling && !isTimePolling && highImpactFunctionNames.length === 0) continue;

    if (sleepMatches.length === 0) {
      issues.push({
        severity: 'error',
        category: 'polling',
        line: loop.line,
        message: 'Polling loop does not include Sleep().',
        detail: 'State polling loops without Sleep() can freeze vMix.',
        evidence: ['Loop reads state-like values but no Sleep() call was found inside the loop.'],
        recommendation: 'Add Sleep(100) or a longer delay inside the polling loop.',
        confidence: 0.95,
      });
      continue;
    }

    for (const sleepMatch of sleepMatches) {
      const sleepMs = parseInt(sleepMatch[1] ?? '0', 10);
      if (sleepMs > 0 && sleepMs < 50) {
        issues.push({
          severity: 'warning',
          category: 'polling',
          line: loop.line,
          message: `Polling loop uses very short Sleep(${sleepMs}).`,
          detail: 'Very tight polling can make vMix scripts harder on the UI thread than necessary.',
          evidence: [`Sleep(${sleepMs}) appears inside a state polling loop.`],
          recommendation: 'Use Sleep(100) or slower unless sub-50ms polling is truly required.',
          confidence: 0.82,
        });
      }
    }

    if (/SelectSingleNode|SelectNodes/i.test(loop.text) && !/API\.XML\s*\(/i.test(loop.text)) {
      issues.push({
        severity: 'warning',
        category: 'polling',
        line: loop.line,
        message: 'Polling loop reads XML nodes without refreshing API.XML() inside the loop.',
        detail: 'If the XML document is loaded before the loop, the script may keep reading stale state.',
        evidence: ['Loop contains SelectSingleNode/SelectNodes but no API.XML() call.'],
        recommendation: 'Refresh API.XML() and reload the XML document inside polling loops that wait for changing state.',
        confidence: 0.78,
      });
    }

    if (/\bDateTime\.Now\.ToString\s*\(\s*"hh:mm:ss"\s*\)/i.test(loop.text)) {
      issues.push({
        severity: 'warning',
        category: 'polling',
        line: loop.line,
        message: 'Polling loop uses a 12-hour clock string for scheduling.',
        detail: 'A hh:mm:ss comparison cannot distinguish AM from PM and can repeat across a production day.',
        recommendation: 'Prefer a 24-hour HH:mm:ss format, TimeSpan comparison, or an explicit DateTime window with a latch.',
        confidence: 0.88,
      });
    }

    if (
      /\b\w+\s*(?:=|<>|<=|>=)\s*DateTime\.Now\.ToString\s*\(/i.test(loop.text) ||
      /DateTime\.Now\.ToString\s*\([^)]*\)\s*(?:=|<>|<=|>=)\s*\w+/i.test(loop.text)
    ) {
      issues.push({
        severity: 'warning',
        category: 'polling',
        line: loop.line,
        message: 'Polling loop uses exact wall-clock string equality.',
        detail: 'A repeated loop can miss the exact second, or run the same high-impact action more than once within it.',
        recommendation: 'Use a time window plus a per-event latch before firing recording, streaming, output, or script actions.',
        confidence: 0.84,
      });
    }

    if (highImpactFunctionNames.length > 0) {
      issues.push({
        severity: 'warning',
        category: 'risk',
        line: loop.line,
        message: `High-impact function appears inside a polling loop: ${formatFunctionList(highImpactFunctionNames)}.`,
        detail:
          'Recording, streaming, output, overlay-all-off, bus master/solo, preset, and script-control calls can affect the live show repeatedly if loop conditions remain true.',
        recommendation: 'Add an explicit latch, cooldown, or state transition guard before invoking high-impact functions from a loop.',
        confidence: 0.9,
      });
    }

    if (apiFunctionCallCount >= 5 && !hasChangeGuard) {
      issues.push({
        severity: 'warning',
        category: 'polling',
        line: loop.line,
        message: `Polling loop performs ${apiFunctionCallCount} API.Function calls without an obvious change guard.`,
        detail:
          'Large repeated update blocks can churn vMix every poll even when the intended state has not changed.',
        recommendation:
          'Cache last-applied state and call vMix functions only when a value, slot assignment, or production state actually changes.',
        confidence: 0.76,
      });
    }
  }

  return issues;
}

function findInputFromXpathLine(state: VmixState, text: string): VmixInput | null {
  const keyMatch = text.match(/@key='([^']+)'/i);
  if (keyMatch?.[1]) {
    return state.inputs.find((input) => input.key.toLowerCase() === keyMatch[1]!.toLowerCase()) ?? null;
  }

  const titleMatch = text.match(/@title='([^']+)'/i);
  if (titleMatch?.[1]) {
    return state.inputs.find((input) => input.title === titleMatch[1]) ?? null;
  }

  const numberMatch = text.match(/@number='?(\d+)'?/i);
  if (numberMatch?.[1]) {
    const number = parseInt(numberMatch[1], 10);
    return state.inputs.find((input) => input.number === number) ?? null;
  }

  return null;
}

function validateQuestionableXpath(state: VmixState, code: string): ScriptIssue[] {
  const issues: ScriptIssue[] = [];

  for (const { line, text } of executableLines(code)) {
    if (!/SelectSingleNode|SelectNodes|\.Item\s*\(|GetNamedItem/i.test(text)) continue;

    if (/SelectSingleNode\s*\([^)]*\)\.SelectNodes\s*\(/i.test(text)) {
      issues.push({
        severity: 'warning',
        category: 'xpath',
        line,
        message: 'SelectSingleNode result is chained into SelectNodes without a visible null check.',
        detail: 'If the parent node is absent in another preset, the script can fail before it reaches a fallback path.',
        recommendation: 'Store the parent node in a variable and check it for Nothing before selecting child nodes.',
        confidence: 0.86,
      });
    }

    if (/\.Item\s*\([^)]*\)\.Attributes/i.test(text)) {
      issues.push({
        severity: 'warning',
        category: 'xpath',
        line,
        message: 'XML node-list item is dereferenced without a visible count or null guard.',
        detail: 'Slot-based scripts often assume every Mix Layout or overlay position exists in the preset.',
        recommendation: 'Check the node list count and the selected item for Nothing before reading attributes.',
        confidence: 0.84,
      });
    }

    if (/\.GetNamedItem\s*\([^)]*\)\.Value/i.test(text)) {
      issues.push({
        severity: 'warning',
        category: 'xpath',
        line,
        message: 'XML attribute lookup is dereferenced without a visible null guard.',
        detail: 'GetNamedItem can return Nothing when another preset omits or renames the expected attribute.',
        recommendation: 'Store the attribute node and check it for Nothing before reading Value.',
        confidence: 0.84,
      });
    }

    if (/\/\/input\s*\[\s*\d+\s*\]/i.test(text)) {
      issues.push({
        severity: 'warning',
        category: 'xpath',
        line,
        message: 'XPath selects an input by position.',
        detail: 'Input order can change when a preset is edited.',
        evidence: [text.trim()],
        recommendation: "Prefer //input[@key='{...}'] or another stable key-based selector.",
        confidence: 0.9,
      });
    }

    const numberMatch = text.match(/@number='?(\d+)'?/i);
    if (numberMatch?.[1]) {
      const number = parseInt(numberMatch[1], 10);
      const input = state.inputs.find((candidate) => candidate.number === number);
      issues.push({
        severity: input ? 'warning' : 'error',
        category: 'xpath',
        line,
        message: input
          ? `XPath uses input number ${number} instead of stable key.`
          : `XPath input number not found in current state: ${number}.`,
        detail: input?.key
          ? `Prefer //input[@key='${input.key}'] for ${input.title}.`
          : input
            ? `No stable key is visible for ${input.title}; recheck this number if the preset order changes.`
            : 'Input numbers can change and this one is not visible in current state.',
        evidence: [text.trim()],
        recommendation: 'Use the current input key in XPath selectors wherever possible.',
        confidence: input ? 0.86 : 0.9,
      });
    }

    if (/contains\s*\(\s*@title/i.test(text)) {
      issues.push({
        severity: 'warning',
        category: 'xpath',
        line,
        message: 'XPath uses partial title matching.',
        detail: 'Partial title selectors can match the wrong input when names are similar.',
        evidence: [text.trim()],
        recommendation: 'Resolve the input once, then use its stable key for XPath.',
        confidence: 0.84,
      });
    }

    if (/SelectSingleNode/i.test(text) && /\.(InnerText|Attributes|Value)\b/i.test(text) && !/Is\s+Not\s+Nothing|IsNothing/i.test(text)) {
      issues.push({
        severity: 'warning',
        category: 'xpath',
        line,
        message: 'XPath result is dereferenced without an obvious null check.',
        detail: 'SelectSingleNode can return Nothing if the input, field, or node is absent.',
        evidence: [text.trim()],
        recommendation: 'Assign the node to a variable and check `If node IsNot Nothing Then` before reading it.',
        confidence: 0.7,
      });
    }

    for (const fieldMatch of text.matchAll(/@name='([^']+)'/gi)) {
      const fieldName = fieldMatch[1] ?? '';
      const input = findInputFromXpathLine(state, text);
      if (!input) continue;

      const fields = Object.keys(input.fields ?? {});
      if (fields.length === 0) {
        issues.push({
          severity: 'warning',
          category: 'titleField',
          line,
          message: `${input.title} has no visible title fields in current XML.`,
          detail: `Cannot confirm XPath field name "${fieldName}".`,
          evidence: [text.trim()],
          recommendation: 'Use vmix://inputs/fields or vmix_explain_input to confirm title fields before relying on this XPath.',
          confidence: 0.76,
        });
      } else if (!fields.includes(fieldName)) {
        issues.push({
          severity: 'error',
          category: 'titleField',
          line,
          message: `XPath title field not found on ${input.title}: ${fieldName}.`,
          detail: `Available fields: ${fields.join(', ')}.`,
          evidence: [text.trim()],
          recommendation: 'Use the exact field name visible in the current vMix XML.',
          confidence: 0.92,
        });
      }
    }
  }

  return issues;
}

/** A captured XPath literal containing a VB concatenation/quote marker was built at runtime. */
function isDynamicReference(value: string): boolean {
  return /["&]/.test(value);
}

function validateXpathReferences(
  state: VmixState,
  code: string,
  options: ScriptValidationOptions = {}
): ScriptIssue[] {
  const issues: ScriptIssue[] = [];

  for (const { line, text } of executableLines(code)) {
    for (const match of text.matchAll(/@key='([^']+)'/gi)) {
      const key = match[1] ?? '';

      if (isDynamicReference(key)) {
        issues.push({
          severity: 'warning',
          category: 'dynamic',
          line,
          message: 'XPath input key is built dynamically and cannot be statically verified.',
          detail: 'Confirm the variable resolves to a current input key at runtime.',
        });
        continue;
      }

      if (state.inputs.some((input) => input.key.toLowerCase() === key.toLowerCase())) continue;

      if (options.presetInputs && resolveInputInList(options.presetInputs, key)) {
        issues.push({
          severity: 'info',
          category: 'inputReference',
          line,
          message: `XPath input key "${key}" is defined in the saved preset but not loaded in the current live session.`,
        });
        continue;
      }

      issues.push({
        severity: options.unresolvedInputSeverity ?? 'error',
        category: 'inputReference',
        line,
        message: `XPath input key not found in current state: ${key}.`,
      });
    }

    for (const match of text.matchAll(/@title='([^']+)'/gi)) {
      const title = match[1] ?? '';

      if (isDynamicReference(title)) {
        issues.push({
          severity: 'warning',
          category: 'dynamic',
          line,
          message: 'XPath input title is built dynamically and cannot be statically verified.',
          detail: 'Confirm the variable resolves to a current input title at runtime.',
        });
        continue;
      }

      const input = state.inputs.find((candidate) => candidate.title === title);
      if (input) {
        if (input.key.length > 0) {
          issues.push({
            severity: 'warning',
            category: 'inputReference',
            line,
            message: `XPath uses title "${title}" instead of stable key.`,
            detail: `Prefer //input[@key='${input.key}'] when possible.`,
          });
        }
        continue;
      }

      if (options.presetInputs && resolveInputInList(options.presetInputs, title)) {
        issues.push({
          severity: 'info',
          category: 'inputReference',
          line,
          message: `XPath input title "${title}" is defined in the saved preset but not loaded in the current live session.`,
        });
        continue;
      }

      issues.push({
        severity: options.unresolvedInputSeverity ?? 'error',
        category: 'inputReference',
        line,
        message: `XPath input title not found in current state: ${title}.`,
      });
    }
  }

  return issues;
}

function summarizeIssues(issues: ScriptIssue[]) {
  return {
    total: issues.length,
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
    info: issues.filter((issue) => issue.severity === 'info').length,
  };
}

function toDiagnosticFinding(issue: ScriptIssue) {
  return {
    severity: issue.severity,
    category: issue.category,
    line: issue.line ?? null,
    message: issue.message,
    detail: issue.detail ?? null,
    evidence: issue.evidence ?? [],
    recommendation: issue.recommendation ?? null,
    confidence: issue.confidence ?? null,
  };
}

function buildDiagnosticGroup(issues: ScriptIssue[], predicate: (issue: ScriptIssue) => boolean) {
  // Per-group counts only. The full evidence lives once in the flat `issues[]`
  // array on the result; re-emitting it here (as `findings`) doubled the payload.
  const findings = issues.filter(predicate).map(toDiagnosticFinding);

  return {
    count: findings.length,
    errors: findings.filter((finding) => finding.severity === 'error').length,
    warnings: findings.filter((finding) => finding.severity === 'warning').length,
    info: findings.filter((finding) => finding.severity === 'info').length,
  };
}

function buildScriptingDiagnostics(issues: ScriptIssue[]) {
  const summary = summarizeIssues(issues);

  return {
    overallRisk:
      summary.errors > 0 ? 'blocked' : summary.warnings > 0 ? 'review' : 'clear',
    summary,
    fragileReferences: buildDiagnosticGroup(
      issues,
      (issue) =>
        issue.category === 'dynamic' ||
        (issue.category === 'inputReference' && issue.severity !== 'error') ||
        (issue.category === 'xpath' && /title|number|position|partial/i.test(issue.message))
    ),
    polling: buildDiagnosticGroup(
      issues,
      (issue) =>
        issue.category === 'polling' ||
        (issue.category === 'vbnet' && /loop|Sleep/i.test(issue.message))
    ),
    xpath: buildDiagnosticGroup(
      issues,
      (issue) => issue.category === 'xpath' || /^XPath/i.test(issue.message)
    ),
    layoutMapping: buildDiagnosticGroup(issues, (issue) => issue.category === 'layout'),
    dataSources: buildDiagnosticGroup(issues, (issue) => issue.category === 'dataSource'),
    functions: buildDiagnosticGroup(
      issues,
      (issue) => issue.category === 'function' || issue.category === 'risk'
    ),
    titleFields: buildDiagnosticGroup(issues, (issue) => issue.category === 'titleField'),
    audioAndOverlays: buildDiagnosticGroup(
      issues,
      (issue) => issue.category === 'audioBus' || issue.category === 'overlay'
    ),
  };
}

function buildScriptValidationConfidence(
  state: VmixState,
  apiCalls: ApiCall[],
  issues: ScriptIssue[]
) {
  const issueSummary = summarizeIssues(issues);
  const dynamicParamCount = apiCalls.reduce((sum, call) => sum + call.dynamicParams.length, 0);
  const issueConfidence = average(
    issues
      .map((issue) => issue.confidence)
      .filter((confidence): confidence is number => confidence !== undefined),
    issueSummary.total > 0 ? 0.76 : 0.88
  );
  const severityScore =
    issueSummary.errors > 0
      ? Math.max(0.35, 0.72 - issueSummary.errors * 0.08)
      : issueSummary.warnings > 0
        ? Math.max(0.65, 0.9 - issueSummary.warnings * 0.04)
        : 0.94;

  return buildAnalysisConfidence(
    [
      {
        name: 'staticScriptParsing',
        score: apiCalls.length > 0 ? 0.86 : 0.65,
        weight: 1,
        reason: `${apiCalls.length} API.Function call(s) were statically extracted.`,
      },
      {
        name: 'currentStateContext',
        score: state.inputs.length > 0 ? 0.9 : 0.45,
        weight: 1,
        reason: `${state.inputs.length} input(s) were available for state-aware checks.`,
      },
      {
        name: 'issueConfidence',
        score: issueConfidence,
        weight: 1.5,
        reason:
          issueSummary.total > 0
            ? 'Averaged confidence across diagnostic issues that expose confidence.'
            : 'No diagnostic issues were produced.',
      },
      {
        name: 'severityLoad',
        score: severityScore,
        weight: 1.5,
        reason: `${issueSummary.errors} error(s), ${issueSummary.warnings} warning(s), and ${issueSummary.info} info item(s).`,
      },
      {
        name: 'dynamicParameterLoad',
        score: Math.max(0.45, 1 - dynamicParamCount * 0.12),
        weight: 1,
        reason: `${dynamicParamCount} dynamic parameter(s) could not be fully checked.`,
      },
    ],
    'Confidence reflects static script extraction, current-state context, issue confidence, severity, and dynamic parameters.'
  );
}

function buildScriptAssumptions() {
  return [
    assumptionDetail(
      'The script text is representative of what would be reviewed or copied into vMix.',
      'The tool only validates the supplied static text and does not execute or expand runtime variables.',
      'high',
      0.88
    ),
    assumptionDetail(
      'Dynamic variables may contain values not visible to the validator.',
      'Dynamic Input, SelectedName, Value, or XPath expressions can only be partially checked statically.',
      'high',
      0.62
    ),
    assumptionDetail(
      'Current XML inputs and fields are the right reference set for validation.',
      'Input and title-field checks are grounded in the current vMix state cache.',
      'medium',
      0.84
    ),
  ];
}

function buildRecommendations(issues: ScriptIssue[]): string[] {
  const recommendations: string[] = [];

  if (issues.some((issue) => issue.category === 'vbnet' && issue.severity === 'error')) {
    recommendations.push('Fix VB.NET syntax and loop-safety errors before considering any manual execution.');
  }

  if (issues.some((issue) => issue.category === 'function' && issue.severity === 'error')) {
    recommendations.push('Check unknown function names against the vMix Shortcut Function Reference.');
  }

  if (issues.some((issue) => issue.category === 'inputReference' && issue.severity === 'error')) {
    recommendations.push('Replace missing input references with keys from the current vMix state.');
  }

  if (issues.some((issue) => issue.category === 'titleField' && issue.severity === 'error')) {
    recommendations.push('Use exact SelectedName values from the current title input fields.');
  }

  if (issues.some((issue) => issue.category === 'polling')) {
    recommendations.push('Review polling loops for Sleep() delays, XML refresh timing, and stale state reads.');
  }

  if (issues.some((issue) => issue.category === 'xpath')) {
    recommendations.push('Prefer stable key-based XPath selectors and null-check SelectSingleNode results.');
  }

  if (issues.some((issue) => issue.category === 'dynamic')) {
    recommendations.push('Manually confirm dynamic parameter values before using the script in a production preset.');
  }

  if (issues.some((issue) => issue.category === 'audioBus' || issue.category === 'overlay')) {
    recommendations.push('Fix bus and overlay references so they match vMix limits and the current show routing.');
  }

  if (issues.some((issue) => issue.category === 'layout')) {
    recommendations.push('Review SetLayer and layout-mapping scripts against the current preset layer map before using them live.');
  }

  if (issues.some((issue) => issue.category === 'dataSource')) {
    recommendations.push('Review data-source row maps against the current show roster and data table before using lower-third scripts live.');
  }

  if (issues.some((issue) => issue.category === 'risk')) {
    recommendations.push('Treat show-critical functions as manual-review only in Review Mode.');
  }

  if (recommendations.length === 0) {
    recommendations.push('No blocking issues were found by the current validator.');
  }

  return recommendations;
}

function buildStateContext(state: VmixState) {
  return {
    inputCount: state.inputs.length,
    inputs: state.inputs.map((input) => ({
      number: input.number,
      title: input.title,
      key: input.key,
      type: input.type,
      fields: Object.keys(input.fields ?? {}),
      audioBuses: input.audioBuses,
    })),
  };
}

export function validateScriptAgainstState(
  state: VmixState,
  code: string,
  options: ScriptValidationOptions = {}
) {
  const baseValidation = validateVmixScript(code);
  const apiCalls = extractApiCalls(code);
  const issues: ScriptIssue[] = [
    ...baseValidation.errors.map((message) => ({
      severity: 'error' as const,
      category: 'vbnet' as const,
      message,
    })),
    ...baseValidation.warnings.map((message) => ({
      severity: 'warning' as const,
      category: 'vbnet' as const,
      message,
    })),
    ...validateFunctionNames(apiCalls),
    ...validateOverlayFunctions(apiCalls),
    ...validateInputReferences(state, apiCalls, options),
    ...validateTitleFields(state, apiCalls),
    ...validateAudioBuses(apiCalls),
    ...validateVideoCallAudioSourceValues(apiCalls),
    ...validateDataSourceRowSelection(apiCalls),
    ...validateLayerFunctions(state, apiCalls, options),
    ...validateLayoutMutationPatterns(code, apiCalls),
    ...validateRiskyFunctions(apiCalls),
    ...validateVmixDialectRisks(code),
    ...validateXpathReferences(state, code, options),
    ...validatePollingPatterns(code),
    ...validateQuestionableXpath(state, code),
  ];
  const issueSummary = summarizeIssues(issues);

  return {
    baseValidation,
    valid: issueSummary.errors === 0,
    issueSummary,
    issues,
    scriptingDiagnostics: buildScriptingDiagnostics(issues),
    apiCalls: apiCalls.map((call) => ({
      line: call.line,
      functionName: call.functionName,
      known: isKnownFunction(call.functionName),
      params: call.params,
      dynamicParams: call.dynamicParams,
    })),
    recommendations: buildRecommendations(issues),
    stateContext: buildStateContext(state),
    analysisConfidence: buildScriptValidationConfidence(state, apiCalls, issues),
    assumptions: [
      'Validation is based on the current vMix XML cache and static script text.',
      'Dynamic variables and runtime XPath results are reported as review items when they cannot be proven from the script text.',
    ],
    assumptionDetails: buildScriptAssumptions(),
    parserLimitations: [
      'The runtime function allowlist is curated for this MCP and may not include every official vMix shortcut yet.',
      'The current state parser does not expose every vMix title, data source, trigger, mix output destination, or audio-meter detail.',
    ],
  };
}

export const validateScriptTool = createTool({
  name: 'vmix_validate_script',
  description:
    'Read-only validation for vMix VB.NET scripts. Checks VB.NET gotchas, unsafe loops, vMix function names, ' +
    'current input references, title fields, audio buses, overlay channels, and show-critical actions without execution.',
  schema: z.object({
    code: z.string().min(1).describe('VB.NET script code to validate. The script is not executed.'),
  }),
  handler: async ({ code }: { code: string }, ctx: ToolContext) => {
    const state = await ctx.state.getState();
    const validation = validateScriptAgainstState(state, code);

    const result = {
      mode: 'readOnlyScriptValidation',
      execution: {
        executed: false,
        note: 'This tool validates only. It never runs scripts, saves files, or calls vMix API functions.',
      },
      valid: validation.valid,
      issueSummary: validation.issueSummary,
      issues: validation.issues,
      scriptingDiagnostics: validation.scriptingDiagnostics,
      apiCalls: validation.apiCalls,
      recommendations: validation.recommendations,
      stateContext: validation.stateContext,
      analysisConfidence: validation.analysisConfidence,
      assumptions: validation.assumptions,
      assumptionDetails: validation.assumptionDetails,
      parserLimitations: validation.parserLimitations,
    };

    return toolJsonContent(result, !result.valid);
  },
});

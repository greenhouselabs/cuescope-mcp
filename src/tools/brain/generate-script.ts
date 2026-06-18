/**
 * vmix_generate_script - Read-only VB.NET script generation artifact
 */

import { z } from 'zod';
import { createTool, toolJsonContent, type ToolContext } from '../base.js';
import type { VmixInput, VmixState } from '../../state/types.js';
import type { ScriptValidationResult } from '../../validation/script-validator.js';
import { assumptionDetail, buildAnalysisConfidence } from './analysis-metadata.js';
import { validateScriptAgainstState } from './validate-script.js';
import {
  analyzeInput,
  isLikelyAudioSource,
  summarizeRequiredInput,
  type InputAnalysis,
} from './analysis-helpers.js';
import {
  describeInput,
  extractFieldValues,
  parseOverlayChannel,
  parseSeconds,
  stableInputReference,
} from './goal-parsing.js';
import {
  findPairedAudioMappings,
  isPairedAudioGoal,
  mappingUsesMaster,
  parsePairedAudioGenerationOptions,
  type PairedAudioGenerationOptions,
  type PairedAudioMapping,
} from './paired-audio.js';
import { getAutomationPreflightHandoff, type AutomationPreflightHandoff } from './preflight-handoff.js';
import { escapeXPath } from '../../utils/input-resolver.js';

type Pattern =
  | 'cameraCycle'
  | 'timedOverlay'
  | 'videoEndTrigger'
  | 'titleTextUpdate'
  | 'programTitleWatcher'
  | 'slotLowerThird'
  | 'talkbackReturn'
  | 'layoutCleanup'
  | 'audioDucking'
  | 'pairedAudioFollow'
  | 'recordingControl'
  | 'customTemplate';

type ReviewStatus = 'readyForReview' | 'needsHumanEdits' | 'blocked';
type LiveImpact = 'none' | 'low' | 'medium' | 'high';
type ReferenceKind = 'key' | 'number' | 'exactTitle';
type ReferenceAuditStatus = 'compliant' | 'fallbackUsed' | 'reviewRequired' | 'blocked';

interface ScriptArtifact {
  pattern: Pattern;
  confidence: number;
  explanation: string;
  code: string;
  requiredInputs: InputAnalysis[];
  requiredFields: Array<{
    input: InputAnalysis;
    fields: string[];
  }>;
  assumptions: string[];
  setupSteps: string[];
  testSteps: string[];
  failureModes: string[];
  warnings: string[];
}

interface ProgramTitleWatcherPair {
  watchedInput: VmixInput;
  drivenInput: VmixInput;
  selectedField: string;
}

interface GoalSummary {
  originalGoal: string;
  interpretedIntent: string;
  matchedPattern: Pattern;
  confidence: number;
  supportedPattern: boolean;
  liveImpactIfRun: LiveImpact;
}

interface CompilerWorkflow {
  artifactType: 'vbnet-script';
  readOnlyGeneration: true;
  operatorExecutionRequired: true;
  stages: Array<{
    name: string;
    status: 'complete' | 'reviewRequired' | 'blocked';
    detail: string;
  }>;
}

type StateAwareScriptValidation = ReturnType<typeof validateScriptAgainstState>;

interface ReferenceAudit {
  status: ReferenceAuditStatus;
  checkedReferences: Array<{
    title: string;
    stableReference: string;
    referenceKind: ReferenceKind;
    referencedInScript: boolean;
    usages: string[];
  }>;
  fallbackReferences: Array<{
    title: string;
    referenceKind: ReferenceKind;
    reason: string;
  }>;
  exactTitleFallbacks: string[];
  fuzzyTitleMatches: string[];
  unresolvedReferences: string[];
  warnings: string[];
}

interface ReferencePlan {
  preferenceOrder: Array<'key' | 'number' | 'exactTitle' | 'fuzzyTitleSuggestionOnly'>;
  policy: {
    generatedInputReferences: 'key-then-number';
    exactTitles: 'allowed-only-when-no-key-or-number-reference-is-available';
    fuzzyTitles: 'suggestions-only-never-committed';
  };
  resolvedInputs: Array<{
    number: number;
    title: string;
    type: string;
    stableReference: string;
    referenceKind: ReferenceKind;
    productionRole: string;
  }>;
  explicitGoalReferences: Array<{
    text: string;
    matched: boolean;
    matchedBy: ReferenceKind | null;
    resolvedTitle: string | null;
    suggestions: string[];
  }>;
  unresolvedReferences: string[];
  audit: ReferenceAudit;
  note: string;
}

interface ExecutionBoundary {
  currentMode: 'review';
  executed: false;
  controlModeFlag: 'VMIX_CONTROL_MODE=true';
  fullPolicy: 'vmix://server/status';
}

interface ProductionScriptReview {
  isPersistentLoop: boolean;
  hasHighImpactActions: boolean;
  liveImpactIfRun: LiveImpact;
  highImpactEvidence: string[];
  warnings: string[];
  setupSteps: string[];
  testSteps: string[];
  failureModes: string[];
}

function escapeVbString(value: string): string {
  return value.replace(/"/g, '""');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stableReferenceKind(input: { key: string }): 'key' | 'number' {
  return input.key.length > 0 ? 'key' : 'number';
}

function quotedInputReference(input: VmixInput): string {
  return `"${escapeVbString(stableInputReference(input))}"`;
}

function inputXPathSelector(input: VmixInput): string {
  if (input.key.length > 0) {
    // escapeXPath produces a correctly quoted XPath string literal (handles
    // embedded single quotes via concat). VB string escaping is applied at the
    // point where the selector is embedded in generated VB code.
    return `//input[@key=${escapeXPath(input.key)}]`;
  }

  return `//input[@number='${input.number}']`;
}

function findLiveSources(state: VmixState, goal: string): VmixInput[] {
  const lowerGoal = goal.toLowerCase();
  const analyses = state.inputs.map((input) => ({ input, analysis: analyzeInput(input) }));
  const includeGuests = lowerGoal.includes('guest') || lowerGoal.includes('call');
  const roles = includeGuests ? ['camera', 'remoteGuest'] : ['camera'];
  const roleMatches = analyses
    .filter(({ analysis }) => roles.includes(analysis.role))
    .map(({ input }) => input);

  if (roleMatches.length > 0) return roleMatches;

  return state.inputs.filter(
    (input) =>
      input.type.toLowerCase().includes('capture') ||
      input.title.toLowerCase().includes('cam') ||
      input.title.toLowerCase().includes('camera')
  );
}

function findTitleInput(state: VmixState): VmixInput | null {
  return (
    state.inputs.find((input) => analyzeInput(input).role === 'titleGraphic') ??
    state.inputs.find((input) => Object.keys(input.fields ?? {}).length > 0) ??
    null
  );
}

function findExplicitTitleInputs(state: VmixState, goal: string): VmixInput[] {
  const titleInputs = state.inputs.filter(
    (input) => analyzeInput(input).role === 'titleGraphic' || Object.keys(input.fields ?? {}).length > 0
  );
  const lowerGoal = goal.toLowerCase();
  const explicitTitleMatches = titleInputs
    .filter((input) => input.title.length > 0 && lowerGoal.includes(input.title.toLowerCase()));
  const rangeMatches = findExplicitTitleRangeInputs(titleInputs, goal);
  const resolvedReferences: VmixInput[] = [];

  for (const reference of extractTitleTargetTexts(goal)) {
    const resolved = resolveExactInputReference(state, reference);
    if (resolved && titleInputs.includes(resolved.input)) {
      resolvedReferences.push(resolved.input);
    }
  }

  return uniqueInputs([...rangeMatches, ...explicitTitleMatches, ...resolvedReferences], state);
}

function uniqueInputs(inputs: VmixInput[], state: VmixState): VmixInput[] {
  const seen = new Set<string>();
  const unique: VmixInput[] = [];

  for (const input of inputs) {
    const key = input.key.length > 0 ? `key:${input.key}` : `number:${input.number}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(input);
  }

  return unique.sort((left, right) => state.inputs.indexOf(left) - state.inputs.indexOf(right));
}

function parseTrailingTitleNumber(title: string): { prefix: string; number: number } | null {
  const match = title.match(/^(.*?)(\d+)\s*$/);
  if (!match?.[1] || !match[2]) return null;

  const number = parseInt(match[2], 10);
  if (!Number.isFinite(number)) return null;

  return {
    prefix: match[1],
    number,
  };
}

function findExplicitInputRangeInputs(inputs: VmixInput[], goal: string): VmixInput[] {
  const matches: VmixInput[] = [];

  for (const start of inputs) {
    const startParts = parseTrailingTitleNumber(start.title);
    if (!startParts) continue;

    for (const end of inputs) {
      if (start === end) continue;

      const endParts = parseTrailingTitleNumber(end.title);
      if (endParts?.prefix !== startParts.prefix) continue;

      const rangePattern = new RegExp(
        `${escapeRegExp(start.title)}\\s*(?:through|thru|to|-)\\s*${escapeRegExp(end.title)}`,
        'i'
      );
      if (!rangePattern.test(goal)) continue;

      const first = Math.min(startParts.number, endParts.number);
      const last = Math.max(startParts.number, endParts.number);
      matches.push(
        ...inputs.filter((input) => {
          const parts = parseTrailingTitleNumber(input.title);
          return parts?.prefix === startParts.prefix && parts.number >= first && parts.number <= last;
        })
      );
    }
  }

  return matches;
}

function findExplicitTitleRangeInputs(titleInputs: VmixInput[], goal: string): VmixInput[] {
  return findExplicitInputRangeInputs(titleInputs, goal);
}

function findOverlayInput(state: VmixState): VmixInput | null {
  return (
    state.inputs.find((input) => {
      const analysis = analyzeInput(input);
      return analysis.role === 'titleGraphic' || analysis.role === 'imageGraphic';
    }) ??
    state.inputs.find((input) => {
      const title = input.title.toLowerCase();
      return title.includes('lower') || title.includes('graphic') || title.includes('overlay');
    }) ??
    null
  );
}

function isSlotMapCandidate(input: VmixInput): boolean {
  const title = input.title.toLowerCase();
  return title.includes('layout') || title.includes('multiview') || /\bmix\b/i.test(input.title);
}

function findSlotMapInput(state: VmixState, goal: string): VmixInput | null {
  const lowerGoal = goal.toLowerCase();
  const candidates = state.inputs.filter(isSlotMapCandidate);

  return (
    candidates.find((input) => input.title.length > 0 && lowerGoal.includes(input.title.toLowerCase())) ??
    candidates[0] ??
    null
  );
}

function findClearInput(state: VmixState, goal: string): VmixInput | null {
  const lowerGoal = goal.toLowerCase();
  const candidates = state.inputs.filter((input) =>
    /\b(clear|transparent|blank|empty|alpha|placeholder|matte)\b/i.test(input.title)
  );

  return (
    candidates.find((input) => input.title.length > 0 && lowerGoal.includes(input.title.toLowerCase())) ??
    candidates[0] ??
    null
  );
}

function isSlotDrivenLowerThirdGoal(goal: string): boolean {
  const lowerGoal = goal.toLowerCase();

  return (
    (lowerGoal.includes('lower third') || lowerGoal.includes('lower-third')) &&
    /\b(slot|layout|multiview|multi-view|layer|occupant|assigned)\b/i.test(goal) &&
    /\b(row|data source|datasource|participant|caller|guest|host|occupant|assigned)\b/i.test(goal)
  );
}

function parseRequestedSlotNumber(goal: string): number {
  const match = goal.match(/\b(?:slot|layer|mix)\s*(\d+)\b/i);
  const value = match?.[1] ? parseInt(match[1], 10) : NaN;
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function isTalkbackReturnGoal(goal: string): boolean {
  return /\btalkback\b/i.test(goal) && /\b(call|caller|guest|slot|layout|return|mic|bus)\b/i.test(goal);
}

function isLayoutCleanupGoal(goal: string): boolean {
  return (
    /\b(clean\s*up|cleanup|fill|repair|normalize|normalise|missing|sparse|blank|clear)\b/i.test(goal) &&
    /\b(layout|multiview|multi-view|layer|layers|slot|slots)\b/i.test(goal) &&
    /\b(clear|transparent|blank|missing|empty|placeholder)\b/i.test(goal)
  );
}

function parseExpectedLayerNumbers(goal: string): number[] {
  const rangeMatch = goal.match(/\blayers?\s+(\d+)\s*(?:-|to|through)\s*(\d+)\b/i);
  if (rangeMatch?.[1] && rangeMatch[2]) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (Number.isFinite(start) && Number.isFinite(end) && start > 0 && end >= start && end - start <= 20) {
      return Array.from({ length: end - start + 1 }, (_value, index) => start + index);
    }
  }

  const countMatch = goal.match(/\b(?:first|top|all)?\s*(\d+)\s+(?:layout\s+)?layers?\b/i);
  if (countMatch?.[1]) {
    const count = parseInt(countMatch[1], 10);
    if (Number.isFinite(count) && count > 0 && count <= 20) {
      return Array.from({ length: count }, (_value, index) => index + 1);
    }
  }

  return [1, 2, 3, 4];
}

function isTalkbackOffGoal(goal: string): boolean {
  return /\b(off|disable|stop|end|normal|restore)\b/i.test(goal);
}

function findTalkbackMicInput(state: VmixState, goal: string): VmixInput | null {
  const lowerGoal = goal.toLowerCase();
  const candidates = state.inputs.filter((input) => {
    const title = input.title.toLowerCase();
    return title.includes('mic') || title.includes('microphone');
  });

  return (
    candidates.find((input) => input.title.length > 0 && lowerGoal.includes(input.title.toLowerCase())) ??
    candidates.find((input) => /op|operator|prod|producer|talkback/i.test(input.title)) ??
    candidates[0] ??
    null
  );
}

function findMediaInput(state: VmixState): VmixInput | null {
  return (
    state.inputs.find((input) => analyzeInput(input).role === 'mediaPlayback') ??
    state.inputs.find((input) => input.duration > 0) ??
    null
  );
}

function extractSwitchTargetText(goal: string): string | null {
  const targetMatch = goal.match(/(?:cut|switch|fade)\s+to\s+["']?([^"',\n]+)["']?/i);
  const targetText = targetMatch?.[1]?.trim();
  return targetText && targetText.length > 0 ? targetText : null;
}

function extractTitleTargetTexts(goal: string): string[] {
  const references: string[] = [];
  const patterns = [
    /(?:on|for|in)\s+(?:the\s+)?(?:title\s+)?input\s+["']?(.+?)["']?\s+(?:field|selectedname|to|with|then|,|$)/gi,
    /(?:on|for|in)\s+(?:the\s+)?title\s+["']?(.+?)["']?\s+(?:field|selectedname|to|with|then|,|$)/gi,
  ];

  for (const pattern of patterns) {
    for (const match of goal.matchAll(pattern)) {
      const reference = match[1]?.trim();
      if (reference) references.push(reference);
    }
  }

  return [...new Set(references)];
}

function parseDelayMs(goal: string): number | null {
  const sleepCallMatch = goal.match(/\bSleep\s*\(\s*(\d+)\s*\)/i);
  if (sleepCallMatch?.[1]) {
    const value = parseInt(sleepCallMatch[1], 10);
    if (Number.isFinite(value) && value > 0) return value;
  }

  const match = goal.match(/\b(?:wait|sleep|delay)\s+(?:for\s+)?(\d+)\s*(milliseconds?|msecs?|ms|seconds?|secs?|s)\b/i);
  if (!match?.[1] || !match[2]) return null;

  const value = parseInt(match[1], 10);
  if (!Number.isFinite(value) || value <= 0) return null;

  return /^s/i.test(match[2]) ? value * 1000 : value;
}

function commonTitleFields(inputs: VmixInput[]): string[] {
  const firstInput = inputs[0];
  if (!firstInput) return [];

  return Object.keys(firstInput.fields ?? {}).filter((field) =>
    inputs.every((input) => Object.prototype.hasOwnProperty.call(input.fields ?? {}, field))
  );
}

function splitNaturalValueList(valueText: string): string[] {
  return valueText
    .replace(/\s+respectively\b/gi, '')
    .replace(/\s+and\s+/gi, ', ')
    .split(',')
    .map((value) => value.trim().replace(/^["']|["']$/g, ''))
    .filter((value) => value.length > 0);
}

function extractBatchFieldValues(goal: string, field: string, count: number): string[] {
  if (count < 2) return [];

  const baseName = field.replace(/\.(text|image)$/i, '');
  const fieldNames = [field, ...(baseName !== field ? [baseName] : [])]
    .map(escapeRegExp)
    .join('|');
  const boundary =
    '(?=\\s+respectively\\b|\\.\\s|\\s+Use\\b|\\s+Include\\b|\\s+Add\\b|\\s+Do not\\b|$)';
  const patterns = [
    new RegExp(`(?:${fieldNames})\\b[\\s\\S]*?\\bto\\s+(.+?)${boundary}`, 'i'),
    new RegExp(`\\bto\\s+(.+?)\\s+respectively\\b`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = goal.match(pattern);
    const values = match?.[1] ? splitNaturalValueList(match[1]) : [];
    if (values.length >= count) return values.slice(0, count);
  }

  return [];
}

function isTitleLikeInput(input: VmixInput): boolean {
  return analyzeInput(input).role === 'titleGraphic' || Object.keys(input.fields ?? {}).length > 0;
}

function findProgramWatcherInput(
  state: VmixState,
  goal: string,
  drivenTitleInput: VmixInput
): VmixInput | null {
  const lowerGoal = goal.toLowerCase();
  const exactMatches = state.inputs.filter(
    (input) =>
      input !== drivenTitleInput &&
      input.title.length > 0 &&
      lowerGoal.includes(input.title.toLowerCase())
  );
  const nonTitleMatch = exactMatches.find((input) => !isTitleLikeInput(input));

  return nonTitleMatch ?? exactMatches[0] ?? null;
}

function findProgramWatcherCandidateInputs(
  state: VmixState,
  goal: string,
  drivenTitleInputs: VmixInput[]
): VmixInput[] {
  const lowerGoal = goal.toLowerCase();
  const drivenSet = new Set(drivenTitleInputs);
  const nonTitleInputs = state.inputs.filter((input) => !drivenSet.has(input) && !isTitleLikeInput(input));
  const exactMatches = nonTitleInputs.filter(
    (input) => input.title.length > 0 && lowerGoal.includes(input.title.toLowerCase())
  );
  const rangeMatches = findExplicitInputRangeInputs(nonTitleInputs, goal);

  return uniqueInputs([...rangeMatches, ...exactMatches], state);
}

function findNumberMatchedWatchedInput(
  drivenInput: VmixInput,
  watchedCandidates: VmixInput[]
): VmixInput | null {
  const drivenParts = parseTrailingTitleNumber(drivenInput.title);
  if (!drivenParts) return null;

  return (
    watchedCandidates.find((candidate) => {
      const candidateParts = parseTrailingTitleNumber(candidate.title);
      return candidateParts?.number === drivenParts.number;
    }) ?? null
  );
}

function findProgramWatcherPairs(
  state: VmixState,
  goal: string,
  drivenInputs: VmixInput[]
): ProgramTitleWatcherPair[] {
  const watchedCandidates = findProgramWatcherCandidateInputs(state, goal, drivenInputs);
  const pairs: ProgramTitleWatcherPair[] = [];

  for (const drivenInput of drivenInputs) {
    const fields = Object.keys(drivenInput.fields ?? {});
    const selectedField = selectRequestedTitleField(goal, fields);
    if (!selectedField) continue;

    const watchedInput =
      findNumberMatchedWatchedInput(drivenInput, watchedCandidates) ??
      (drivenInputs.length === 1 ? findProgramWatcherInput(state, goal, drivenInput) : null);

    if (!watchedInput) continue;

    pairs.push({ watchedInput, drivenInput, selectedField });
  }

  return pairs;
}

function selectRequestedTitleField(goal: string, fields: string[]): string | null {
  return (
    fields.find((field) => new RegExp(escapeRegExp(field), 'i').test(goal)) ??
    fields.find((field) => /\.text$/i.test(field)) ??
    fields[0] ??
    null
  );
}

function cleanExtractedTextValue(value: string): string {
  return value
    .replace(/\s+\b(?:when|if|while|unless)\b.+$/i, '')
    .trim();
}

function extractTextValueAfterTo(sentence: string): string | null {
  const setterMatches = [
    ...sentence.matchAll(
      /\b(?:set|write|show|display|update|change)\b[^.!?;\r\n]*?\bto\s+["']?([^"',.;]+)["']?/gi
    ),
  ];
  const fallbackMatches = [...sentence.matchAll(/\bto\s+["']?([^"',.;]+)["']?/gi)];
  const match = setterMatches[setterMatches.length - 1] ?? fallbackMatches[fallbackMatches.length - 1];
  const value = match?.[1] ? cleanExtractedTextValue(match[1]) : null;
  return value && value.length > 0 ? value : null;
}

function splitProgramWatcherClauses(goal: string): string[] {
  return goal
    .replace(/\s+\b(otherwise|else)\b/gi, '. $1')
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function extractProgramWatcherValues(goal: string): { onText: string; offText: string } {
  const sentences = splitProgramWatcherClauses(goal);
  const onSentence = sentences.find(
    (sentence) =>
      /\b(?:in\s+Program|on\s+Program|live)\b/i.test(sentence) &&
      !/\b(?:not|is\s+not|isn't)\s+(?:in\s+Program|on\s+Program|live)\b/i.test(sentence) &&
      !/\b(?:otherwise|else)\b/i.test(sentence) &&
      /\bto\b/i.test(sentence)
  );
  const offSentence = sentences.find(
    (sentence) =>
      (/\b(?:not|is\s+not|isn't)\s+(?:in\s+Program|on\s+Program|live)\b/i.test(sentence) ||
        /\b(?:otherwise|else)\b/i.test(sentence)) &&
      /\bto\b/i.test(sentence)
  );

  return {
    onText: (onSentence ? extractTextValueAfterTo(onSentence) : null) ?? 'ON AIR',
    offText: (offSentence ? extractTextValueAfterTo(offSentence) : null) ?? 'STANDBY',
  };
}

function usesDynamicProgramSourceLabel(goal: string): boolean {
  return /\bcurrent\s+Program\s+source\s+(?:label|title|name)\b/i.test(goal) ||
    /\bcurrent\s+Program\s+input\s+(?:label|title|name)\b/i.test(goal) ||
    /\bactive\s+Program\s+(?:source\s+|input\s+)?(?:label|title|name)\b/i.test(goal) ||
    /\bProgram\s+source\s+(?:label|title|name)\b/i.test(goal) ||
    /\bProgram\s+input\s+(?:label|title|name)\b/i.test(goal) ||
    /\blive\s+Program\s+(?:label|title|name)\b/i.test(goal);
}

function resolveExactInputReference(
  state: VmixState,
  reference: string
): { input: VmixInput; matchedBy: ReferenceKind } | null {
  const trimmed = reference.trim();
  const lower = trimmed.toLowerCase();

  const keyMatch = state.inputs.find((input) => input.key.toLowerCase() === lower);
  if (keyMatch) return { input: keyMatch, matchedBy: 'key' };

  if (/^\d+$/.test(trimmed)) {
    const number = parseInt(trimmed, 10);
    const numberMatch = state.inputs.find((input) => input.number === number);
    if (numberMatch) return { input: numberMatch, matchedBy: 'number' };
  }

  const titleMatch = state.inputs.find((input) => input.title === trimmed);
  if (titleMatch) return { input: titleMatch, matchedBy: 'exactTitle' };

  return null;
}

function findFuzzyInputSuggestions(state: VmixState, reference: string): string[] {
  const lower = reference.toLowerCase();

  return state.inputs
    .filter((input) => {
      const title = input.title.toLowerCase();
      return title.includes(lower) || lower.includes(title);
    })
    .slice(0, 5)
    .map((input) => `${input.number}: ${input.title} (${input.key || 'no key'})`);
}

function extractExplicitGoalReferences(goal: string): string[] {
  const targetText = extractSwitchTargetText(goal);
  return [...new Set([...(targetText ? [targetText] : []), ...extractTitleTargetTexts(goal)])];
}

function findTargetInput(state: VmixState, goal: string): VmixInput | null {
  const targetText = extractSwitchTargetText(goal);

  if (targetText) {
    return resolveExactInputReference(state, targetText)?.input ?? null;
  }

  return findLiveSources(state, goal)[0] ?? null;
}

function findAudioDuckingInputs(state: VmixState): { trigger: VmixInput; duck: VmixInput } | null {
  const analyses = state.inputs.map((input) => ({ input, analysis: analyzeInput(input) }));
  const trigger =
    analyses.find(({ input }) => {
      const title = input.title.toLowerCase();
      return title.includes('mic') || title.includes('host') || title.includes('voice');
    })?.input ??
    analyses.find(({ analysis }) => analysis.role === 'camera' || analysis.role === 'remoteGuest')?.input;
  const duck =
    analyses.find(({ input }) => {
      const title = input.title.toLowerCase();
      return title.includes('music') || title.includes('bed') || title.includes('background');
    })?.input ??
    analyses.find(({ analysis, input }) => analysis.role === 'audioOnly' && input !== trigger)?.input;

  return trigger && duck ? { trigger, duck } : null;
}

function buildCameraCycleArtifact(state: VmixState, goal: string): ScriptArtifact | null {
  const inputs = findLiveSources(state, goal);
  if (inputs.length < 2) return null;

  const seconds = parseSeconds(goal, 10);
  const transition = goal.toLowerCase().includes('fade') ? 'Fade' : 'Cut';
  const inputList = inputs.map(quotedInputReference).join(', ');
  const code = `' Auto-cycle through live sources
Dim inputs() As String = {${inputList}}
Dim index As Integer = 0

Do While True
    API.Function("${transition}", Input:=inputs(index))
    index = (index + 1) Mod inputs.Length
    Sleep(${seconds * 1000})
Loop`;

  return {
    pattern: 'cameraCycle',
    confidence: 0.86,
    explanation: `Cycles through ${inputs.length} live source(s) every ${seconds} seconds using ${transition}.`,
    code,
    requiredInputs: inputs.map(analyzeInput),
    requiredFields: [],
    assumptions: [
      'This is intended as a manually reviewed vMix script, not something this MCP executes.',
      'Input keys are used when available because they are more stable than titles or input numbers.',
    ],
    setupSteps: [
      'Review the input order in the generated inputs array.',
      'Paste the script into vMix Scripting only after confirming the transition cadence.',
    ],
    testSteps: [
      'Run in a duplicate preset or rehearsal show first.',
      'Confirm each listed source appears in order.',
      'Stop the script manually when testing is complete because it loops by design.',
    ],
    failureModes: [
      'The script loops until stopped.',
      'Renamed titles are tolerated when keys are available; deleted/recreated inputs can still change keys.',
    ],
    warnings: [],
  };
}

function buildTimedOverlayArtifact(state: VmixState, goal: string): ScriptArtifact | null {
  const input = findOverlayInput(state);
  if (!input) return null;

  const seconds = parseSeconds(goal, 5);
  const channel = parseOverlayChannel(goal);
  const code = `' Show overlay for ${seconds} seconds
API.Function("OverlayInput${channel}In", Input:=${quotedInputReference(input)})
Sleep(${seconds * 1000})
API.Function("OverlayInput${channel}Out")`;

  return {
    pattern: 'timedOverlay',
    confidence: 0.84,
    explanation: `Shows ${input.title} on overlay channel ${channel} for ${seconds} seconds, then hides it.`,
    code,
    requiredInputs: [analyzeInput(input)],
    requiredFields: [],
    assumptions: [
      'Overlay channels are 1-4 in vMix.',
      'The selected graphic input is inferred from current input type/title because the goal did not include a formal input reference.',
    ],
    setupSteps: [
      `Confirm ${input.title} is the graphic intended for overlay channel ${channel}.`,
      'Adjust the overlay channel in the script if your show uses a different channel.',
    ],
    testSteps: [
      'Run during rehearsal and confirm the overlay appears and clears after the expected duration.',
      'Check that the channel is not already reserved for another always-on graphic.',
    ],
    failureModes: [
      'If the input key changes, update the Input value before using the script.',
      'If another graphic is already on the same channel, this script may replace or clear the wrong overlay.',
    ],
    warnings: [],
  };
}

function buildSlotLowerThirdArtifact(state: VmixState, goal: string): ScriptArtifact | null {
  const slotMapInput = findSlotMapInput(state, goal);
  const lowerThirdInput = findOverlayInput(state);

  if (!slotMapInput || !lowerThirdInput) return null;

  const requestedSlotNumber = parseRequestedSlotNumber(goal);
  const slotIndex = Math.max(0, requestedSlotNumber - 1);
  const seconds = parseSeconds(goal, 5);
  const channel = parseOverlayChannel(goal);
  const slotMapSelector = escapeVbString(inputXPathSelector(slotMapInput));
  const code = `' Slot-driven lower third scaffold
' REVIEW ARTIFACT - fill in the row map before using.
' Slot map: #${slotMapInput.number} ${escapeVbString(slotMapInput.title)}
' Lower third: #${lowerThirdInput.number} ${escapeVbString(lowerThirdInput.title)}
Dim slotMapSelector As String = "${slotMapSelector}"
Dim lowerThirdInput As String = ${quotedInputReference(lowerThirdInput)}
Dim slotIndex As Integer = ${slotIndex}
Dim displayMs As Integer = ${seconds * 1000}

Dim xml As String = API.XML()
If xml <> "" Then
    Dim doc As New System.Xml.XmlDocument
    doc.LoadXml(xml)

    Dim slotMapNode As System.Xml.XmlNode = doc.SelectSingleNode(slotMapSelector)
    If slotMapNode IsNot Nothing Then
        Dim overlayNodes As System.Xml.XmlNodeList = slotMapNode.SelectNodes("overlay")

        If overlayNodes IsNot Nothing AndAlso overlayNodes.Count > slotIndex Then
            Dim slotNode As System.Xml.XmlNode = overlayNodes.Item(slotIndex)

            If slotNode IsNot Nothing AndAlso slotNode.Attributes("key") IsNot Nothing Then
                Dim assignedKey As String = slotNode.Attributes("key").Value
                Dim assignedInputSelector As String = "//input[@key='" & assignedKey & "']"
                Dim assignedInputNode As System.Xml.XmlNode = doc.SelectSingleNode(assignedInputSelector)

                If assignedInputNode IsNot Nothing AndAlso assignedInputNode.Attributes("title") IsNot Nothing Then
                    Dim assignedTitle As String = assignedInputNode.Attributes("title").Value
                    Dim rowMatched As Boolean = False

                    Select Case assignedTitle
                        Case "REPLACE_WITH_PARTICIPANT_TITLE"
                            API.Function("DataSourceSelectRow", Value:="REPLACE_WITH_TABLE_NAME,1")
                            rowMatched = True
                        Case Else
                            ' No reviewed row mapping for this assigned input.
                    End Select

                    If rowMatched Then
                        API.Function("OverlayInput${channel}In", Input:=lowerThirdInput)
                        Sleep(displayMs)
                        API.Function("OverlayInput${channel}Out")
                    End If
                End If
            End If
        End If
    End If
End If`;

  return {
    pattern: 'slotLowerThird',
    confidence: 0.72,
    explanation:
      `Builds a reviewed slot-driven lower-third scaffold using ${slotMapInput.title} slot ${requestedSlotNumber} and ${lowerThirdInput.title}.`,
    code,
    requiredInputs: [slotMapInput, lowerThirdInput].map(analyzeInput),
    requiredFields: [],
    assumptions: [
      'The selected multiview/layout input is treated as the source of truth for the slot occupant.',
      'The slot number is converted to a zero-based overlay node index and must be reviewed against the preset.',
      'Data-source table names and row numbers are production-specific and intentionally left as placeholders.',
    ],
    setupSteps: [
      `Confirm ${slotMapInput.title} is the correct slot map input and slot ${requestedSlotNumber} is the intended position.`,
      `Confirm ${lowerThirdInput.title} is the lower-third graphic for overlay channel ${channel}.`,
      'Replace REPLACE_WITH_PARTICIPANT_TITLE and REPLACE_WITH_TABLE_NAME,row entries with the reviewed show row map.',
    ],
    testSteps: [
      'Run validation after filling in the row map.',
      'Test each mapped participant in rehearsal and confirm only the intended lower-third row appears.',
      'Change the slot occupant between tests to confirm the lookup follows the reviewed layout position.',
    ],
    failureModes: [
      'If the layout slot order differs from the assumed overlay node index, the script can show the wrong row.',
      'If the data-source row map drifts from the show roster, the lower third can display the wrong person.',
      'If the same overlay channel is reused by another graphic, the timed OverlayInputOut call can clear the wrong graphic.',
    ],
    warnings: [
      'Row-map placeholders must be replaced before this script is copy-ready.',
      'Slot-driven lower thirds are preset-specific; verify the slot map, overlay channel, and data-source table against the current show.',
    ],
  };
}

function buildTalkbackReturnArtifact(state: VmixState, goal: string): ScriptArtifact | null {
  const slotMapInput = findSlotMapInput(state, goal);
  const micInput = findTalkbackMicInput(state, goal);

  if (!slotMapInput || !micInput) return null;

  const requestedSlotNumber = parseRequestedSlotNumber(goal);
  const slotIndex = Math.max(0, requestedSlotNumber - 1);
  const slotMapSelector = escapeVbString(inputXPathSelector(slotMapInput));
  const turnOff = isTalkbackOffGoal(goal);
  const actionName = turnOff ? 'Off' : 'On';
  const busFunction = turnOff ? 'AudioBusOff' : 'AudioBusOn';
  const returnVariable = turnOff ? 'callerNormalReturn' : 'callerTalkbackReturn';
  const code = `' Slot-driven vMix Call talkback ${actionName} scaffold
' REVIEW ARTIFACT - fill in return source and bus settings before using.
' Slot map: #${slotMapInput.number} ${escapeVbString(slotMapInput.title)}
' Operator mic: #${micInput.number} ${escapeVbString(micInput.title)}
Dim slotMapSelector As String = "${slotMapSelector}"
Dim operatorMicInput As String = ${quotedInputReference(micInput)}
Dim slotIndex As Integer = ${slotIndex}
Dim callerTalkbackReturn As String = "REPLACE_WITH_CALLER_TALKBACK_SOURCE"
Dim callerNormalReturn As String = "REPLACE_WITH_CALLER_NORMAL_SOURCE"
Dim operatorMicBus As String = "REPLACE_WITH_TALKBACK_BUS_LETTER"

Dim xml As String = API.XML()
If xml <> "" Then
    Dim doc As New System.Xml.XmlDocument
    doc.LoadXml(xml)

    Dim slotMapNode As System.Xml.XmlNode = doc.SelectSingleNode(slotMapSelector)
    If slotMapNode IsNot Nothing Then
        Dim overlayNodes As System.Xml.XmlNodeList = slotMapNode.SelectNodes("overlay")

        If overlayNodes IsNot Nothing AndAlso overlayNodes.Count > slotIndex Then
            Dim slotNode As System.Xml.XmlNode = overlayNodes.Item(slotIndex)

            If slotNode IsNot Nothing AndAlso slotNode.Attributes("key") IsNot Nothing Then
                Dim callerInput As String = slotNode.Attributes("key").Value

                If callerInput <> "" Then
                    API.Function("VideoCallAudioSource", Input:=callerInput, Value:=${returnVariable})
                    API.Function("${busFunction}", Input:=operatorMicInput, Value:=operatorMicBus)
                End If
            End If
        End If
    End If
End If`;

  return {
    pattern: 'talkbackReturn',
    confidence: 0.7,
    explanation:
      `Builds a reviewed talkback ${actionName.toLowerCase()} scaffold using ${slotMapInput.title} slot ${requestedSlotNumber} and ${micInput.title}.`,
    code,
    requiredInputs: [slotMapInput, micInput].map(analyzeInput),
    requiredFields: [],
    assumptions: [
      'The selected multiview/layout input is treated as the source of truth for the caller in the requested slot.',
      'VideoCallAudioSource return-source values are Bus-prefixed, while AudioBusOn/Off bus values are single bus letters.',
      'Talkback bus roles are preset-specific and intentionally left as reviewed placeholders.',
    ],
    setupSteps: [
      `Confirm ${slotMapInput.title} is the correct slot map input and slot ${requestedSlotNumber} is the intended caller position.`,
      `Confirm ${micInput.title} is the operator/producer mic that should be routed for talkback.`,
      'Replace callerTalkbackReturn, callerNormalReturn, and operatorMicBus placeholder values with the reviewed preset conventions.',
    ],
    testSteps: [
      'Run validation after filling in talkback return and bus settings.',
      'Test with one rehearsal caller and confirm only that caller hears talkback.',
      'Run the companion Talkback Off/reset path and confirm the caller return audio and operator mic bus return to normal.',
    ],
    failureModes: [
      'If the layout slot changes between Talkback On and Off scripts, the companion script can act on a different caller.',
      'If the operator mic bus is shared, turning talkback off can affect another active talkback path.',
      'If return-source values use AudioBusOn/Off syntax instead of VideoCallAudioSource syntax, the caller may hear the wrong source.',
    ],
    warnings: [
      'Talkback return source and bus placeholders must be replaced before this script is copy-ready.',
      'Slot-driven talkback is preset-specific; verify the slot map, caller return sources, and operator mic bus against the current show.',
    ],
  };
}

function buildLayoutCleanupArtifact(state: VmixState, goal: string): ScriptArtifact | null {
  const layoutInput = findSlotMapInput(state, goal);
  const clearInput = findClearInput(state, goal);

  if (!layoutInput || !clearInput) return null;

  const layerNumbers = parseExpectedLayerNumbers(goal);
  const layoutSelector = escapeVbString(inputXPathSelector(layoutInput));
  const layerList = layerNumbers.join(', ');
  const code = `' Sparse layout layer cleanup scaffold
' REVIEW ARTIFACT - confirm layer numbers and clear input before using.
' Layout input: #${layoutInput.number} ${escapeVbString(layoutInput.title)}
' Clear input: #${clearInput.number} ${escapeVbString(clearInput.title)}
Dim layoutInput As String = ${quotedInputReference(layoutInput)}
Dim clearInput As String = ${quotedInputReference(clearInput)}
Dim layoutSelector As String = "${layoutSelector}"
Dim expectedLayers() As Integer = {${layerList}}

Dim xml As String = API.XML()
If xml <> "" Then
    Dim doc As New System.Xml.XmlDocument
    doc.LoadXml(xml)

    Dim layoutNode As System.Xml.XmlNode = doc.SelectSingleNode(layoutSelector)
    If layoutNode IsNot Nothing Then
        Dim overlayNodes As System.Xml.XmlNodeList = layoutNode.SelectNodes("overlay")

        For Each layerNumber As Integer In expectedLayers
            Dim layerIndex As Integer = layerNumber - 1
            Dim layerHasSource As Boolean = False

            If overlayNodes IsNot Nothing AndAlso overlayNodes.Count > layerIndex Then
                Dim layerNode As System.Xml.XmlNode = overlayNodes.Item(layerIndex)
                If layerNode IsNot Nothing AndAlso layerNode.Attributes("key") IsNot Nothing Then
                    layerHasSource = layerNode.Attributes("key").Value <> ""
                End If
            End If

            If Not layerHasSource Then
                API.Function("SetLayer", Input:=layoutInput, Value:=CStr(layerNumber) & "," & clearInput)
            End If
        Next
    End If
End If`;

  return {
    pattern: 'layoutCleanup',
    confidence: 0.72,
    explanation:
      `Builds a reviewed sparse-layer cleanup scaffold for ${layoutInput.title} using ${clearInput.title} on layer(s) ${layerList}.`,
    code,
    requiredInputs: [layoutInput, clearInput].map(analyzeInput),
    requiredFields: [],
    assumptions: [
      'The selected layout/multiview input is the target whose sparse layers should be checked.',
      'Layer numbers are one-based vMix layer numbers; XML overlay nodes are checked by zero-based index.',
      'The clear input is already a safe transparent/blank source in the user preset.',
    ],
    setupSteps: [
      `Confirm ${layoutInput.title} is the layout input that should be repaired.`,
      `Confirm ${clearInput.title} is safe to place into empty layers without affecting Program graphics.`,
      `Review expected layer numbers before use: ${layerList}.`,
    ],
    testSteps: [
      'Run validation after reviewing layer numbers and clear input.',
      'Test on a duplicate layout input or rehearsal preset first.',
      'Inspect the layout after running and confirm only missing layers were filled.',
    ],
    failureModes: [
      'If layer numbering differs from the intended layout design, the script can fill the wrong position.',
      'If the clear input is not truly transparent/blank, the layout can show visible filler.',
      'If the layout is live on Program or an output, SetLayer changes can be visible immediately.',
    ],
    warnings: [
      'Layer cleanup is preset-specific; verify the layout input, clear input, and layer numbers before copy-ready use.',
    ],
  };
}

function buildVideoEndArtifact(state: VmixState, goal: string): ScriptArtifact | null {
  const videoInput = findMediaInput(state);
  const targetInput = findTargetInput(state, goal);

  if (!videoInput || !targetInput) return null;

  const action = goal.toLowerCase().includes('fade') ? 'Fade' : 'Cut';
  // VB-escape because the selector is embedded inside a VB double-quoted string below.
  const videoSelector = escapeVbString(inputXPathSelector(videoInput));
  const code = `' Switch when media is near the end
Do While True
    Dim xml As String = API.XML()
    Dim x As New System.Xml.XmlDocument
    x.LoadXml(xml)

    Dim node As System.Xml.XmlNode = x.SelectSingleNode("${videoSelector}")
    If node IsNot Nothing Then
        Dim position As Integer = CInt(node.Attributes("position").Value)
        Dim duration As Integer = CInt(node.Attributes("duration").Value)

        If duration > 0 And (duration - position) <= 500 Then
            API.Function("${action}", Input:=${quotedInputReference(targetInput)})
            Exit Do
        End If
    End If

    Sleep(100)
Loop`;

  return {
    pattern: 'videoEndTrigger',
    confidence: 0.82,
    explanation: `Monitors ${videoInput.title} and ${action.toLowerCase()}s to ${targetInput.title} near the end.`,
    code,
    requiredInputs: [videoInput, targetInput].map(analyzeInput),
    requiredFields: [],
    assumptions: [
      'The media input is identified from current duration/type/title metadata.',
      'The script exits after firing once to avoid repeated switching.',
    ],
    setupSteps: [
      `Confirm ${videoInput.title} is the media item to monitor.`,
      `Confirm ${targetInput.title} is the intended destination input.`,
    ],
    testSteps: [
      'Cue the media near its end in rehearsal and run the script.',
      'Confirm the transition fires once and the script exits.',
    ],
    failureModes: [
      videoInput.key.length > 0
        ? 'If the media input is replaced and gets a new key, update the XPath key before use.'
        : 'This media input has no visible key, so the XPath falls back to input number and should be rechecked if the preset order changes.',
      'If the media has no duration in XML, the trigger will never fire.',
    ],
    warnings: [],
  };
}

function buildProgramTitleWatcherArtifact(state: VmixState, goal: string): ScriptArtifact | null {
  const drivenInputs = findExplicitTitleInputs(state, goal);
  const drivenInput = drivenInputs[0] ?? null;
  if (!drivenInput) return null;

  const pairs = findProgramWatcherPairs(state, goal, drivenInputs);
  if (pairs.length > 1) {
    return buildMultiProgramTitleWatcherArtifact(state, goal, pairs);
  }

  const pair = pairs[0] ?? null;
  if (!pair) return null;

  const { watchedInput, selectedField } = pair;

  const { onText, offText } = extractProgramWatcherValues(goal);
  const dynamicProgramLabel = usesDynamicProgramSourceLabel(goal);
  const sleepMs = parseDelayMs(goal) ?? 200;
  const watchedSelector = escapeVbString(inputXPathSelector(watchedInput));
  const programLabelSetup = dynamicProgramLabel
    ? `
            Dim programLabel As String = activeNode.InnerText
            Dim activeInputNode As System.Xml.XmlNode = doc.SelectSingleNode("//input[@number='" & activeNode.InnerText & "']")
            If activeInputNode IsNot Nothing AndAlso activeInputNode.Attributes("title") IsNot Nothing Then
                programLabel = activeInputNode.Attributes("title").Value
            End If
`
    : '';
  const onAssignment = dynamicProgramLabel
    ? 'desiredText = programLabel'
    : `desiredText = "${escapeVbString(onText)}"`;
  const code = `' Program watcher -> title text driver
' Watched: #${watchedInput.number} ${watchedInput.title}
' watchedKey=${stableInputReference(watchedInput)}
' Driven: #${drivenInput.number} ${drivenInput.title}
' drivenKey=${stableInputReference(drivenInput)}
' Field: ${selectedField}
Dim lastApplied As String = ""

Do While True
    Try
        Dim xml As String = API.XML()

        If xml <> "" Then
            Dim doc As New System.Xml.XmlDocument
            doc.LoadXml(xml)

            Dim activeNode As System.Xml.XmlNode = doc.SelectSingleNode("/vmix/active")
            Dim watchedNode As System.Xml.XmlNode = doc.SelectSingleNode("${watchedSelector}")

            If activeNode IsNot Nothing AndAlso watchedNode IsNot Nothing AndAlso watchedNode.Attributes("number") IsNot Nothing Then
                Dim watchedNumber As String = watchedNode.Attributes("number").Value
                Dim desiredText As String = "${escapeVbString(offText)}"
${programLabelSetup}

                If activeNode.InnerText = watchedNumber Then
                    ${onAssignment}
                End If

                If desiredText <> lastApplied Then
                    API.Function("SetText", Input:=${quotedInputReference(drivenInput)}, SelectedName:="${escapeVbString(selectedField)}", Value:=desiredText)
                    lastApplied = desiredText
                End If
            End If
        End If
    Catch ex As Exception
        ' Keep watcher running through transient XML read or parse errors.
    End Try

    Sleep(${sleepMs})
Loop`;

  return {
    pattern: 'programTitleWatcher',
    confidence: 0.84,
    explanation:
      `Watches Program for ${watchedInput.title} and drives ${selectedField} on ${drivenInput.title}.`,
    code,
    requiredInputs: [watchedInput, drivenInput].map(analyzeInput),
    requiredFields: [
      {
        input: analyzeInput(drivenInput),
        fields: [selectedField],
      },
    ],
    assumptions: [
      'Program state is read from /vmix/active and compared to the watched input current number.',
      'Only the selected title field is written; Program, Preview, overlays, outputs, and audio routing are not changed.',
      'The watcher loops until manually stopped in vMix Scripting.',
    ],
    setupSteps: [
      `Confirm ${watchedInput.title} is the input whose Program state should drive the label.`,
      `Confirm ${drivenInput.title} field ${selectedField} should display ${dynamicProgramLabel ? 'the active Program input title' : onText}/${offText}.`,
      'Start this as a persistent script only during rehearsal or when the operator is ready to stop it manually.',
    ],
    testSteps: [
      `Take ${watchedInput.title} to Program and confirm ${drivenInput.title} shows ${dynamicProgramLabel ? 'the active Program input title' : onText}.`,
      `Take any other input to Program and confirm ${drivenInput.title} shows ${offText}.`,
      'Stop the script manually after rehearsal because it is a persistent watcher.',
    ],
    failureModes: [
      'If the title template field is renamed, SetText will not update the intended field.',
      'If the watched input is deleted and recreated, re-resolve the key before using the script.',
      'This watches the main Program active input only; overlays and layer appearances are not counted as Program.',
    ],
    warnings: [],
  };
}

function buildMultiProgramTitleWatcherArtifact(
  state: VmixState,
  goal: string,
  pairs: ProgramTitleWatcherPair[]
): ScriptArtifact {
  const { onText, offText } = extractProgramWatcherValues(goal);
  const dynamicProgramLabel = usesDynamicProgramSourceLabel(goal);
  const sleepMs = parseDelayMs(goal) ?? 200;
  const pairComments = pairs
    .map(
      (pair, index) =>
        `' Pair ${index + 1}
'   Watch #${pair.watchedInput.number}: ${pair.watchedInput.title}
'   watchKey=${stableInputReference(pair.watchedInput)}
'   Drive #${pair.drivenInput.number}: ${pair.drivenInput.title}
'   driveKey=${stableInputReference(pair.drivenInput)}
'   field=${pair.selectedField}`
    )
    .join('\n');
  const lastAppliedDeclarations = pairs
    .map((_pair, index) => `Dim lastApplied${index + 1} As String = ""`)
    .join('\n');
  const pairBlocks = pairs
    .map((pair, index) => {
      const number = index + 1;
      const watchedSelector = escapeVbString(inputXPathSelector(pair.watchedInput));
      const desiredAssignment = dynamicProgramLabel
        ? `desiredText${number} = programLabel`
        : `desiredText${number} = "${escapeVbString(onText)}"`;

      return `            Dim watchedSelector${number} As String = "${watchedSelector}"
            Dim watchedNode${number} As System.Xml.XmlNode = doc.SelectSingleNode(watchedSelector${number})
            Dim watchedReady${number} As Boolean = watchedNode${number} IsNot Nothing
            watchedReady${number} = watchedReady${number} AndAlso watchedNode${number}.Attributes("number") IsNot Nothing

            If activeNumber <> "" AndAlso watchedReady${number} Then
                Dim desiredText${number} As String = "${escapeVbString(offText)}"
                If activeNumber = watchedNode${number}.Attributes("number").Value Then
                    ${desiredAssignment}
                End If

                If desiredText${number} <> lastApplied${number} Then
                    API.Function("SetText", _
                        Input:=${quotedInputReference(pair.drivenInput)}, _
                        SelectedName:="${escapeVbString(pair.selectedField)}", _
                        Value:=desiredText${number})
                    lastApplied${number} = desiredText${number}
                End If
            End If`;
    })
    .join('\n\n');
  const code = `' Program watcher -> multi-title text driver
' Watches ${pairs.length} Program source(s) and drives matching title labels.
' When a watched input is live, label text is ${dynamicProgramLabel ? 'the active Program input title' : `"${escapeVbString(onText)}"`}; otherwise "${escapeVbString(offText)}".
${pairComments}
${lastAppliedDeclarations}

Do While True
    Try
        Dim xml As String = API.XML()

        If xml <> "" Then
            Dim doc As New System.Xml.XmlDocument
            doc.LoadXml(xml)

            Dim activeNumber As String = ""
            Dim programLabel As String = ""
            Dim activeNode As System.Xml.XmlNode = doc.SelectSingleNode("/vmix/active")

            If activeNode IsNot Nothing Then
                activeNumber = activeNode.InnerText
                programLabel = activeNumber
                Dim activeInputXPath As String = "//input[@number='" & activeNumber & "']"
                Dim activeInputNode As System.Xml.XmlNode = doc.SelectSingleNode(activeInputXPath)
                Dim activeHasTitle As Boolean = activeInputNode IsNot Nothing
                activeHasTitle = activeHasTitle AndAlso activeInputNode.Attributes("title") IsNot Nothing
                If activeHasTitle Then
                    programLabel = activeInputNode.Attributes("title").Value
                End If
            End If

${pairBlocks}
        End If
    Catch ex As Exception
        ' Keep watcher running through transient XML read or parse errors.
    End Try

    Sleep(${sleepMs})
Loop`;
  const requiredInputs = uniqueInputs(
    pairs.flatMap((pair) => [pair.watchedInput, pair.drivenInput]),
    state
  ).map(analyzeInput);

  return {
    pattern: 'programTitleWatcher',
    confidence: 0.88,
    explanation:
      `Watches Program for ${pairs.length} source/label pair(s) and drives matching title fields.`,
    code,
    requiredInputs,
    requiredFields: pairs.map((pair) => ({
      input: analyzeInput(pair.drivenInput),
      fields: [pair.selectedField],
    })),
    assumptions: [
      'Program state is read from /vmix/active and compared to each watched input current number.',
      dynamicProgramLabel
        ? 'When a watched input is in Program, the label text is read from the active input title in the current XML.'
        : `When a watched input is in Program, the label text is ${onText}.`,
      'Only the selected title fields are written; Program, Preview, overlays, outputs, and audio routing are not changed.',
      'The watcher loops until manually stopped in vMix Scripting.',
    ],
    setupSteps: [
      `Confirm the ${pairs.length} watched inputs and ${pairs.length} driven title inputs are paired correctly.`,
      `Confirm each driven title exposes the requested field before running: ${[...new Set(pairs.map((pair) => pair.selectedField))].join(', ')}.`,
      'Start this as a persistent script only during rehearsal or when the operator is ready to stop it manually.',
    ],
    testSteps: [
      `Take each watched input to Program one at a time and confirm only its matching label shows ${dynamicProgramLabel ? 'the active Program input title' : onText}.`,
      `Take an unrelated input to Program and confirm all driven labels show ${offText}.`,
      'Stop the script manually after rehearsal because it is a persistent watcher.',
    ],
    failureModes: [
      'If a title template field is renamed, SetText will not update that field.',
      'If a watched or driven input is deleted and recreated, re-resolve the key before using the script.',
      'This watches the main Program active input only; overlays and layer appearances are not counted as Program.',
    ],
    warnings: [],
  };
}

function buildTitleUpdateArtifact(state: VmixState, goal: string): ScriptArtifact | null {
  const explicitInputs = findExplicitTitleInputs(state, goal);
  const fallbackInput = explicitInputs.length === 0 ? findTitleInput(state) : null;
  const inputs = explicitInputs.length > 0 ? explicitInputs : fallbackInput ? [fallbackInput] : [];
  const fields = commonTitleFields(inputs);

  if (inputs.length === 0 || fields.length === 0) return null;

  const fieldValues = extractFieldValues(goal, fields);
  const selectedFields = Object.keys(fieldValues).length > 0 ? Object.keys(fieldValues) : fields.slice(0, 3);
  const batchFieldValues = new Map(
    selectedFields.map((field) => [field, extractBatchFieldValues(goal, field, inputs.length)])
  );
  let usedPlaceholder = false;
  const delayMs = parseDelayMs(goal);
  const lines: string[] = [];

  for (const [inputIndex, input] of inputs.entries()) {
    lines.push(`' Update title text on #${input.number} ${input.title}`);
    lines.push(`' key=${stableInputReference(input)}`);

    for (const field of selectedFields) {
      const batchValues = batchFieldValues.get(field) ?? [];
      const value = batchValues[inputIndex] ?? fieldValues[field] ?? `New ${field} value`;
      usedPlaceholder = usedPlaceholder || !batchValues[inputIndex] && !fieldValues[field];
      lines.push(
        `API.Function("SetText", Input:=${quotedInputReference(input)}, SelectedName:="${escapeVbString(field)}", Value:="${escapeVbString(value)}")`
      );
    }

    if (delayMs !== null && (inputs.length === 1 || inputIndex < inputs.length - 1)) {
      lines.push(`Sleep(${delayMs})`);
    }
  }

  const hasExactFieldValues = !usedPlaceholder;
  const inputDescription =
    inputs.length === 1
      ? inputs[0]?.title ?? 'selected title input'
      : `${inputs.length} title input(s)`;

  return {
    pattern: 'titleTextUpdate',
    confidence: explicitInputs.length > 0 && hasExactFieldValues ? 0.9 : hasExactFieldValues ? 0.82 : 0.68,
    explanation: `Updates text field(s) on ${inputDescription}.`,
    code: lines.join('\n'),
    requiredInputs: inputs.map(analyzeInput),
    requiredFields: inputs.map((input) => ({
      input: analyzeInput(input),
      fields: selectedFields,
    })),
    assumptions: [
      'Only visible title fields from the current XML are used.',
      ...(!hasExactFieldValues
        ? ['Placeholder values should be replaced before using the script when the goal did not provide exact values.']
        : []),
    ],
    setupSteps: [
      inputs.length === 1
        ? `Review available fields on ${inputs[0]?.title ?? 'the selected title input'}: ${fields.join(', ')}.`
        : `Review available fields on each matched title input: ${fields.join(', ')}.`,
      ...(!hasExactFieldValues ? ['Replace placeholder values before importing the script into vMix.'] : []),
    ],
    testSteps: [
      'Run against a duplicate title input or rehearsal preset first.',
      'Confirm each field changes exactly as expected.',
    ],
    failureModes: [
      'If the title template changes, field names can change and SetText calls may stop working.',
      'Image fields are not handled by this text-update pattern.',
    ],
    warnings: !hasExactFieldValues ? ['No exact field values were detected, so placeholders were generated.'] : [],
  };
}

function buildAudioDuckingArtifact(state: VmixState): ScriptArtifact | null {
  const inputs = findAudioDuckingInputs(state);
  if (!inputs) return null;

  // VB-escape because the selector is embedded inside a VB double-quoted string below.
  const triggerSelector = escapeVbString(inputXPathSelector(inputs.trigger));
  const code = `' Duck background audio while the trigger source has signal
Dim isDucked As Boolean = False

Do While True
    Dim xml As String = API.XML()
    Dim x As New System.Xml.XmlDocument
    x.LoadXml(xml)

    Dim node As System.Xml.XmlNode = x.SelectSingleNode("${triggerSelector}")
    If node IsNot Nothing Then
        Dim level As Double = 0
        If node.Attributes("meterF1") IsNot Nothing Then level = CDbl(node.Attributes("meterF1").Value)

        If level > 0.01 And Not isDucked Then
            API.Function("SetVolume", Input:=${quotedInputReference(inputs.duck)}, Value:="30")
            isDucked = True
        ElseIf level <= 0.01 And isDucked Then
            API.Function("SetVolume", Input:=${quotedInputReference(inputs.duck)}, Value:="100")
            isDucked = False
        End If
    End If

    Sleep(100)
Loop`;

  return {
    pattern: 'audioDucking',
    confidence: 0.7,
    explanation: `Ducks ${inputs.duck.title} while ${inputs.trigger.title} appears to have audio signal.`,
    code,
    requiredInputs: [inputs.trigger, inputs.duck].map(analyzeInput),
    requiredFields: [],
    assumptions: [
      'The trigger and background audio inputs are inferred from names and roles.',
      'This script depends on audio meter attributes being available in vMix XML at runtime.',
    ],
    setupSteps: [
      `Confirm ${inputs.trigger.title} is the source that should trigger ducking.`,
      `Confirm ${inputs.duck.title} is the source that should be lowered.`,
      'Adjust the 30 and 100 volume values before use if your mix uses different levels.',
    ],
    testSteps: [
      'Run in rehearsal while sending audio into the trigger source.',
      'Confirm the background source ducks and restores without pumping.',
    ],
    failureModes: [
      'If meter attributes are unavailable, the script will not detect signal.',
      'The script loops until stopped.',
    ],
    warnings: [
      'Audio ducking depends on runtime meter attributes that are not part of the current normalized parser.',
    ],
  };
}

function describeMapping(mapping: PairedAudioMapping): string {
  return `${mapping.video.number} ${mapping.video.title} -> ${mapping.music.number} ${mapping.music.title} on Bus ${mapping.bus}`;
}

function apiCall(functionName: string, input: VmixInput): string {
  return `API.Function("${functionName}", Input:=${quotedInputReference(input)})`;
}

function buildPauseOtherMusicLines(mappings: PairedAudioMapping[], activeMapping: PairedAudioMapping): string[] {
  return mappings
    .filter((mapping) => mapping.music.number !== activeMapping.music.number)
    .map((mapping) => `            ${apiCall('Pause', mapping.music)}`);
}

function buildPairedAudioBranch(
  mapping: PairedAudioMapping,
  mappings: PairedAudioMapping[],
  branchIndex: number,
  options: PairedAudioGenerationOptions
): string {
  const keyword = branchIndex === 0 ? 'If' : 'ElseIf';
  const pauseLines = buildPauseOtherMusicLines(mappings, mapping);
  const playbackLines =
    options.playbackBehavior === 'restart'
      ? [
          `            ${apiCall('Restart', mapping.music)}`,
          `            ${apiCall('Play', mapping.music)}`,
        ]
      : [`            ${apiCall('Play', mapping.music)}`];

  return [
    `        ${keyword} programKey = ${quotedInputReference(mapping.video)} Then`,
    ...pauseLines,
    ...playbackLines,
  ].join('\n');
}

function buildUnmappedPauseAllBranch(mappings: PairedAudioMapping[]): string {
  const pauseLines = mappings.map((mapping) => `            ${apiCall('Pause', mapping.music)}`);

  return [
    '        Else',
    "            ' Unmapped Program input - pause every paired music track, play none.",
    ...pauseLines,
  ].join('\n');
}

function buildPairedAudioNeedsExplicitPairsArtifact(): ScriptArtifact {
  const code = `' Paired audio follow setup - explicit mapping required.
' REVIEW ARTIFACT - no vMix functions are called by this placeholder.
'
' No safe video/music pairs were inferred from the current state.
' Provide explicit stable input keys before generating playback automation:
'   videoKeys = real video inputs that should trigger a music bed
'   musicKeys = real music/audio-bed inputs routed to the intended output
'
' Safety rule: never use vMix Call inputs, caller returns, Return Feed, IFB,
' talkback, or mix-minus buses as music-bed targets.

Dim videoKeys() As String = New String() {"PUT-VIDEO-KEY-HERE"}
Dim musicKeys() As String = New String() {"PUT-MUSIC-BED-KEY-HERE"}

' After replacing the placeholders with reviewed stable keys, regenerate or
' validate the finished watcher before any Control Mode execution.`;

  return {
    pattern: 'pairedAudioFollow',
    confidence: 0.42,
    explanation:
      'No safe video/music pair was inferred. Provide explicit stable video and music-bed input keys before generating paired Program-follow automation.',
    code,
    requiredInputs: [],
    requiredFields: [],
    assumptions: [
      'The current state does not expose a safe, explicit silent-video plus separate music-bed relationship.',
      'Caller returns, vMix Call inputs, Return Feed, IFB, talkback, and mix-minus paths are excluded from paired-music inference.',
    ],
    setupSteps: [
      'Identify the real video inputs that should trigger music.',
      'Identify the real music/audio-bed inputs and confirm they are routed to the intended stream or recording bus.',
      'Regenerate the script with those explicit pairs or replace the placeholders and validate again.',
    ],
    testSteps: [
      'Validate the completed script after replacing placeholders.',
      'Rehearse in a duplicate preset and listen on the actual output bus.',
    ],
    failureModes: [
      'Guessing pairs from caller-return routing can play audio into the wrong monitoring or mix-minus path.',
      'A music bed that is aux-only may play without reaching a Master-fed stream or recording.',
    ],
    warnings: [
      'No playback automation was generated because no safe paired video/music relationship was detected.',
      'Explicit video/music pairs are required before this can become an executable watcher.',
    ],
  };
}

function buildPairedAudioFollowArtifact(state: VmixState, goal: string): ScriptArtifact | null {
  const mappings = findPairedAudioMappings(state);
  if (mappings.length === 0) return buildPairedAudioNeedsExplicitPairsArtifact();

  const options = parsePairedAudioGenerationOptions(goal);
  const pairNotes = mappings.map((mapping) => `' - ${describeMapping(mapping)}`).join('\n');
  const anyMusicOnMaster = mappings.some(mappingUsesMaster);
  const branches = mappings
    .map((mapping, index) => buildPairedAudioBranch(mapping, mappings, index, options))
    .join('\n');
  const unmappedBranch =
    options.unmappedBehavior === 'pauseAll' ? `\n${buildUnmappedPauseAllBranch(mappings)}` : '';
  const playbackLine =
    options.playbackBehavior === 'restart'
      ? "' Playback behavior: restart matching music from 0:00, then play."
      : "' Playback behavior: resume matching music from its current position with Play only.";
  const unmappedLine =
    options.unmappedBehavior === 'pauseAll'
      ? "' Unmapped Program behavior: pause every paired music track."
      : "' Unmapped Program behavior: leave the previous music state unchanged.";
  const code = `' Auto-play the paired music track when a mapped video hits Program.
' REVIEW ARTIFACT - run in rehearsal or a duplicate preset first.
${playbackLine}
${unmappedLine}
' Detected pairs:
${pairNotes}

Dim lastProgramKey As String = ""

Do While True
    Dim xml As String = API.XML()
    Dim x As New System.Xml.XmlDocument
    x.LoadXml(xml)

    Dim activeNode As System.Xml.XmlNode = x.SelectSingleNode("/vmix/active")
    If activeNode IsNot Nothing Then
        Dim activeNumber As String = activeNode.InnerText
        Dim programNode As System.Xml.XmlNode = x.SelectSingleNode("//input[@number='" & activeNumber & "']")
        Dim programKey As String = ""

        If programNode IsNot Nothing AndAlso programNode.Attributes("key") IsNot Nothing Then
            programKey = programNode.Attributes("key").Value
        Else
            programKey = activeNumber
        End If

        If programKey <> "" And programKey <> lastProgramKey Then
${branches}${unmappedBranch}
        End If

            lastProgramKey = programKey
        End If
    End If

    Sleep(200)
Loop`;

  const requiredInputs = mappings.flatMap((mapping) => [mapping.video, mapping.music]);
  const warnings: string[] = [];

  if (!anyMusicOnMaster) {
    warnings.push(
      'Detected paired music tracks are not routed to Master. Playing them may not make them audible on a Master-fed stream or recording.'
    );
  }

  return {
    pattern: 'pairedAudioFollow',
    confidence: mappings.length >= 2 ? 0.84 : 0.74,
    explanation:
      `Monitors Program and ${options.playbackBehavior === 'restart' ? 'restarts' : 'resumes'} ` +
      `the same-bus paired music track for ${mappings.length} detected video/music pair(s); ` +
      `unmapped Program inputs ${options.unmappedBehavior === 'pauseAll' ? 'pause all paired music' : 'leave music unchanged'}.`,
    code,
    requiredInputs: requiredInputs.map(analyzeInput),
    requiredFields: [],
    assumptions: [
      'Each video is paired with the same-bus music input inferred from current routing.',
      'Program changes are detected from /vmix/active and resolved back to stable input keys.',
      'Pause is used to park non-matching music tracks so only one paired bed plays at a time.',
      options.playbackBehavior === 'restart'
        ? 'Restart intentionally starts each matching music track from 0:00 on every Program take.'
        : 'Resume behavior uses Play only, so each matching music track continues from its current position.',
      options.unmappedBehavior === 'pauseAll'
        ? 'When Program changes to an unmapped input, every paired music track is paused.'
        : 'When Program changes to an unmapped input, this script leaves the previous music state unchanged.',
    ],
    setupSteps: [
      'Review the detected pair list and update arrays if any video/music relationship is wrong.',
      'Confirm whether the music tracks route to the output bus used by your stream or recording.',
      options.playbackBehavior === 'restart'
        ? 'Confirm Restart-from-top is desired; ask for resume behavior if you want Play-only continuation.'
        : 'Confirm resume-from-current-position is desired; ask for restart behavior if each take should begin at 0:00.',
    ],
    testSteps: [
      'Run in a duplicate preset or rehearsal session.',
      'Switch each mapped video to Program and confirm the matching music starts while other tracks pause.',
      options.unmappedBehavior === 'pauseAll'
        ? 'Take an unmapped input to Program and confirm all paired music pauses once.'
        : 'Take an unmapped input to Program and confirm the previous music behavior is acceptable.',
      'Listen on the actual stream/record bus, not only local monitor meters.',
    ],
    failureModes: [
      'If a clip is deleted and re-imported, its key can change and the arrays must be updated.',
      options.unmappedBehavior === 'pauseAll'
        ? 'If Program goes to an unmapped input, this script pauses all paired music tracks.'
        : 'If Program goes to an unmapped input, this script leaves the last music state unchanged.',
      'If music is aux-only and your output uses Master, the script can play music that the audience cannot hear.',
      'Manual operator changes to the music tracks can be overwritten on the next mapped Program take.',
    ],
    warnings,
  };
}

function buildRecordingArtifact(goal: string): ScriptArtifact {
  const lowerGoal = goal.toLowerCase();
  const target = lowerGoal.includes('stream') && !lowerGoal.includes('record') ? 'Streaming' : 'Recording';
  const action = lowerGoal.includes('stop') ? 'Stop' : lowerGoal.includes('start') ? 'Start' : 'StartStop';
  const functionName = `${action}${target}`;
  const code = `' ${action} ${target.toLowerCase()}
API.Function("${functionName}")`;

  return {
    pattern: 'recordingControl',
    confidence: 0.78,
    explanation: `Generates a script that calls ${functionName}.`,
    code,
    requiredInputs: [],
    requiredFields: [],
    assumptions: [
      'The script is a reviewable artifact only; this MCP does not start or stop recording/streaming in Review Mode.',
      'Confirm production timing before running any recording or streaming control script.',
    ],
    setupSteps: [
      'Review whether this should affect recording or streaming.',
      'Confirm you are in the intended preset and output configuration before running.',
    ],
    testSteps: [
      'Test in a non-live session first.',
      'Watch vMix recording/streaming state after manual execution.',
    ],
    failureModes: [
      'Running this at the wrong time can start or stop a production-critical output.',
      'The script does not check current state before calling the function.',
    ],
    warnings: ['Recording and streaming controls are show-critical. Review carefully before manual execution.'],
  };
}

function buildCustomArtifact(state: VmixState, goal: string): ScriptArtifact {
  const likelyInputs = state.inputs
    .filter((input) => isLikelyAudioSource(analyzeInput(input).role) || Object.keys(input.fields ?? {}).length > 0)
    .slice(0, 8);
  const inputNotes = likelyInputs.map((input) => `' - ${describeInput(input)} key=${stableInputReference(input)}`).join('\n');
  const code = `' Custom vMix script starting point
' Goal: ${escapeVbString(goal)}
'
' Current useful inputs:
${inputNotes.length > 0 ? inputNotes : "' - No inputs are visible in the current XML."}
'
' Example API calls:
' API.Function("Cut", Input:="{input-key}")
' API.Function("SetText", Input:="{title-key}", SelectedName:="Name.Text", Value:="New Value")
' Sleep(1000)

Dim xml As String = API.XML()
Dim x As New System.Xml.XmlDocument
x.LoadXml(xml)

' Add reviewed automation logic here.
' Use Sleep() inside any loop to avoid freezing vMix.`;

  return {
    pattern: 'customTemplate',
    confidence: 0.4,
    explanation: 'Could not confidently match a supported pattern, so a safe starting template was generated.',
    code,
    requiredInputs: likelyInputs.map(analyzeInput),
    requiredFields: [],
    assumptions: [
      'The request needs additional human review before a production-ready script can be produced.',
      'The generated template intentionally avoids guessing show-specific logic.',
    ],
    setupSteps: [
      'Clarify the exact inputs, trigger condition, and desired vMix function.',
      'Replace placeholder API calls with reviewed logic.',
    ],
    testSteps: [
      'Run validation again after editing.',
      'Test in rehearsal before using in a live preset.',
    ],
    failureModes: [
      'The template is not a finished automation.',
      'Incorrect input keys or field names will cause runtime no-ops or errors.',
    ],
    warnings: ['The generated script is a template because the goal did not match a supported pattern.'],
  };
}

function estimateLiveImpact(artifact: ScriptArtifact): LiveImpact {
  if (artifact.pattern === 'customTemplate') return 'none';
  if (artifact.pattern === 'recordingControl') return 'high';
  if (artifact.pattern === 'cameraCycle' || artifact.pattern === 'videoEndTrigger') return 'high';
  if (artifact.pattern === 'pairedAudioFollow') return 'high';
  if (artifact.pattern === 'talkbackReturn') return 'high';
  if (artifact.pattern === 'layoutCleanup') return 'high';
  if (artifact.pattern === 'timedOverlay' || artifact.pattern === 'audioDucking' || artifact.pattern === 'slotLowerThird') return 'medium';
  if (artifact.pattern === 'programTitleWatcher') return 'medium';
  if (artifact.pattern === 'titleTextUpdate') return 'low';
  return 'medium';
}

function hasPersistentLoop(code: string): boolean {
  return /\bDo\s+While\s+True\b/i.test(code) && !/\bExit\s+Do\b/i.test(code);
}

function buildProductionScriptReview(
  artifact: ScriptArtifact,
  stateAwareValidation: StateAwareScriptValidation
): ProductionScriptReview {
  const liveImpactIfRun = estimateLiveImpact(artifact);
  const isPersistentLoop = hasPersistentLoop(artifact.code);
  const highImpactEvidence = stateAwareValidation.issues
    .filter((issue) => issue.category === 'risk')
    .map((issue) => issue.message);
  const hasHighImpactActions = highImpactEvidence.length > 0 || liveImpactIfRun === 'high';
  const warnings: string[] = [];
  const setupSteps: string[] = [];
  const testSteps: string[] = [];
  const failureModes: string[] = [];

  if (isPersistentLoop) {
    warnings.push(
      'Persistent watcher or loop: rehearse start/stop behavior and avoid running duplicate copies of the same script.'
    );
    setupSteps.push('Confirm no other copy of this watcher is already running before starting it.');
    testSteps.push('Start and stop the watcher once in rehearsal, then confirm vMix state returns to the expected baseline.');
    failureModes.push('Multiple running copies of the same watcher can fight each other or repeat actions unexpectedly.');
  }

  if (highImpactEvidence.length > 0) {
    warnings.push(`Show-critical function review required: ${highImpactEvidence.join(' | ')}`);
    setupSteps.push('Confirm the exact production phase and operator intent before using show-critical functions.');
    testSteps.push('Rehearse the high-impact action in an offline or duplicate preset before considering live use.');
    failureModes.push('A show-critical function fired at the wrong time can affect recording, streaming, outputs, overlays, audio, or script control.');
  } else if (liveImpactIfRun === 'high') {
    warnings.push('High live-impact automation: this script can change Program, playback, or audio state if run.');
    setupSteps.push('Confirm Program, Preview, audio, overlays, and outputs match the rehearsal plan before using this script.');
    testSteps.push('Run a full rehearsal pass and re-read state before using this automation in a live show.');
    failureModes.push('Running live-impact automation against the wrong state can change the show in a way the current XML cannot fully predict.');
  }

  return {
    isPersistentLoop,
    hasHighImpactActions,
    liveImpactIfRun,
    highImpactEvidence,
    warnings,
    setupSteps,
    testSteps,
    failureModes,
  };
}

function determineReviewStatus(
  artifact: ScriptArtifact,
  validation: ScriptValidationResult,
  stateAwareValidation: StateAwareScriptValidation,
  referenceAudit: ReferenceAudit
): ReviewStatus {
  if (!validation.valid || !stateAwareValidation.valid || referenceAudit.status === 'blocked') return 'blocked';
  if (artifact.pattern === 'customTemplate') return 'needsHumanEdits';
  if (referenceAudit.status === 'reviewRequired') return 'needsHumanEdits';
  if (artifact.warnings.length > 0 || artifact.confidence < 0.75) return 'needsHumanEdits';
  return 'readyForReview';
}

function buildGoalSummary(goal: string, artifact: ScriptArtifact): GoalSummary {
  return {
    originalGoal: goal,
    interpretedIntent: artifact.explanation,
    matchedPattern: artifact.pattern,
    confidence: Number(artifact.confidence.toFixed(2)),
    supportedPattern: artifact.pattern !== 'customTemplate',
    liveImpactIfRun: estimateLiveImpact(artifact),
  };
}

function buildCompilerWorkflow(
  artifact: ScriptArtifact,
  validation: ScriptValidationResult,
  stateAwareValidation: StateAwareScriptValidation,
  referenceAudit: ReferenceAudit,
  automationPreflight: AutomationPreflightHandoff
): CompilerWorkflow {
  const reviewStatus = determineReviewStatus(artifact, validation, stateAwareValidation, referenceAudit);
  const referenceStatus =
    referenceAudit.status === 'blocked'
      ? 'blocked'
      : referenceAudit.status === 'reviewRequired'
        ? 'reviewRequired'
        : 'complete';

  return {
    artifactType: 'vbnet-script',
    readOnlyGeneration: true,
    operatorExecutionRequired: true,
    stages: [
      {
        name: 'interpretGoal',
        status: artifact.confidence >= 0.75 ? 'complete' : 'reviewRequired',
        detail: artifact.explanation,
      },
      {
        name: 'resolveShowState',
        status: referenceStatus,
        detail:
          `${artifact.requiredInputs.length} input(s) and ${artifact.requiredFields.length} field group(s) are required; ` +
          `reference audit status is ${referenceAudit.status}.`,
      },
      {
        name: 'generateScript',
        status: artifact.pattern === 'customTemplate' ? 'reviewRequired' : 'complete',
        detail: artifact.pattern === 'customTemplate'
          ? 'A safe editing template was generated because the goal did not match a supported pattern.'
          : 'A concrete VB.NET script artifact was generated.',
      },
      {
        name: 'validateScript',
        status: validation.valid && stateAwareValidation.valid ? 'complete' : 'blocked',
        detail: validation.valid && stateAwareValidation.valid
          ? `Base and state-aware validation passed with ${stateAwareValidation.issueSummary.warnings} warning(s).`
          : `${stateAwareValidation.issueSummary.errors} state-aware validation error(s) must be fixed before review.`,
      },
      {
        name: 'preflightReview',
        status: automationPreflight.blocksExecution
          ? 'blocked'
          : automationPreflight.shouldReviewBeforeExecution
            ? 'reviewRequired'
            : 'complete',
        detail: automationPreflight.executionRecommendation,
      },
      {
        name: 'humanReview',
        status: reviewStatus === 'blocked' || automationPreflight.blocksExecution ? 'blocked' : 'reviewRequired',
        detail: 'Review Mode never executes scripts; a human/operator must review setup, test steps, and failure modes.',
      },
    ],
  };
}

function summarizeValidation(
  validation: ScriptValidationResult,
  stateAwareValidation: StateAwareScriptValidation
) {
  return {
    valid: stateAwareValidation.valid,
    errorCount: stateAwareValidation.issueSummary.errors,
    warningCount: stateAwareValidation.issueSummary.warnings,
    infoCount: stateAwareValidation.issueSummary.info,
    blocking: !stateAwareValidation.valid,
    validator: 'state-aware-vmix-script-validator',
    baseValidation: {
      valid: validation.valid,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
      errors: validation.errors,
      warnings: validation.warnings,
    },
  };
}

function findReferenceUsages(code: string, input: InputAnalysis): string[] {
  const usages = new Set<string>();
  const stableReference = escapeVbString(input.stableReference);
  const quotedReference = `"${stableReference}"`;

  if (code.includes(`Input:=${quotedReference}`)) usages.add('apiInputParameter');
  if (code.includes(quotedReference)) usages.add('stringLiteral');

  if (input.key.length > 0 && code.includes(`@key='${escapeVbString(input.key)}'`)) {
    usages.add('xpathKeySelector');
  }

  if (input.key.length === 0 && new RegExp(`@number='?${escapeRegExp(String(input.number))}'?`).test(code)) {
    usages.add('xpathNumberSelector');
  }

  const notePattern = new RegExp(`^' - .*\\bkey=${escapeRegExp(input.stableReference)}\\b`, 'm');
  if (notePattern.test(code)) usages.add('referenceNote');

  return [...usages];
}

function buildReferenceAudit(
  artifact: ScriptArtifact,
  stateAwareValidation: StateAwareScriptValidation
): ReferenceAudit {
  const checkedReferences = artifact.requiredInputs.map((input) => {
    const usages = findReferenceUsages(artifact.code, input);

    return {
      title: input.title,
      stableReference: input.stableReference,
      referenceKind: stableReferenceKind(input),
      referencedInScript: usages.some((usage) => usage !== 'referenceNote'),
      usages,
    };
  });
  const missingGeneratedReferences = checkedReferences.filter(
    (reference) => !reference.referencedInScript && artifact.pattern !== 'customTemplate'
  );
  const fallbackReferences = checkedReferences
    .filter((reference) => reference.referenceKind !== 'key')
    .map((reference) => ({
      title: reference.title,
      referenceKind: reference.referenceKind,
      reason: 'No stable input key was visible in current state, so the generator fell back to input number.',
    }));
  const exactTitleFallbacks = stateAwareValidation.issues
    .filter((issue) => issue.category === 'inputReference' && /resolves by title|XPath uses title/i.test(issue.message))
    .map((issue) => issue.message);
  const fuzzyTitleMatches = stateAwareValidation.issues
    .filter((issue) => issue.category === 'xpath' && /partial title/i.test(issue.message))
    .map((issue) => issue.message);
  const unresolvedReferences = stateAwareValidation.issues
    .filter((issue) => issue.category === 'inputReference' && issue.severity === 'error')
    .map((issue) => issue.message);
  const warnings = [
    ...missingGeneratedReferences.map(
      (reference) => `${reference.title} was required but no executable stable reference was found in the generated code.`
    ),
    ...fallbackReferences.map((reference) => `${reference.title} uses ${reference.referenceKind} fallback.`),
    ...exactTitleFallbacks,
    ...fuzzyTitleMatches,
  ];

  let status: ReferenceAuditStatus = 'compliant';
  if (unresolvedReferences.length > 0 || missingGeneratedReferences.length > 0) {
    status = 'blocked';
  } else if (artifact.pattern === 'customTemplate' || exactTitleFallbacks.length > 0 || fuzzyTitleMatches.length > 0) {
    status = 'reviewRequired';
  } else if (fallbackReferences.length > 0) {
    status = 'fallbackUsed';
  }

  return {
    status,
    checkedReferences,
    fallbackReferences,
    exactTitleFallbacks,
    fuzzyTitleMatches,
    unresolvedReferences,
    warnings,
  };
}

function buildReferencePlan(
  artifact: ScriptArtifact,
  state: VmixState,
  goal: string,
  stateAwareValidation: StateAwareScriptValidation
): ReferencePlan {
  const explicitGoalReferences = extractExplicitGoalReferences(goal).map((reference) => {
    const resolved = resolveExactInputReference(state, reference);

    return {
      text: reference,
      matched: Boolean(resolved),
      matchedBy: resolved?.matchedBy ?? null,
      resolvedTitle: resolved?.input.title ?? null,
      suggestions: resolved ? [] : findFuzzyInputSuggestions(state, reference),
    };
  });
  const referenceAudit = buildReferenceAudit(artifact, stateAwareValidation);

  return {
    preferenceOrder: ['key', 'number', 'exactTitle', 'fuzzyTitleSuggestionOnly'],
    policy: {
      generatedInputReferences: 'key-then-number',
      exactTitles: 'allowed-only-when-no-key-or-number-reference-is-available',
      fuzzyTitles: 'suggestions-only-never-committed',
    },
    resolvedInputs: artifact.requiredInputs.map((input) => ({
      number: input.number,
      title: input.title,
      type: input.type,
      stableReference: input.stableReference,
      referenceKind: input.key.length > 0 ? 'key' : 'number',
      productionRole: input.productionRole.primary.role,
    })),
    explicitGoalReferences,
    unresolvedReferences: [
      ...explicitGoalReferences.filter((reference) => !reference.matched).map((reference) => reference.text),
      ...referenceAudit.unresolvedReferences,
    ],
    audit: referenceAudit,
    note:
      'Generated script Input values use keys when available and numbers only as fallback; fuzzy title matches are suggestions only.',
  };
}

function buildGenerationConfidence(
  artifact: ScriptArtifact,
  stateAwareValidation: StateAwareScriptValidation,
  referenceAudit: ReferenceAudit
) {
  const keyBackedInputs = artifact.requiredInputs.filter((input) => input.key.length > 0).length;
  const keyCoverage =
    artifact.requiredInputs.length > 0 ? keyBackedInputs / artifact.requiredInputs.length : 1;
  const referencePolicyScore =
    referenceAudit.status === 'compliant'
      ? 1
      : referenceAudit.status === 'fallbackUsed'
        ? 0.82
        : referenceAudit.status === 'reviewRequired'
          ? 0.58
          : 0.2;

  return buildAnalysisConfidence(
    [
      {
        name: 'patternMatch',
        score: artifact.confidence,
        weight: 2,
        reason: `Generated using ${artifact.pattern}.`,
      },
      {
        name: 'stableReferenceCoverage',
        score: keyCoverage,
        weight: 1,
        reason: `${keyBackedInputs} of ${artifact.requiredInputs.length} required input(s) have stable keys.`,
      },
      {
        name: 'referencePolicyCompliance',
        score: referencePolicyScore,
        weight: 1.2,
        reason: `Reference audit status is ${referenceAudit.status}.`,
      },
      {
        name: 'stateAwareValidation',
        score: stateAwareValidation.valid ? 0.9 : 0.35,
        weight: 1.5,
        reason: stateAwareValidation.valid
          ? `Generated script passed state-aware validation with ${stateAwareValidation.issueSummary.warnings} warning(s).`
          : `${stateAwareValidation.issueSummary.errors} state-aware validation error(s) were produced.`,
      },
      {
        name: 'warningLoad',
        score: Math.max(
          0.45,
          1 - artifact.warnings.length * 0.12 - stateAwareValidation.issueSummary.warnings * 0.04
        ),
        weight: 1,
        reason: `${artifact.warnings.length} generation warning(s) and ${stateAwareValidation.issueSummary.warnings} state-aware validation warning(s).`,
      },
    ],
    'Confidence reflects pattern fit, reference policy compliance, stable-reference coverage, validation, and warning load.'
  );
}

function buildGenerationAssumptions(artifact: ScriptArtifact) {
  return [
    assumptionDetail(
      'The generated script is a review artifact, not an executed command.',
      'Review Mode returns code only and does not call vMix functions.',
      'high',
      0.95
    ),
    assumptionDetail(
      'Required input references should remain valid until the script is manually used.',
      `${artifact.requiredInputs.filter((input) => stableReferenceKind(input) === 'key').length} required input(s) expose stable keys.`,
      'medium',
      0.82
    ),
    assumptionDetail(
      'Pattern selection is heuristic.',
      `The selected pattern is ${artifact.pattern} with confidence ${Number(artifact.confidence.toFixed(2))}.`,
      artifact.pattern === 'customTemplate' ? 'high' : 'medium',
      artifact.confidence
    ),
    assumptionDetail(
      'Automation preflight reflects current parsed state and must be rechecked if vMix state changes before execution.',
      'Preflight is generated from the parsed state snapshot at generation time.',
      'medium',
      0.8
    ),
    // Pattern-specific assumptions previously surfaced as a separate top-level
    // string[] `assumptions` field; folded here so each statement lives once.
    ...artifact.assumptions.map((statement) =>
      assumptionDetail(
        statement,
        'Derived from the goal and the selected script pattern.',
        'medium',
        artifact.confidence
      )
    ),
  ];
}

function buildExecutionBoundary(): ExecutionBoundary {
  // The full execution/safety policy (operator execution tools, Review Mode
  // blocked functions, refusal policy, handoff preconditions) lives once in
  // vmix://server/status. Per-response we echo only the boundary essentials;
  // setupSteps/testSteps/reviewStatus already carry the handoff guidance.
  return {
    currentMode: 'review',
    executed: false,
    controlModeFlag: 'VMIX_CONTROL_MODE=true',
    fullPolicy: 'vmix://server/status',
  };
}

function generateArtifact(state: VmixState, goal: string): ScriptArtifact {
  const lowerGoal = goal.toLowerCase();

  if (isPairedAudioGoal(goal)) {
    const artifact = buildPairedAudioFollowArtifact(state, goal);
    if (artifact) return artifact;
  }

  if (
    (lowerGoal.includes('cycle') || lowerGoal.includes('rotate') || lowerGoal.includes('switch between')) &&
    (lowerGoal.includes('camera') || lowerGoal.includes('input') || lowerGoal.includes('guest'))
  ) {
    const artifact = buildCameraCycleArtifact(state, goal);
    if (artifact) return artifact;
  }

  if (isLayoutCleanupGoal(goal)) {
    const artifact = buildLayoutCleanupArtifact(state, goal);
    if (artifact) return artifact;
  }

  if (isTalkbackReturnGoal(goal)) {
    const artifact = buildTalkbackReturnArtifact(state, goal);
    if (artifact) return artifact;
  }

  if (isSlotDrivenLowerThirdGoal(goal)) {
    const artifact = buildSlotLowerThirdArtifact(state, goal);
    if (artifact) return artifact;
  }

  if (
    (lowerGoal.includes('show') || lowerGoal.includes('display')) &&
    (lowerGoal.includes('lower third') || lowerGoal.includes('overlay') || lowerGoal.includes('graphic')) &&
    (lowerGoal.includes('second') || lowerGoal.includes('sec'))
  ) {
    const artifact = buildTimedOverlayArtifact(state, goal);
    if (artifact) return artifact;
  }

  if (
    (lowerGoal.includes('when') || lowerGoal.includes('after')) &&
    (lowerGoal.includes('video') || lowerGoal.includes('ends') || lowerGoal.includes('finishes'))
  ) {
    const artifact = buildVideoEndArtifact(state, goal);
    if (artifact) return artifact;
  }

  if (
    (lowerGoal.includes('watch') ||
      lowerGoal.includes('monitor') ||
      lowerGoal.includes('whenever') ||
      lowerGoal.includes('when') ||
      lowerGoal.includes('if ')) &&
    (lowerGoal.includes('program') || lowerGoal.includes('active') || lowerGoal.includes('live')) &&
    (lowerGoal.includes('set') || lowerGoal.includes('update')) &&
    (lowerGoal.includes('text') || lowerGoal.includes('title'))
  ) {
    const artifact = buildProgramTitleWatcherArtifact(state, goal);
    if (artifact) return artifact;
  }

  if (
    (lowerGoal.includes('set') || lowerGoal.includes('update') || lowerGoal.includes('change')) &&
    (lowerGoal.includes('text') || lowerGoal.includes('title') || lowerGoal.includes('score'))
  ) {
    const artifact = buildTitleUpdateArtifact(state, goal);
    if (artifact) return artifact;
  }

  if (lowerGoal.includes('duck') || (lowerGoal.includes('lower') && lowerGoal.includes('audio'))) {
    const artifact = buildAudioDuckingArtifact(state);
    if (artifact) return artifact;
  }

  if (
    lowerGoal.includes('record') ||
    lowerGoal.includes('stream') ||
    lowerGoal.includes('recording') ||
    lowerGoal.includes('streaming')
  ) {
    return buildRecordingArtifact(goal);
  }

  return buildCustomArtifact(state, goal);
}

export const generateScriptTool = createTool({
  name: 'vmix_generate_script',
  description:
    'Read-only VB.NET script generator for vMix. Returns a reviewable script artifact with validation, setup steps, ' +
    'test steps, assumptions, and failure modes. It never executes scripts.',
  schema: z.object({
    goal: z
      .string()
      .min(1)
      .describe('Natural language goal for the vMix VB.NET script to generate.'),
  }),
  handler: async ({ goal }: { goal: string }, ctx: ToolContext) => {
    const state = await ctx.state.getState();
    const artifact = generateArtifact(state, goal);
    const stateAwareValidation = validateScriptAgainstState(state, artifact.code);
    const validation = stateAwareValidation.baseValidation;
    const productionReview = buildProductionScriptReview(artifact, stateAwareValidation);
    const referencePlan = buildReferencePlan(artifact, state, goal, stateAwareValidation);
    const automationPreflight = getAutomationPreflightHandoff(state);
    const baseReviewStatus = determineReviewStatus(
      artifact,
      validation,
      stateAwareValidation,
      referencePlan.audit
    );
    const reviewStatus = automationPreflight.blocksExecution ? 'blocked' : baseReviewStatus;
    const warnings = [
      ...artifact.warnings,
      ...productionReview.warnings,
      automationPreflight.status === 'blocked'
        ? `Preflight is blocked before script execution: ${automationPreflight.blockers.join(' | ') || automationPreflight.summary}`
        : automationPreflight.status === 'caution'
          ? `Preflight has caution items before script execution: ${automationPreflight.cautions.join(' | ') || automationPreflight.summary}`
          : `Preflight status is go for script review: ${automationPreflight.summary}`,
    ];

    const result = {
      goal,
      mode: 'readOnlyScriptGeneration',
      execution: {
        executed: false,
        note: 'Review Mode only returns a reviewable script artifact. Use vMix manually or explicit High-Impact Control tooling to run reviewed scripts.',
      },
      executionBoundary: buildExecutionBoundary(),
      goalSummary: buildGoalSummary(goal, artifact),
      compilerWorkflow: buildCompilerWorkflow(
        artifact,
        validation,
        stateAwareValidation,
        referencePlan.audit,
        automationPreflight
      ),
      reviewStatus,
      pattern: artifact.pattern,
      confidence: Number(artifact.confidence.toFixed(2)),
      explanation: artifact.explanation,
      requiredInputs: artifact.requiredInputs.map(summarizeRequiredInput),
      requiredFields: artifact.requiredFields,
      referencePlan,
      deliverable: {
        type: 'vbnet-script',
        language: 'VB.NET for vMix scripting',
        copyReady: reviewStatus === 'readyForReview',
        requiresHumanReview: true,
        code: artifact.code,
      },
      validationResult: summarizeValidation(validation, stateAwareValidation),
      automationPreflight,
      productionReview,
      stateAwareValidation: {
        valid: stateAwareValidation.valid,
        issueSummary: stateAwareValidation.issueSummary,
        issues: stateAwareValidation.issues,
        scriptingDiagnostics: stateAwareValidation.scriptingDiagnostics,
        apiCalls: stateAwareValidation.apiCalls,
        recommendations: stateAwareValidation.recommendations,
        analysisConfidence: stateAwareValidation.analysisConfidence,
        assumptions: stateAwareValidation.assumptions,
        assumptionDetails: stateAwareValidation.assumptionDetails,
        parserLimitations: stateAwareValidation.parserLimitations,
      },
      analysisConfidence: buildGenerationConfidence(artifact, stateAwareValidation, referencePlan.audit),
      assumptionDetails: buildGenerationAssumptions(artifact),
      setupSteps: [
        automationPreflight.executionRecommendation,
        ...automationPreflight.requiredOperatorConfirmations,
        ...productionReview.setupSteps,
        ...artifact.setupSteps,
      ],
      testSteps: [
        ...automationPreflight.recommendedNextTests,
        ...productionReview.testSteps,
        ...artifact.testSteps,
      ],
      failureModes: [
        ...(automationPreflight.blocksExecution
          ? ['Executing this script while preflight is blocked can preserve or worsen a known show-critical problem.']
          : []),
        ...productionReview.failureModes,
        ...artifact.failureModes,
      ],
      warnings,
      stateContext: {
        inputCount: state.inputs.length,
        program: state.active,
        preview: state.preview,
        mixes: (state.mixes ?? []).map((mix) => ({
          number: mix.number,
          active: mix.active,
          preview: mix.preview,
        })),
      },
      parserLimitations: [
        'Role detection and pattern matching are heuristic; mix active/preview paths are parsed when vMix exposes them, but mix output destinations still require operator verification.',
        'Generated scripts are validated with the shared state-aware validator, but dynamic runtime values still require human review.',
      ],
    };

    return toolJsonContent(result, !stateAwareValidation.valid);
  },
});

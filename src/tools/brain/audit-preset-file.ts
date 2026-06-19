/**
 * vmix_audit_preset_file - Cross-reference a saved .vmix preset against live state.
 * Surfaces ScriptStart triggers with missing scripts, triggers targeting absent
 * inputs, and saved-vs-live drift.
 */
import { z } from 'zod';
import { createTool, toolJsonContent, errorResult, type ToolContext } from '../base.js';
import { loadPresetFile } from '../../state/preset/preset-loader.js';
import { parsePresetFile } from '../../state/preset/preset-parser.js';
import { redactPresetFile } from '../../state/preset/preset-redaction.js';
import { crossReferencePreset, type CrossReferenceFinding } from '../../state/preset/cross-reference.js';
import type { PresetFile, PresetInput, PresetInputTrigger, PresetScript } from '../../state/preset/preset-types.js';
import type { VmixState } from '../../state/types.js';
import { formatErrorMessage } from '../../errors/index.js';
import { normalizeInputKey } from '../../utils/input-normalizer.js';

const schema = z.object({
  path: z.string().optional().describe('Absolute path to a .vmix file on the server host.'),
  content: z.string().optional().describe('Raw .vmix XML fallback when a server-host file path is unavailable.'),
  targetInput: z
    .union([z.string().min(1), z.number().int().positive()])
    .optional()
    .describe('Optional saved input number, title, or key to summarize its triggers and inbound trigger/script references.'),
});

function summarize(findings: CrossReferenceFinding[]) {
  return {
    total: findings.length,
    errors: findings.filter((f) => f.severity === 'error').length,
    warnings: findings.filter((f) => f.severity === 'warning').length,
    info: findings.filter((f) => f.severity === 'info').length,
  };
}

interface ResolvedPresetInput {
  number: number;
  input: PresetInput;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function triggerText(trigger: PresetInputTrigger): string {
  return [
    trigger.event,
    trigger.function,
    trigger.value,
    trigger.targetInputKey,
    trigger.targetInputNumber?.toString() ?? null,
  ]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(' ');
}

function countLiteralOccurrences(haystack: string, needle: string | null): number {
  if (needle === null || needle.length === 0) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count++;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

function countNumberInputReferences(source: string, inputNumber: number): number {
  const escaped = inputNumber.toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`\\bInput\\s*:?=\\s*["']?${escaped}["']?\\b`, 'gi'),
    new RegExp(`\\bInput\\s+${escaped}\\b`, 'gi'),
  ];
  return patterns.reduce((count, pattern) => count + [...source.matchAll(pattern)].length, 0);
}

function scriptMatch(script: PresetScript, target: ResolvedPresetInput) {
  const titleCount = countLiteralOccurrences(script.source, target.input.title);
  const key = target.input.key ? normalizeInputKey(target.input.key) : '';
  const keyCount = key.length > 0 ? countLiteralOccurrences(normalizeInputKey(script.source), key) : 0;
  const numberCount = countNumberInputReferences(script.source, target.number);
  const matchBy: string[] = [];
  if (titleCount > 0) matchBy.push('title');
  if (keyCount > 0) matchBy.push('stable key');
  if (numberCount > 0) matchBy.push('input number');
  return {
    scriptName: script.name,
    matchBy,
    occurrences: {
      title: titleCount,
      stableKey: keyCount,
      inputNumber: numberCount,
    },
  };
}

function findSavedInputByTitleOrKey(
  preset: PresetFile,
  target: string,
  preferredNumber: number | null
): ResolvedPresetInput | null {
  const normalizedTarget = normalizeText(target);
  const normalizedKeyTarget = normalizeInputKey(target);
  const exact = preset.inputs.find((input) => {
    const title = normalizeText(input.title);
    const key = input.key ? normalizeInputKey(input.key) : '';
    return title === normalizedTarget || (key.length > 0 && key === normalizedKeyTarget);
  });
  if (exact) return { number: preferredNumber ?? preset.inputs.indexOf(exact) + 1, input: exact };

  const partialMatches = preset.inputs.filter((input) => normalizeText(input.title).includes(normalizedTarget));
  if (partialMatches.length === 1) {
    return { number: preferredNumber ?? preset.inputs.indexOf(partialMatches[0]!) + 1, input: partialMatches[0]! };
  }

  return null;
}

function resolveTargetInput(
  preset: PresetFile,
  targetInput: string | number,
  state: VmixState
): ResolvedPresetInput | null {
  if (typeof targetInput === 'number') {
    const liveInput = state.inputs.find((input) => input.number === targetInput);
    if (liveInput) {
      const byKey = findSavedInputByTitleOrKey(preset, liveInput.key, targetInput);
      if (byKey) return byKey;
      const byTitle = findSavedInputByTitleOrKey(preset, liveInput.title, targetInput);
      if (byTitle) return byTitle;
    }

    const input = preset.inputs[targetInput - 1];
    return input ? { number: targetInput, input } : null;
  }

  return findSavedInputByTitleOrKey(preset, targetInput.trim(), null);
}

function triggerReferencesTarget(trigger: PresetInputTrigger, target: ResolvedPresetInput): string[] {
  const matchBy: string[] = [];
  const key = target.input.key ? normalizeInputKey(target.input.key) : '';
  const text = normalizeText(triggerText(trigger));
  if (trigger.targetInputNumber === target.number || /\binput\b/.test(text) && text.includes(target.number.toString())) {
    matchBy.push('input number');
  }
  if (target.input.title.length > 0 && text.includes(normalizeText(target.input.title))) {
    matchBy.push('title');
  }
  if (
    key.length > 0 &&
    (normalizeInputKey(trigger.targetInputKey ?? '') === key || normalizeInputKey(triggerText(trigger)).includes(key))
  ) {
    matchBy.push('stable key');
  }
  return [...new Set(matchBy)];
}

function triggerSummary(input: PresetInput, trigger: PresetInputTrigger) {
  return {
    inputTitle: input.title,
    inputKey: input.key,
    event: trigger.event,
    function: trigger.function,
    value: trigger.value,
    targetInputKey: trigger.targetInputKey,
    targetInputNumber: trigger.targetInputNumber,
  };
}

function buildTargetInputReferenceSummary(preset: PresetFile, state: VmixState, targetInput: string | number) {
  const target = resolveTargetInput(preset, targetInput, state);
  if (!target) {
    return {
      status: 'notFound' as const,
      requested: targetInput,
      responseGuidance:
        'Tell the user the target input was not found in the saved preset. Ask for an exact saved input number, title, or stable key.',
    };
  }

  const scriptMatches = preset.scripts
    .map((script) => scriptMatch(script, target))
    .filter((match) => match.matchBy.length > 0);
  const scriptNames = new Set(scriptMatches.map((match) => match.scriptName));
  const directTriggerReferences = [];
  const scriptStartTriggers = [];

  for (const input of preset.inputs) {
    for (const trigger of input.triggers) {
      const directMatchBy = triggerReferencesTarget(trigger, target);
      if (input !== target.input && directMatchBy.length > 0) {
        directTriggerReferences.push({
          ...triggerSummary(input, trigger),
          matchBy: directMatchBy,
        });
      }
      if (/^ScriptStart/i.test(trigger.function) && trigger.value && scriptNames.has(trigger.value)) {
        scriptStartTriggers.push({
          ...triggerSummary(input, trigger),
          startedScript: trigger.value,
        });
      }
    }
  }

  const scriptsByTitle = scriptMatches.filter((match) => match.matchBy.includes('title')).length;
  const scriptsByKey = scriptMatches.filter((match) => match.matchBy.includes('stable key')).length;
  const scriptsByNumber = scriptMatches.filter((match) => match.matchBy.includes('input number')).length;

  return {
    status: 'resolved' as const,
    requested: targetInput,
    target: {
      number: target.number,
      title: target.input.title,
      key: target.input.key,
      type: target.input.type,
    },
    summary: {
      ownTriggerCount: target.input.triggers.length,
      directInboundTriggerReferenceCount: directTriggerReferences.length,
      scriptsReferencingTargetCount: scriptMatches.length,
      scriptStartTriggersForReferencingScripts: scriptStartTriggers.length,
      referenceStyle: {
        scriptsByTitle,
        scriptsByStableKey: scriptsByKey,
        scriptsByInputNumber: scriptsByNumber,
      },
      headline:
        target.input.triggers.length === 0 && directTriggerReferences.length === 0
          ? `${target.input.title} has no own triggers and no other saved input trigger directly targets it. ${scriptMatches.length} saved script(s) reference it, and ${scriptStartTriggers.length} saved trigger(s) start those referencing scripts.`
          : `${target.input.title} has ${target.input.triggers.length} own trigger(s), ${directTriggerReferences.length} direct inbound trigger reference(s), ${scriptMatches.length} saved script reference(s), and ${scriptStartTriggers.length} saved trigger(s) that start those referencing scripts.`,
      risk:
        scriptsByTitle > 0 && scriptsByKey === 0
          ? 'Scripts reference this input by title, not stable key. Renaming the input can break those script lookups.'
          : null,
    },
    ownTriggers: target.input.triggers.map((trigger) => triggerSummary(target.input, trigger)),
    directInboundTriggerReferences: directTriggerReferences,
    scriptsReferencingTarget: scriptMatches,
    scriptStartTriggersForReferencingScripts: scriptStartTriggers,
    responseGuidance:
      'Start with targetInputReferenceSummary.summary.headline in plain language. Then list own triggers, direct inbound trigger references, scripts referencing the target, and any input triggers that start those referencing scripts. Do not expose raw tool code, shell commands, or internal extraction steps.',
  };
}

export const auditPresetFileTool = createTool({
  name: 'vmix_audit_preset_file',
  description:
    'Read-only cross-reference of a saved .vmix preset against current live vMix state. Flags triggers that call ' +
    'missing scripts, triggers targeting absent inputs, and saved-vs-live drift. Use targetInput as the first choice for one-input questions about attached triggers, inbound trigger references, or scripts that reference that input; this avoids broad script dumps. Reflects the preset as last saved. Prefer an explicit path on the CueScope server host; raw XML content is a fallback.',
  schema,
  handler: async (params: { path?: string; content?: string; targetInput?: string | number }, ctx: ToolContext) => {
    if (!params.path?.trim() && !params.content) {
      return errorResult('Provide either a .vmix file path on the CueScope server host or raw XML content as a fallback.');
    }
    try {
      const preset = redactPresetFile(parsePresetFile(loadPresetFile(params)));
      const state = await ctx.state.getState();
      const findings = crossReferencePreset(preset, state);
      return toolJsonContent({
        source: preset.meta.source,
        freshnessNote: preset.meta.freshnessNote,
        meta: preset.meta,
        findingSummary: summarize(findings),
        findings,
        targetInputReferenceSummary:
          params.targetInput !== undefined ? buildTargetInputReferenceSummary(preset, state, params.targetInput) : null,
        note: 'Errors usually mean a saved reference was renamed/removed live, or the preset was not re-saved after edits.',
      });
    } catch (error) {
      return errorResult(formatErrorMessage(error));
    }
  },
});

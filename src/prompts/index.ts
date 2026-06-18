/**
 * MCP prompts for CueScope
 *
 * Reusable, documented workflows sourced from DEMO.md. Prompts are
 * mode-independent: they only reference Review Mode tools and read-only
 * resources, so they are safe to expose in every mode.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';

/** Arguments passed to a prompt builder (already validated by the SDK) */
export type PromptArgs = Record<string, string | undefined>;

/**
 * Prompt definition: metadata plus a text builder.
 * `argsSchema` uses Zod string schemas as required by MCP prompt arguments.
 */
export interface VmixPromptDefinition {
  name: string;
  title: string;
  description: string;
  argsSchema: Record<string, z.ZodType<string | undefined>>;
  /** Build the prompt text from (optional) arguments */
  build: (args: PromptArgs) => string;
}

export const preflightCheckPrompt: VmixPromptDefinition = {
  name: 'preflight-check',
  title: 'Preflight Check',
  description:
    'Run vmix_preflight and summarize go-live readiness with a prioritized verdict.',
  argsSchema: {},
  build: () =>
    'Run the vmix_preflight tool and summarize my go-live readiness. ' +
    'Report the verdict (ready / caution / not-ready), then walk through the findings by severity: ' +
    'program, preview, audio, fade to black, overlays, and input roles. ' +
    'Call out anything I must fix before the show and anything I should double-check. ' +
    'Do not execute or change anything in vMix.',
};

export const showReviewPrompt: VmixPromptDefinition = {
  name: 'show-review',
  title: 'Show Review',
  description:
    'Run a natural-language show review that combines live state, audio diagnosis, preflight, checklist guidance, and optional saved-preset audit evidence.',
  argsSchema: {
    path: z
      .string()
      .optional()
      .describe('Optional explicit path to a saved .vmix preset for cross-reference'),
    intent: z
      .string()
      .optional()
      .describe('Optional review intent: showReview, goLive, rehearsal, recovery, endShow, or audio'),
  },
  build: (args) => {
    const intent = args['intent'] ?? 'showReview';
    const path = args['path'];
    const presetInstruction = path
      ? `Pass presetPath "${path}" so saved-preset context can improve confidence. `
      : 'If I have already supplied an explicit saved .vmix path in this conversation, reuse it. Otherwise run live-state-only and ask one plain follow-up if saved-preset context would improve confidence. ';

    return (
      `Run the vmix_show_review tool with intent "${intent}". ` +
      presetInstruction +
      'Summarize the overall status, Program/Preview, preflight findings, audio review, output readiness, saved-preset audio/audit evidence if present, and the operator checklist disposition. ' +
      'Use the tool presentationGuidance headline, statusLabel, and sectionLabels for severity wording; reserve blocker or red-alert language for true blocked categories only. ' +
      'When output readiness includes a readinessSummary headline, use it for the output section so idle outputs read as not armed yet rather than failed. ' +
      'Use "review" or "needs confirmation" wording for intentional parked or muted states unless there is a true blocker. Do not execute or change anything in vMix.'
    );
  },
};

export const diagnoseAudioPrompt: VmixPromptDefinition = {
  name: 'diagnose-audio',
  title: 'Diagnose Audio',
  description:
    'Diagnose audio routing problems (muted sources, Master routing, mix-minus, feedback risks). Optionally focus on one input.',
  argsSchema: {
    input: z
      .string()
      .optional()
      .describe('Optional input name or number to focus on (e.g. a silent input)'),
  },
  build: (args) => {
    const base =
      'Diagnose my audio routing with the vmix_diagnose_audio tool. ' +
      'Pay special attention to muted sources, Master routing, remote guest mix-minus, ' +
      'monitoring buses, and anything that could create feedback. ' +
      'Group findings by severity and list review steps before going live.';
    if (args['input']) {
      return (
        `Input "${args['input']}" sounds silent or wrong. ${base} ` +
        `Start with input "${args['input']}": check its mute state, bus routing, and whether it reaches Master.`
      );
    }
    return base;
  },
};

export const outputReadinessPrompt: VmixPromptDefinition = {
  name: 'output-readiness',
  title: 'Output Readiness',
  description:
    'Review recording, streaming, external output, video path, audio path, and destination blind spots without controlling vMix.',
  argsSchema: {
    focus: z
      .string()
      .optional()
      .describe('Optional focus: goLive, recording, streaming, external, or all'),
  },
  build: (args) => {
    const focus = args['focus'] ?? 'goLive';
    return (
      `Run the vmix_diagnose_outputs tool with focus "${focus}". ` +
      'Summarize visible recording/streaming/external state, Program/Preview, Fade to Black, video mix caveats, Master/aux audio path, output-like helper inputs, and destination checks. ' +
      'Use the tool readinessSummary headline as the reader-facing bottom line; when outputs are idle, say "not armed yet" or "ready for operator verification" instead of using failure language unless there is a true blocker. ' +
      'Clearly separate what live XML proves from what the operator must verify in vMix or on the downstream platform/device. ' +
      'Do not execute or change anything in vMix, and do not ask me to paste stream keys, private URLs, recording paths, passwords, or private network details.'
    );
  },
};

export const explainMySetupPrompt: VmixPromptDefinition = {
  name: 'explain-my-setup',
  title: 'Explain My Setup',
  description:
    'Read the live state summary and relationships and explain the production like a show runbook.',
  argsSchema: {},
  build: () =>
    'Read vmix://state/summary and vmix://state/relationships (and run vmix_analyze_preset if helpful) ' +
    'and explain my current vMix production like I am preparing for a show. ' +
    'Cover active and preview inputs, key inputs and their likely production roles, overlays, ' +
    'title fields, audio shape, and any risks before going live.',
};

export const auditPresetPrompt: VmixPromptDefinition = {
  name: 'audit-preset',
  title: 'Audit Preset File',
  description:
    'Audit a saved .vmix preset file against live vMix state and flag drift, missing scripts, and risky triggers.',
  argsSchema: {
    path: z.string().describe('Path to the saved .vmix preset file to audit'),
  },
  build: (args) => {
    const path = args['path'] ?? '<path to .vmix file>';
    return (
      `Audit the saved vMix preset file at "${path}" using the vmix_audit_preset_file tool. ` +
      'Cross-reference it against my live vMix state: flag triggers calling missing scripts, ' +
      'triggers targeting absent inputs, and saved-vs-live drift. ' +
      'Explain each finding in plain language and what I should review before relying on this preset. ' +
      'This is read-only: do not open or change the preset in vMix.'
    );
  },
};

export const goLiveChecklistPrompt: VmixPromptDefinition = {
  name: 'go-live-checklist',
  title: 'Go-Live Checklist',
  description:
    'Generate a reviewable show checklist (rehearsal, go-live, recovery, or end-show) from live state.',
  argsSchema: {
    phase: z
      .string()
      .optional()
      .describe('Optional checklist phase: rehearsal, go-live, recovery, or end-show'),
  },
  build: (args) => {
    const phase = args['phase'] ?? 'go-live';
    return (
      `Generate a reviewable ${phase} checklist for my current vMix setup with the ` +
      'vmix_generate_show_checklist tool. Base it on my actual inputs, overlays, audio routing, ' +
      'and output state. Order the steps for an operator, include verification points, ' +
      'and call out anything risky found in the current state. Do not execute anything.'
    );
  },
};

/**
 * All prompts, in registration order
 */
export const allPrompts: VmixPromptDefinition[] = [
  showReviewPrompt,
  preflightCheckPrompt,
  diagnoseAudioPrompt,
  outputReadinessPrompt,
  explainMySetupPrompt,
  auditPresetPrompt,
  goLiveChecklistPrompt,
];

/**
 * Get prompt count metadata
 */
export function getPromptCount(): number {
  return allPrompts.length;
}

/**
 * Wrap prompt text in an MCP GetPromptResult
 */
function toPromptResult(description: string, text: string): GetPromptResult {
  return {
    description,
    messages: [
      {
        role: 'user',
        content: { type: 'text', text },
      },
    ],
  };
}

/**
 * Register all prompts on the MCP server
 */
export function registerAllPrompts(server: McpServer): void {
  for (const prompt of allPrompts) {
    server.registerPrompt(
      prompt.name,
      {
        title: prompt.title,
        description: prompt.description,
        argsSchema: prompt.argsSchema,
      },
      (args: PromptArgs) => toPromptResult(prompt.description, prompt.build(args ?? {}))
    );
  }
}

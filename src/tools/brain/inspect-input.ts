/**
 * vmix_inspect_input - Live-first input inspection with saved-preset guidance.
 *
 * This wraps the detailed single-input explanation with an explicit evidence
 * lane so client models do not ask for a .vmix file when live state is enough.
 */

import { z } from 'zod';
import { createTool, toolJsonContent, type ToolContext, type ToolResult } from '../base.js';
import { formatErrorMessage } from '../../errors/index.js';
import { explainInputTool } from './explain-input.js';

type InputReference = string | number;

interface SavedPresetNeed {
  neededForThisQuestion: boolean;
  topics: string[];
  reason: string;
}

interface ParsedToolPayload {
  [key: string]: unknown;
}

const SAVED_PRESET_REQUEST =
  'To inspect saved-only details, provide the absolute path to the .vmix file on the machine running CueScope. This is preferred for real presets. If that path is not available, paste the raw .vmix XML content as a fallback.';

const ATTACHMENT_LIMIT_NOTE =
  'A chat-uploaded .vmix attachment may not be readable by the CueScope MCP server, and large presets are better handled by path than by sending raw XML through the chat/tool payload.';

const NO_FILE_SCAN_REASON =
  'CueScope does not scan local folders or infer private preset paths from live XML. Saved .vmix files can be stale, private, or different from the running show.';

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function detectSavedPresetNeed(question?: string): SavedPresetNeed {
  const normalized = question?.toLowerCase() ?? '';
  const topics: string[] = [];

  if (/\b(script|scripts|vb\.?net|macro|automation)\b/.test(normalized)) {
    topics.push('stored VB.NET scripts');
  }

  if (/\b(trigger|triggers|ontransition|oncompletion|onoverlay|shortcut)\b/.test(normalized)) {
    topics.push('saved input triggers and shortcut-style references');
  }

  if (/\b(data\s*source|datasource|binding|bound|row|table|google sheets|csv)\b/.test(normalized)) {
    topics.push('saved data-source definitions or bindings');
  }

  if (/\b(driv(?:e|es|en|ing)|behind|feeds?|updates?|countdown|timer)\b/.test(normalized)) {
    topics.push('scripts, triggers, or data sources that may update visible fields');
  }

  const savedTopics = unique(topics);
  return {
    neededForThisQuestion: savedTopics.length > 0,
    topics: savedTopics,
    reason:
      savedTopics.length > 0
        ? 'Live vMix XML can show current input state and visible field values, but saved scripts, triggers, title countdown settings, and data-source setup require explicit .vmix preset evidence.'
        : 'Live vMix XML is enough to identify and explain the current input, visible fields, placement, playback state, and audio routing.',
  };
}

function parseToolPayload(result: ToolResult): ParsedToolPayload {
  const text = result.content[0]?.text ?? '{}';
  try {
    return JSON.parse(text) as ParsedToolPayload;
  } catch {
    return {
      parseError: 'Could not parse nested tool output as JSON.',
      rawText: text,
    };
  }
}

function buildSavedPresetGuidance(savedNeed: SavedPresetNeed) {
  return {
    neededForThisQuestion: savedNeed.neededForThisQuestion,
    neededFor: savedNeed.topics,
    notNeededFor: [
      'identifying the current live input',
      'visible title/image field names and current values',
      'current Program/Preview/overlay placement',
      'current playback state',
      'current audio routing exposed by live XML',
    ],
    reason: savedNeed.reason,
    explicitRequestToUser: savedNeed.neededForThisQuestion
      ? SAVED_PRESET_REQUEST
      : 'No saved .vmix file is needed for this live input inspection. If the user asks about saved scripts, triggers, or data-source bindings, ask first for an explicit .vmix path on the CueScope server host; raw XML content is a fallback.',
    pathHandoffNote: savedNeed.neededForThisQuestion ? ATTACHMENT_LIMIT_NOTE : undefined,
    fileSearchPerformed: false,
    reasonNotAutoRead: NO_FILE_SCAN_REASON,
  };
}

function compactLiveSummary(live: ParsedToolPayload) {
  const input = live.input as Record<string, unknown> | undefined;
  const fields = live.fields as Record<string, unknown> | undefined;
  const placement = live.placement as Record<string, unknown> | undefined;

  if (!input) return null;

  return {
    number: input.number,
    title: input.title,
    type: input.type,
    role: input.role,
    productionRole: (input.productionRole as Record<string, unknown> | undefined)?.primary,
    state: input.state,
    stableReference: input.stableReference,
    placement,
    fields: fields
      ? {
          count: fields.count,
          names: fields.names,
          values: fields.values,
        }
      : null,
  };
}

export const inspectInputTool = createTool({
  name: 'vmix_inspect_input',
  description:
    'Live-first inspection for a current vMix input. Use first for questions like "what is Input 8" or ' +
    '"what is this input in my preset/show"; no saved .vmix file is required for visible live state. ' +
    'If the question needs saved scripts, triggers, or data-source bindings, the response explicitly asks first for a .vmix path on the CueScope server host, with raw XML content as a fallback.',
  schema: z.object({
    input: z
      .union([z.string().min(1), z.number().int().positive()])
      .describe('Input key, number, exact title, or unique partial title to inspect from current live vMix state.'),
    question: z
      .string()
      .optional()
      .describe('Optional user question. Used only to decide whether saved-preset evidence should be requested.'),
  }),
  handler: async (
    { input, question }: { input: InputReference; question?: string },
    ctx: ToolContext
  ) => {
    const savedNeed = detectSavedPresetNeed(question);
    let liveResult: ToolResult;

    try {
      liveResult = await explainInputTool.handler({ input }, ctx);
    } catch (error) {
      const message = formatErrorMessage(error);
      return toolJsonContent(
        {
          query: {
            input,
            question: question ?? null,
          },
          evidenceLane: {
            primary: 'live-state',
            source: 'current vMix /api XML via CueScope state cache',
            savedPresetFileRead: false,
            fileSearchPerformed: false,
          },
          status: 'live-state-unavailable',
          error: message,
          liveSummary: null,
          liveInspection: null,
          savedPresetGuidance: buildSavedPresetGuidance(savedNeed),
          connectionGuidance: {
            nextTool: 'vmix_connection_test',
            message:
              'For current input questions, diagnose the vMix connection first. Ask for a saved .vmix path or file/XML only if the user wants last-saved preset evidence or saved-only scripts, triggers, data-source bindings, or drift checks.',
          },
          responseGuidance:
            'Tell the user CueScope normally answers this from live vMix state, but live state is unavailable. Run vmix_connection_test before asking for a saved .vmix file unless the user specifically wants saved preset contents.',
        },
        true
      );
    }

    const live = parseToolPayload(liveResult);

    return toolJsonContent(
      {
        query: {
          input,
          question: question ?? null,
        },
        evidenceLane: {
          primary: 'live-state',
          source: 'current vMix /api XML via CueScope state cache',
          savedPresetFileRead: false,
          fileSearchPerformed: false,
        },
        status: liveResult.isError ? 'input-not-found' : savedNeed.neededForThisQuestion ? 'partial' : 'answered-from-live-state',
        liveSummary: compactLiveSummary(live),
        liveInspection: live,
        savedPresetGuidance: buildSavedPresetGuidance(savedNeed),
        responseGuidance: liveResult.isError
          ? 'Tell the user the input was not found in current live state and suggest an exact number, title, or key. Do not ask for a saved .vmix file unless the user is asking about saved-only preset details.'
          : savedNeed.neededForThisQuestion
      ? 'Answer the live-state portion first, then explicitly ask for the .vmix path on the CueScope server host for saved scripts, triggers, title countdown settings, or data-source bindings. If no server-visible path is available, ask for raw XML content as a fallback.'
            : 'Answer directly from live state. Do not ask for a saved .vmix file for this question.',
      },
      liveResult.isError
    );
  },
});

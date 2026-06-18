/**
 * vmix_multiview_create - Create split-screen multi-view layouts
 *
 * Uses vMix layer system to composite multiple inputs into one view.
 * Reference: https://www.vmix.com/help29/ShortcutFunctionReference.html
 */

import { z } from 'zod';
import { createTool, successResult, errorResult, type ToolContext } from '../base.js';
import { resolveInput } from '../../utils/input-resolver.js';

/**
 * Layout configurations for different multi-view styles
 *
 * vMix layer positioning:
 * - Zoom: 1 = 100%, 0.5 = 50%, 2 = 200%
 * - PanX: -2 to 2, where 0 = centered, -2 = 100% left, 2 = 100% right
 * - PanY: -2 to 2, where 0 = centered, -2 = 100% up, 2 = 100% down
 */
const LAYOUTS = {
  quad: {
    name: 'Quad (2x2)',
    positions: [
      { zoom: 0.5, panX: -0.5, panY: -0.5 },
      { zoom: 0.5, panX: 0.5, panY: -0.5 },
      { zoom: 0.5, panX: -0.5, panY: 0.5 },
      { zoom: 0.5, panX: 0.5, panY: 0.5 },
    ],
    maxInputs: 4,
  },
  'side-by-side': {
    name: 'Side by Side',
    positions: [
      { zoom: 0.5, panX: -0.5, panY: 0 },
      { zoom: 0.5, panX: 0.5, panY: 0 },
    ],
    maxInputs: 2,
  },
  'pip-corner': {
    name: 'Picture-in-Picture (Corner)',
    positions: [
      { zoom: 1, panX: 0, panY: 0 },
      { zoom: 0.25, panX: 0.7, panY: 0.7 },
    ],
    maxInputs: 2,
  },
  'pip-large': {
    name: 'Picture-in-Picture (Large)',
    positions: [
      { zoom: 1, panX: 0, panY: 0 },
      { zoom: 0.4, panX: 0.55, panY: 0.55 },
    ],
    maxInputs: 2,
  },
  thirds: {
    name: 'Three-way Split',
    positions: [
      { zoom: 0.333, panX: -0.667, panY: 0 },
      { zoom: 0.333, panX: 0, panY: 0 },
      { zoom: 0.333, panX: 0.667, panY: 0 },
    ],
    maxInputs: 3,
  },
  'top-bottom': {
    name: 'Top and Bottom',
    positions: [
      { zoom: 0.5, panX: 0, panY: -0.5 },
      { zoom: 0.5, panX: 0, panY: 0.5 },
    ],
    maxInputs: 2,
  },
};

type LayoutType = keyof typeof LAYOUTS;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function diagramLabel(
  inputs: { title: string }[],
  index: number,
  fallback: string,
  width: number
): string {
  return (inputs[index]?.title ?? fallback).slice(0, width).padEnd(width);
}

function buildLayoutDiagram(
  layout: LayoutType,
  inputs: { title: string }[]
): string {
  const label = (index: number, fallback: string, width: number) =>
    diagramLabel(inputs, index, fallback, width);

  switch (layout) {
    case 'quad':
      return [
        '+---------+---------+',
        `| ${label(0, 'Empty', 7)} | ${label(1, 'Empty', 7)} |`,
        '+---------+---------+',
        `| ${label(2, 'Empty', 7)} | ${label(3, 'Empty', 7)} |`,
        '+---------+---------+',
      ].join('\n');
    case 'side-by-side':
      return [
        '+---------+---------+',
        `| ${label(0, 'Empty', 7)} | ${label(1, 'Empty', 7)} |`,
        '+---------+---------+',
      ].join('\n');
    case 'pip-corner':
    case 'pip-large':
      return [
        '+-----------------+',
        `| ${label(0, 'Main', 15)} |`,
        '|           +---+ |',
        `|           |${label(1, 'PIP', 3)}| |`,
        '|           +---+ |',
        '+-----------------+',
      ].join('\n');
    case 'thirds':
      return [
        '+-------+-------+-------+',
        `|${label(0, '', 7)}|${label(1, '', 7)}|${label(2, '', 7)}|`,
        '+-------+-------+-------+',
      ].join('\n');
    case 'top-bottom':
      return [
        '+-----------------+',
        `| ${label(0, 'Top', 15)} |`,
        '+-----------------+',
        `| ${label(1, 'Bottom', 15)} |`,
        '+-----------------+',
      ].join('\n');
  }
}

export const multiviewCreateTool = createTool({
  name: 'vmix_multiview_create',
  description:
    'Create a multi-view layout (split-screen) from multiple camera inputs. ' +
    'Creates a new virtual input with the cameras arranged in the specified layout. ' +
    'Available layouts: quad (2x2), side-by-side, pip-corner, pip-large, thirds, top-bottom.',
  schema: z.object({
    name: z.string().describe('Name for the new multi-view input'),
    layout: z
      .enum(['quad', 'side-by-side', 'pip-corner', 'pip-large', 'thirds', 'top-bottom'])
      .describe('Layout type'),
    inputs: z
      .array(z.union([z.string(), z.number()]))
      .describe('Input names or numbers to include (in order for the layout)'),
  }),
  handler: async (
    {
      name,
      layout,
      inputs,
    }: {
      name: string;
      layout: LayoutType;
      inputs: (string | number)[];
    },
    ctx: ToolContext
  ) => {
    const layoutConfig = LAYOUTS[layout];

    if (inputs.length > layoutConfig.maxInputs) {
      return errorResult(
        `Layout "${layout}" supports max ${layoutConfig.maxInputs} inputs, got ${inputs.length}`
      );
    }

    if (inputs.length < 2) {
      return errorResult('Multi-view requires at least 2 inputs');
    }

    const state = await ctx.state.getState();
    const resolvedInputs: { key: string; title: string; number: number }[] = [];

    for (const inputRef of inputs) {
      const resolved = resolveInput(state, inputRef);
      if (!resolved.success) {
        return errorResult(`Input "${inputRef}" not found: ${resolved.error}`);
      }
      resolvedInputs.push({
        key: resolved.key!,
        title: resolved.input!.title,
        number: resolved.input!.number,
      });
    }

    const blackColour = String(0xFF000000 | 0);

    ctx.state.invalidate();
    const stateBefore = await ctx.state.getState();
    const countBefore = stateBefore.inputs.length;

    try {
      await ctx.vmix.http.execute('AddInput', { Value: `Colour|${blackColour}` });
      await delay(500);
    } catch (e) {
      return errorResult(`Failed to create base input: ${e instanceof Error ? e.message : 'Unknown'}`);
    }

    ctx.state.invalidate();
    const stateAfter = await ctx.state.getState();

    if (stateAfter.inputs.length <= countBefore) {
      return errorResult('Failed to create base colour input');
    }

    const baseInput = stateAfter.inputs[stateAfter.inputs.length - 1];
    if (!baseInput) {
      return errorResult('Failed to find newly created input');
    }

    try {
      await ctx.vmix.http.execute('SetInputName', {
        Input: baseInput.key,
        Value: name,
      });
      await delay(100);
    } catch {
      // Non-critical error; continue with layer setup.
    }

    const layerResults: string[] = [];

    for (let i = 0; i < resolvedInputs.length; i++) {
      const pos = layoutConfig.positions[i];
      if (!pos) continue;

      const layerNum = i + 1;
      const inputInfo = resolvedInputs[i]!;

      try {
        await ctx.vmix.http.execute('SetLayer', {
          Input: baseInput.key,
          Value: `${layerNum},${inputInfo.number}`,
        });
        await delay(100);

        await ctx.vmix.http.execute(`SetLayer${layerNum}Zoom`, {
          Input: baseInput.key,
          Value: pos.zoom.toString(),
        });
        await delay(50);

        await ctx.vmix.http.execute(`SetLayer${layerNum}PanX`, {
          Input: baseInput.key,
          Value: pos.panX.toString(),
        });
        await delay(50);

        await ctx.vmix.http.execute(`SetLayer${layerNum}PanY`, {
          Input: baseInput.key,
          Value: pos.panY.toString(),
        });
        await delay(50);

        await ctx.vmix.http.execute('LayerOn', {
          Input: baseInput.key,
          Value: layerNum.toString(),
        });
        await delay(50);

        layerResults.push(
          `OK Layer ${layerNum}: "${inputInfo.title}" (zoom=${pos.zoom}, panX=${pos.panX}, panY=${pos.panY})`
        );
      } catch (e) {
        layerResults.push(
          `WARN Layer ${layerNum}: "${inputInfo.title}" - error: ${e instanceof Error ? e.message : 'unknown'}`
        );
      }
    }

    let text = `# Multi-View Created: ${name}\n\n`;
    text += `**Layout:** ${layoutConfig.name}\n`;
    text += `**Base Input:** #${baseInput.number}\n`;
    text += `**Layers:** ${resolvedInputs.length}\n\n`;

    text += `## Layout:\n\`\`\`\n${buildLayoutDiagram(layout, resolvedInputs)}\n\`\`\`\n\n`;

    text += '## Layer Configuration:\n';
    for (const result of layerResults) {
      text += `${result}\n`;
    }

    const failures = layerResults.filter((result) => result.startsWith('WARN'));
    if (failures.length > 0) {
      text += '\n**Note:** Some layers had issues. You may need to adjust them manually in vMix.\n';
    }

    return successResult(text);
  },
});

/**
 * vmix://script/context - Script Generation Context
 * Provides context for generating state-aware VB.NET scripts
 */

import { createResource, textContent, type ResourceContext } from './base.js';
import type { VmixState } from '../state/types.js';

/**
 * Build a human-readable context for script generation
 * Lists all inputs and their fields so scripts can use real names
 */
function buildScriptContext(state: VmixState): string {
  // Build input list
  const inputList = state.inputs
    .map((i) => {
      let line = `- Input ${i.number}: "${i.title}" (${i.type})`;
      if (i.fields && Object.keys(i.fields).length > 0) {
        line += ` [Fields: ${Object.keys(i.fields).join(', ')}]`;
      }
      return line;
    })
    .join('\n');

  // Build title fields list (GT, legacy Title, and XAML titles all carry fields)
  const titleInputs = state.inputs.filter(
    (i) => i.type === 'GT' || i.type === 'Title' || i.type === 'Xaml'
  );
  const fieldsList = titleInputs
    .map((i) => {
      if (!i.fields || Object.keys(i.fields).length === 0) return '';
      const fields = Object.entries(i.fields)
        .map(([k, v]) => `    - ${k}: "${v}"`)
        .join('\n');
      return `"${i.title}":\n${fields}`;
    })
    .filter(Boolean)
    .join('\n');

  return `
## YOUR VMIX SETUP

### Available Inputs
${inputList}

### Title Fields (for SetText)
${fieldsList || 'No GT/Title/XAML title inputs found'}

### Current State
- Program: Input ${state.active}
- Preview: Input ${state.preview}
- Recording: ${state.recording ? 'Yes' : 'No'}
- Streaming: ${state.streaming ? 'Yes' : 'No'}
- FTB: ${state.fadeToBlack ? 'On' : 'Off'}

Use these EXACT input names in your script. Input names are case-sensitive.
`.trim();
}

export const scriptContextResource = createResource({
  name: 'Script Generation Context',
  uri: 'vmix://script/context',
  description: 'Script Generation Context - your vMix setup for state-aware script generation',
  mimeType: 'text/plain',
  handler: async (ctx: ResourceContext) => {
    const state = await ctx.state.getState();
    const context = buildScriptContext(state);

    return {
      contents: [textContent('vmix://script/context', context)],
    };
  },
});

// Export for use in other modules
export { buildScriptContext };

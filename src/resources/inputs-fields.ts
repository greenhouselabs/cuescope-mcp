/**
 * vmix://inputs/fields - Title Fields Across All Inputs
 * Provides title/image fields with stable per-input identity.
 */

import { createResource, jsonContent, type ResourceContext } from './base.js';
import type { VmixInput } from '../state/types.js';

interface InputFieldsEntry {
  number: number;
  key: string;
  title: string;
  type: string;
  fieldNames: string[];
  fields: Record<string, string>;
}

function toInputFieldsEntry(input: VmixInput): InputFieldsEntry {
  const fields = input.fields ?? {};

  return {
    number: input.number,
    key: input.key,
    title: input.title,
    type: input.type,
    fieldNames: Object.keys(fields),
    fields,
  };
}

export const inputsFieldsResource = createResource({
  name: 'vMix Title Fields',
  uri: 'vmix://inputs/fields',
  description:
    'All Title Fields (JSON) - text and image fields from GT/Title inputs with number/key identity',
  mimeType: 'application/json',
  handler: async (ctx: ResourceContext) => {
    const state = await ctx.state.getState();

    const inputs = state.inputs
      .filter((input) => input.fields && Object.keys(input.fields).length > 0)
      .map(toInputFieldsEntry);
    // byTitle keeps only the duplicate-title warning. The full per-input field
    // data lives once in `inputs`; number/key lookups are derivable from there,
    // so byNumber/byKey/fieldsByInput/mergedFields are no longer re-emitted.
    // Built via a Map so user-controlled titles like "__proto__" cannot hit
    // Object.prototype (prototype pollution / broken grouping).
    const byTitleMap = new Map<string, { inputNumbers: number[]; duplicateTitle: boolean }>();

    for (const input of inputs) {
      let titleGroup = byTitleMap.get(input.title);
      if (!titleGroup) {
        titleGroup = { inputNumbers: [], duplicateTitle: false };
        byTitleMap.set(input.title, titleGroup);
      }
      titleGroup.inputNumbers.push(input.number);
    }

    for (const titleGroup of byTitleMap.values()) {
      titleGroup.duplicateTitle = titleGroup.inputNumbers.length > 1;
    }

    // Object.fromEntries defines own data properties, so a "__proto__" title
    // serializes as a normal key.
    const byTitle = Object.fromEntries(byTitleMap);

    return {
      contents: [
        jsonContent('vmix://inputs/fields', {
          count: inputs.length,
          inputs,
          byTitle,
          notes: [
            'Each entry in inputs carries number/key/title/type/fields; index by number or key from there.',
            'byTitle is grouped and can contain duplicate input titles; do not assume a title uniquely identifies an input.',
          ],
        }),
      ],
    };
  },
});

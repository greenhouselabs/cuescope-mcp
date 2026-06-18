/**
 * vmix://state/full - Full vMix XML State
 * Provides the raw XML state from vMix (served through the shared state cache)
 */

import { createResource, xmlContent, type ResourceContext } from './base.js';

/**
 * Size threshold (~512 KB) above which a warning comment is added.
 * The data is never truncated.
 */
export const LARGE_STATE_WARNING_BYTES = 512 * 1024;

const SIZE_WARNING_COMMENT =
  '<!-- WARNING: this state XML is very large; prefer vmix://state/summary for routine checks. -->';

/**
 * Add the size warning without invalidating the document: the comment goes
 * after the XML declaration when one is present (a comment before the
 * declaration would make the XML ill-formed).
 */
function withSizeWarning(xml: string): string {
  const declMatch = /^\s*<\?xml[^>]*\?>/.exec(xml);
  if (declMatch) {
    const decl = declMatch[0];
    return `${decl}\n${SIZE_WARNING_COMMENT}${xml.slice(decl.length)}`;
  }
  return `${SIZE_WARNING_COMMENT}\n${xml}`;
}

export const stateFullResource = createResource({
  name: 'vMix Full XML State',
  uri: 'vmix://state/full',
  description: 'vMix Full XML State - complete raw XML from vMix API',
  mimeType: 'application/xml',
  handler: async (ctx: ResourceContext) => {
    const xml = await ctx.state.getRawXml();
    const text = xml.length > LARGE_STATE_WARNING_BYTES ? withSizeWarning(xml) : xml;

    return {
      contents: [xmlContent('vmix://state/full', text)],
    };
  },
});

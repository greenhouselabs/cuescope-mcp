/**
 * Minimal, dependency-free XML helpers for parsing the .vmix document and the
 * entity-escaped sub-documents (e.g. the per-input Triggers attribute).
 */

/** Decode the entity set vMix uses in attribute-embedded XML. &amp; is decoded last. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#xD;&#xA;/g, '\n')
    .replace(/&#xA;/g, '\n')
    .replace(/&#xD;/g, '')
    .replace(/&#([xX][0-9a-fA-F]+|[0-9]+);/g, decodeNumericEntity)
    .replace(/&amp;/g, '&');
}

/** Generic numeric character reference (&#65; / &#x41;). Invalid code points are left untouched. */
function decodeNumericEntity(match: string, code: string): string {
  const codePoint =
    code[0] === 'x' || code[0] === 'X' ? parseInt(code.slice(1), 16) : parseInt(code, 10);
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return match;
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return match;
  }
}

/** A scanned XML element: raw open tag, raw attribute string, and raw inner content. */
export interface ScannedElement {
  openTag: string;
  attrs: string;
  inner: string;
}

interface OpenTagSpan {
  start: number;
  end: number; // index of the closing '>'
  name: string;
  selfClosing: boolean;
}

/**
 * Find the next open tag for any of the given names at/after `from`, scanning
 * quote-aware: a legal raw '>' inside a double-quoted attribute value (e.g.
 * title="Cam 1 -> Wide") does not terminate the tag, unlike `[^>]*` regexes.
 * Returns null when no further (complete) open tag exists.
 */
function findNextOpenTag(
  scope: string,
  haystack: string,
  needles: string[],
  from: number
): OpenTagSpan | null {
  let best: { start: number; name: string } | null = null;

  for (const name of needles) {
    let idx = from;
    for (;;) {
      idx = haystack.indexOf(`<${name}`, idx);
      if (idx === -1) break;
      const after = haystack[idx + name.length + 1];
      // Require a real tag boundary so `<input` does not match `<inputs`.
      if (after === undefined || after === ' ' || /[\s/>]/.test(after)) break;
      idx += 1;
    }
    if (idx !== -1 && (best === null || idx < best.start)) {
      best = { start: idx, name };
    }
  }

  if (best === null) return null;

  // Scan for the tag-closing '>' while skipping double-quoted attribute values.
  let i = best.start + best.name.length + 1;
  let inQuote = false;
  while (i < scope.length) {
    const ch = scope.charCodeAt(i);
    if (ch === 34 /* " */) {
      inQuote = !inQuote;
    } else if (ch === 62 /* > */ && !inQuote) {
      break;
    }
    i++;
  }
  if (i >= scope.length) return null; // truncated/malformed open tag

  return {
    start: best.start,
    end: i,
    name: best.name,
    selfClosing: !inQuote && scope.charCodeAt(i - 1) === 47 /* / */,
  };
}

/**
 * Quote-aware element scanner shared by the live-state and preset parsers.
 * Iterates `<name …>inner</name>` and self-closing `<name …/>` in document
 * order across one or more element names. Close tags are located with a simple
 * forward search, so same-name nesting is not supported (vMix does not nest
 * same-name elements where this is used).
 */
export function* scanElements(
  scope: string,
  names: string | string[],
  options: { caseInsensitive?: boolean } = {}
): Generator<ScannedElement> {
  const caseInsensitive = options.caseInsensitive ?? false;
  const haystack = caseInsensitive ? scope.toLowerCase() : scope;
  const needles = (Array.isArray(names) ? names : [names]).map((name) =>
    caseInsensitive ? name.toLowerCase() : name
  );

  let pos = 0;
  while (pos < scope.length) {
    const tag = findNextOpenTag(scope, haystack, needles, pos);
    if (tag === null) break;

    const openTag = scope.slice(tag.start, tag.end + 1);
    const attrsEnd = tag.selfClosing ? tag.end - 1 : tag.end;
    const attrs = scope.slice(tag.start + tag.name.length + 1, attrsEnd).trim();

    if (tag.selfClosing) {
      yield { openTag, attrs, inner: '' };
      pos = tag.end + 1;
      continue;
    }

    const closeTag = `</${tag.name}>`;
    const closeIdx = haystack.indexOf(closeTag, tag.end + 1);
    if (closeIdx === -1) {
      // Unclosed element — treat as empty and continue after the open tag.
      yield { openTag, attrs, inner: '' };
      pos = tag.end + 1;
      continue;
    }

    yield { openTag, attrs, inner: scope.slice(tag.end + 1, closeIdx) };
    pos = closeIdx + closeTag.length;
  }
}

/**
 * Quote-aware iteration over open tags only (inner content is never consumed),
 * for callers that read attributes off every `<name …>` occurrence, including
 * nested ones.
 */
export function* scanOpenTags(scope: string, name: string): Generator<string> {
  let pos = 0;
  while (pos < scope.length) {
    const tag = findNextOpenTag(scope, scope, [name], pos);
    if (tag === null) break;
    yield scope.slice(tag.start, tag.end + 1);
    pos = tag.end + 1;
  }
}

/** Inner content of the first <tag>…</tag>, or '' if absent. */
export function getSection(xml: string, tag: string): string {
  for (const element of scanElements(xml, tag)) {
    return element.inner;
  }
  return '';
}

/** Iterate <name …>inner</name> and self-closing <name …/> within a scope. */
export function* elements(scope: string, name: string): Generator<{ openTag: string; inner: string }> {
  for (const element of scanElements(scope, name)) {
    yield { openTag: element.openTag, inner: element.inner };
  }
}

/** Read a (decoded) attribute value from an open tag, or null. */
export function attrValue(openTag: string, name: string): string | null {
  const m = openTag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`));
  return m ? decodeEntities(m[1]!) : null;
}

/** Text of the first child <tag>…</tag>, decoded; '' if absent. */
export function textOf(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? decodeEntities(m[1]!) : '';
}

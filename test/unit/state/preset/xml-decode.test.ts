import { describe, it, expect } from 'vitest';
import {
  decodeEntities,
  getSection,
  elements,
  scanElements,
  scanOpenTags,
  attrValue,
  textOf,
} from '../../../../src/state/preset/xml-decode.js';

describe('decodeEntities', () => {
  it('decodes the escaped-attribute entity set including CRLF and amp last', () => {
    const raw = '&lt;A b=&quot;1&quot;&gt;x &amp;amp; y&#xD;&#xA;z&lt;/A&gt;';
    expect(decodeEntities(raw)).toBe('<A b="1">x &amp; y\nz</A>');
  });

  it('decodes generic decimal and hex numeric entities', () => {
    expect(decodeEntities('&#65;&#66;')).toBe('AB');
    expect(decodeEntities('&#x41;&#X42;')).toBe('AB');
    expect(decodeEntities('caf&#233;')).toBe('café');
    expect(decodeEntities('&#x1F600;')).toBe('\u{1F600}');
  });

  it('decodes numeric entities before &amp; so double-escaping survives', () => {
    expect(decodeEntities('&amp;#65;')).toBe('&#65;');
  });

  it('leaves invalid numeric references untouched', () => {
    expect(decodeEntities('&#xZZ;')).toBe('&#xZZ;');
    expect(decodeEntities('&#1114112;')).toBe('&#1114112;'); // beyond U+10FFFF
  });
});

describe('extractors', () => {
  const xml = '<Root><Item a="1">hello</Item><Item a="2"/></Root>';
  it('getSection returns inner content', () => {
    expect(getSection(xml, 'Root')).toContain('<Item a="1">hello</Item>');
  });
  it('elements iterates open tag + inner, including self-closing', () => {
    const got = [...elements(xml, 'Item')];
    expect(got).toHaveLength(2);
    expect(attrValue(got[0]!.openTag, 'a')).toBe('1');
    expect(got[0]!.inner).toBe('hello');
    expect(got[1]!.inner).toBe('');
  });
  it('textOf reads a child element text', () => {
    expect(textOf('<x><Name>Bob</Name></x>', 'Name')).toBe('Bob');
    expect(textOf('<x/>', 'Name')).toBe('');
  });
});

describe('quote-aware scanning', () => {
  it('elements tolerates a legal raw ">" inside an attribute value', () => {
    const xml = '<Root><Item a="x > y">v</Item><Item a="2"/></Root>';
    const got = [...elements(xml, 'Item')];
    expect(got).toHaveLength(2);
    expect(attrValue(got[0]!.openTag, 'a')).toBe('x > y');
    expect(got[0]!.inner).toBe('v');
  });

  it('getSection tolerates raw ">" in section open-tag attributes', () => {
    const xml = '<Root note="a > b"><Item>v</Item></Root>';
    expect(getSection(xml, 'Root')).toBe('<Item>v</Item>');
  });

  it('scanOpenTags yields every open tag including nested ones', () => {
    const xml = '<Input Title="Outer -> A"><Overlays><Input Number="2" /></Overlays></Input>';
    const tags = [...scanOpenTags(xml, 'Input')];
    expect(tags).toHaveLength(2);
    expect(attrValue(tags[0]!, 'Title')).toBe('Outer -> A');
    expect(attrValue(tags[1]!, 'Number')).toBe('2');
  });

  it('scanElements does not match longer tag names sharing a prefix', () => {
    const xml = '<inputs><input number="1">x</input></inputs>';
    const got = [...scanElements(xml, 'input')];
    expect(got).toHaveLength(1);
    expect(got[0]!.attrs).toBe('number="1"');
    expect(got[0]!.inner).toBe('x');
  });

  it('scanElements stops cleanly on a truncated open tag', () => {
    const got = [...scanElements('<Item a="1">ok</Item><Item b="unterminated', 'Item')];
    expect(got).toHaveLength(1);
    expect(got[0]!.inner).toBe('ok');
  });

  it('scanElements treats an unclosed element as empty and continues', () => {
    const got = [...scanElements('<Item a="1"><Item a="2">v</Item>', 'Item')];
    expect(got.length).toBeGreaterThanOrEqual(1);
  });
});

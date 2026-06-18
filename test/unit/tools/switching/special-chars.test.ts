/**
 * End-to-end state edge case: an input whose title contains XML entities
 * (&amp;) and unicode must flow from raw vMix XML, through the parser, into
 * the resolver, and out as an API call that uses the input KEY.
 */

import { describe, it, expect } from 'vitest';
import { parseVmixState } from '../../../../src/state/parser.js';
import { cutTool } from '../../../../src/tools/switching/cut.js';
import { previewTool } from '../../../../src/tools/switching/preview.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

const SPECIAL_KEY = 'a1b2c3d4-1111-2222-3333-444455556666';
const DECODED_TITLE = 'Q&A — Übersicht 🎥';

// Real vMix XML: title attribute is entity-encoded, key has no braces.
const XML = `<?xml version="1.0" encoding="utf-8"?>
<vmix>
  <version>29.0.0.0</version>
  <edition>4K</edition>
  <inputs>
    <input key="${SPECIAL_KEY}" number="1" type="Capture" title="Q&amp;A — Übersicht 🎥" state="Running" position="0" duration="0" muted="False" loop="False" audiobusses="M"></input>
    <input key="b2c3d4e5-1111-2222-3333-444455556666" number="2" type="Capture" title="Camera 2" state="Running" position="0" duration="0" muted="False" loop="False" audiobusses="M"></input>
  </inputs>
  <overlays>
    <overlay number="1"/>
    <overlay number="2"/>
    <overlay number="3"/>
    <overlay number="4"/>
  </overlays>
  <preview>2</preview>
  <active>1</active>
  <fadeToBlack>False</fadeToBlack>
  <recording>False</recording>
  <streaming>False</streaming>
  <external>False</external>
  <audio>
    <master volume="100" muted="False"/>
  </audio>
</vmix>`;

function contextWithSpecialState() {
  const ctx = createMockToolContext();
  const parsed = parseVmixState(XML);
  ctx.state._setState(parsed);
  return { ctx, parsed };
}

describe('special characters in input titles (tool end-to-end)', () => {
  it('parser decodes &amp; and preserves unicode in the title', () => {
    const { parsed } = contextWithSpecialState();
    expect(parsed.inputs[0]?.title).toBe(DECODED_TITLE);
    expect(parsed.inputs[0]?.key).toBe(SPECIAL_KEY);
  });

  it('cut resolves the DECODED title and executes with the input key', async () => {
    const { ctx } = contextWithSpecialState();

    const result = await cutTool.handler({ input: DECODED_TITLE }, ctx);

    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('Cut', {
      Input: SPECIAL_KEY,
      Mix: undefined,
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain(DECODED_TITLE);
  });

  it('the raw ENCODED title (with &amp;) does not match — names are exact post-decode', async () => {
    const { ctx } = contextWithSpecialState();

    const result = await cutTool.handler({ input: 'Q&amp;A — Übersicht 🎥' }, ctx);

    expect(result.isError).toBe(true);
    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
  });

  it('resolves the same input by braced GUID reference', async () => {
    const { ctx } = contextWithSpecialState();

    await previewTool.handler({ input: `{${SPECIAL_KEY}}` }, ctx);

    const call = ctx.vmix.http._getExecutedCalls()[0]!;
    expect(call.params?.['Input']).toBe(SPECIAL_KEY);
  });

  it('resolves the special-title input by number and executes with its key', async () => {
    const { ctx } = contextWithSpecialState();

    await cutTool.handler({ input: 1 }, ctx);

    expect(ctx.vmix.http.execute).toHaveBeenCalledWith('Cut', {
      Input: SPECIAL_KEY,
      Mix: undefined,
    });
  });
});

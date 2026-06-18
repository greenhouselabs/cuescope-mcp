/**
 * Tests for vmix://state/full resource
 */

import { describe, expect, it } from 'vitest';
import {
  stateFullResource,
  LARGE_STATE_WARNING_BYTES,
} from '../../../src/resources/state-full.js';
import { createMockStateCache } from '../../mocks/tool-context.mock.js';
import { createMockVmixClient } from '../../mocks/vmix-client.mock.js';
import { createTestConfig } from '../../../src/config/index.js';
import type { ResourceContext } from '../../../src/resources/base.js';

function createContext(): ResourceContext & {
  state: ReturnType<typeof createMockStateCache>;
  vmix: ReturnType<typeof createMockVmixClient>;
} {
  return {
    state: createMockStateCache(),
    vmix: createMockVmixClient(),
    config: createTestConfig(),
  };
}

describe('vmix://state/full', () => {
  it('has correct URI and metadata', () => {
    expect(stateFullResource.uri).toBe('vmix://state/full');
    expect(stateFullResource.name).toBe('vMix Full XML State');
    expect(stateFullResource.mimeType).toBe('application/xml');
  });

  it('serves XML through the state cache, not a direct HTTP call', async () => {
    const ctx = createContext();
    const result = await stateFullResource.handler(ctx);

    expect(ctx.state.getRawXml).toHaveBeenCalledTimes(1);
    expect(ctx.vmix.http.getState).not.toHaveBeenCalled();
    expect(result.contents[0]?.mimeType).toBe('application/xml');
    expect(result.contents[0]?.text).toBe('<vmix>...</vmix>');
  });

  it('does not add a warning for normal-sized state', async () => {
    const ctx = createContext();
    const result = await stateFullResource.handler(ctx);
    expect(result.contents[0]?.text).not.toContain('WARNING');
  });

  it('prepends a one-line warning (without truncating) when the XML exceeds the size threshold', async () => {
    const ctx = createContext();
    const bigBody = `<vmix>${'x'.repeat(LARGE_STATE_WARNING_BYTES)}</vmix>`;
    const bigXml = `<?xml version="1.0" encoding="utf-8"?>\n${bigBody}`;
    ctx.state.getRawXml = async () => bigXml;

    const result = await stateFullResource.handler(ctx);
    const text = result.contents[0]?.text ?? '';

    expect(text).toContain('WARNING');
    expect(text).toContain('vmix://state/summary');
    // Comment must come after the XML declaration to keep the document well-formed
    expect(text.indexOf('<!--')).toBeGreaterThan(text.indexOf('?>'));
    // Data is not truncated
    expect(text).toContain(bigBody);
  });

  it('prepends the warning when there is no XML declaration', async () => {
    const ctx = createContext();
    const bigXml = `<vmix>${'x'.repeat(LARGE_STATE_WARNING_BYTES)}</vmix>`;
    ctx.state.getRawXml = async () => bigXml;

    const result = await stateFullResource.handler(ctx);
    const text = result.contents[0]?.text ?? '';

    expect(text.startsWith('<!--')).toBe(true);
    expect(text).toContain(bigXml);
  });
});

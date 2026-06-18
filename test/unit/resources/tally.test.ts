/**
 * Tests for the vmix://tally resource
 */

import { describe, expect, it } from 'vitest';
import { tallyResource } from '../../../src/resources/tally.js';
import { createMockStateCache } from '../../mocks/tool-context.mock.js';
import { createMockVmixClient, type MockVmixClient } from '../../mocks/vmix-client.mock.js';
import { createTestConfig } from '../../../src/config/index.js';
import type { ResourceContext } from '../../../src/resources/base.js';

function ctxWith(vmix: MockVmixClient): ResourceContext {
  return {
    state: createMockStateCache({
      active: 2,
      preview: 1,
    }),
    vmix,
    config: createTestConfig(),
  };
}

describe('vmix://tally resource', () => {
  it('decodes the latest tally frame into program/preview inputs', async () => {
    const vmix = createMockVmixClient();
    vmix.tcp?._setConnected(true);
    vmix.tcp?._emitTally('0120'); // input 2 = program, input 3 = preview
    const result = await tallyResource.handler(ctxWith(vmix));
    const data = JSON.parse(result.contents[0]?.text ?? '{}');
    expect(data.available).toBe(true);
    expect(data.program).toEqual([2]);
    expect(data.preview).toEqual([3]);
    expect(data.httpProgram).toBe(2);
    expect(data.httpPreview).toBe(1);
    expect(data.semantics.tcpTally).toContain('last TCP tally frame');
    expect(data.semantics.httpState).toContain('single Preview input');
    expect(data.inputs).toHaveLength(4);
  });

  it('includes receivedAt, ageMs, and a fresh (non-stale) flag while connected', async () => {
    const vmix = createMockVmixClient();
    vmix.tcp?._setConnected(true);
    const before = Date.now();
    vmix.tcp?._emitTally('012');
    const result = await tallyResource.handler(ctxWith(vmix));
    const data = JSON.parse(result.contents[0]?.text ?? '{}');

    expect(data.available).toBe(true);
    expect(data.stale).toBe(false);
    expect(data.staleReason).toBeUndefined();
    expect(data.tcpStatus).toBe('connected');
    expect(typeof data.ageMs).toBe('number');
    expect(data.ageMs).toBeGreaterThanOrEqual(0);
    expect(new Date(data.receivedAt).getTime()).toBeGreaterThanOrEqual(before);
    expect(data.pollOnly).toMatch(/poll-only/i);
    expect(data.semantics.age).toContain('not marked stale');
  });

  it('reports stale with a reason when the connection dropped after the frame', async () => {
    const vmix = createMockVmixClient();
    vmix.tcp?._setConnected(true);
    vmix.tcp?._emitTally('012');
    vmix.tcp?._setConnected(false);
    vmix.tcp?._setTallyStale(true);

    const result = await tallyResource.handler(ctxWith(vmix));
    const data = JSON.parse(result.contents[0]?.text ?? '{}');

    expect(data.available).toBe(true);
    expect(data.stale).toBe(true);
    expect(data.staleReason).toMatch(/connection dropped/i);
    expect(data.tcpConnected).toBe(false);
  });

  it('reports stale when disconnected even if no disconnect flag was set', async () => {
    const vmix = createMockVmixClient();
    vmix.tcp?._setConnected(true);
    vmix.tcp?._emitTally('012');
    vmix.tcp?._setConnected(false); // disconnected, tallyStale not flagged

    const result = await tallyResource.handler(ctxWith(vmix));
    const data = JSON.parse(result.contents[0]?.text ?? '{}');

    expect(data.available).toBe(true);
    expect(data.stale).toBe(true);
    expect(data.staleReason).toMatch(/not connected/i);
  });

  it('reports unavailable when TCP is disabled', async () => {
    const vmix = createMockVmixClient({ tcpEnabled: false });
    const result = await tallyResource.handler(ctxWith(vmix));
    const data = JSON.parse(result.contents[0]?.text ?? '{}');
    expect(data.available).toBe(false);
    expect(data.reason).toMatch(/TCP is disabled/i);
  });

  it('reports unavailable when no tally frame has arrived yet', async () => {
    const vmix = createMockVmixClient();
    const result = await tallyResource.handler(ctxWith(vmix));
    const data = JSON.parse(result.contents[0]?.text ?? '{}');
    expect(data.available).toBe(false);
    expect(data.reason).toMatch(/No tally frame/i);
  });
});

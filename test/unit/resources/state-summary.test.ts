/**
 * Tests for vmix://state/summary resource
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { stateSummaryResource } from '../../../src/resources/state-summary.js';
import { createMockStateCache } from '../../mocks/tool-context.mock.js';
import { createMockVmixClient } from '../../mocks/vmix-client.mock.js';
import { createTestConfig } from '../../../src/config/index.js';
import type { ResourceContext } from '../../../src/resources/base.js';

describe('vmix://state/summary', () => {
  let ctx: ResourceContext;

  beforeEach(() => {
    ctx = {
      state: createMockStateCache(),
      vmix: createMockVmixClient(),
      config: createTestConfig(),
    };
  });

  it('has correct URI', () => {
    expect(stateSummaryResource.uri).toBe('vmix://state/summary');
  });

  it('returns JSON content type', async () => {
    const result = await stateSummaryResource.handler(ctx);

    expect(result.contents[0]?.mimeType).toBe('application/json');
  });

  it('includes version and edition', async () => {
    const result = await stateSummaryResource.handler(ctx);
    const data = JSON.parse(result.contents[0]?.text ?? '{}');

    expect(data.version).toBe('29.0.0.0');
    expect(data.edition).toBe('4K Plus');
  });

  it('includes active and preview inputs', async () => {
    const result = await stateSummaryResource.handler(ctx);
    const data = JSON.parse(result.contents[0]?.text ?? '{}');

    expect(data.active).toBe(1);
    expect(data.preview).toBe(2);
  });

  it('includes recording and streaming status', async () => {
    const result = await stateSummaryResource.handler(ctx);
    const data = JSON.parse(result.contents[0]?.text ?? '{}');

    expect(data.recording).toBe(false);
    expect(data.streaming).toBe(false);
  });

  it('includes input count', async () => {
    const result = await stateSummaryResource.handler(ctx);
    const data = JSON.parse(result.contents[0]?.text ?? '{}');

    expect(data.inputCount).toBe(2);
  });

  it('includes fadeToBlack status', async () => {
    const result = await stateSummaryResource.handler(ctx);
    const data = JSON.parse(result.contents[0]?.text ?? '{}');

    expect(data.fadeToBlack).toBe(false);
  });
});

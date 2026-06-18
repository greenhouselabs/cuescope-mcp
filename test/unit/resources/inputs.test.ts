/**
 * Tests for vmix://inputs resource
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { inputsResource } from '../../../src/resources/inputs.js';
import { createMockStateCache } from '../../mocks/tool-context.mock.js';
import { createMockVmixClient } from '../../mocks/vmix-client.mock.js';
import { createTestConfig } from '../../../src/config/index.js';
import type { ResourceContext } from '../../../src/resources/base.js';

describe('vmix://inputs', () => {
  let ctx: ResourceContext;

  beforeEach(() => {
    ctx = {
      state: createMockStateCache(),
      vmix: createMockVmixClient(),
      config: createTestConfig(),
    };
  });

  it('has correct URI', () => {
    expect(inputsResource.uri).toBe('vmix://inputs');
  });

  it('returns JSON content type', async () => {
    const result = await inputsResource.handler(ctx);

    expect(result.contents[0]?.mimeType).toBe('application/json');
  });

  it('returns array of inputs', async () => {
    const result = await inputsResource.handler(ctx);
    const data = JSON.parse(result.contents[0]?.text ?? '[]');

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
  });

  it('includes input properties', async () => {
    const result = await inputsResource.handler(ctx);
    const data = JSON.parse(result.contents[0]?.text ?? '[]');

    const firstInput = data[0];
    expect(firstInput).toHaveProperty('number');
    expect(firstInput).toHaveProperty('title');
    expect(firstInput).toHaveProperty('type');
    expect(firstInput).toHaveProperty('state');
  });

  it('includes audio information', async () => {
    const result = await inputsResource.handler(ctx);
    const data = JSON.parse(result.contents[0]?.text ?? '[]');

    const firstInput = data[0];
    expect(firstInput).toHaveProperty('muted');
    expect(firstInput).toHaveProperty('audioBuses');
    expect(firstInput).toHaveProperty('audioBusList');
  });

  it('includes normalized rich input fields', async () => {
    const result = await inputsResource.handler(ctx);
    const data = JSON.parse(result.contents[0]?.text ?? '[]');

    const firstInput = data[0];
    expect(firstInput).toHaveProperty('selectedIndex');
    expect(firstInput).toHaveProperty('meters');
    expect(firstInput).toHaveProperty('layerCount');
  });

  it('indicates if input has fields', async () => {
    const result = await inputsResource.handler(ctx);
    const data = JSON.parse(result.contents[0]?.text ?? '[]');

    // At least one input should have hasFields property
    expect(data[0]).toHaveProperty('hasFields');
  });
});

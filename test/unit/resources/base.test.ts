/**
 * Tests for MCP resource registration helpers
 */

import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createTestConfig } from '../../../src/config/index.js';
import {
  createResource,
  registerResource,
  type ResourceContext,
} from '../../../src/resources/base.js';
import { createMockStateCache } from '../../mocks/tool-context.mock.js';
import { createMockVmixClient } from '../../mocks/vmix-client.mock.js';

function createContext(): ResourceContext {
  return {
    state: createMockStateCache(),
    vmix: createMockVmixClient(),
    config: createTestConfig(),
  };
}

describe('registerResource', () => {
  it('registers via registerResource with name, URI, and metadata', async () => {
    const server = {
      registerResource: vi.fn(),
    } as unknown as McpServer;
    const result = {
      contents: [
        {
          uri: 'vmix://test/resource',
          mimeType: 'application/json',
          text: '{"ok":true}',
        },
      ],
    };
    const resource = createResource({
      name: 'Test Resource',
      uri: 'vmix://test/resource',
      description: 'Test resource',
      mimeType: 'application/json',
      handler: vi.fn().mockResolvedValue(result),
    });

    registerResource(server, resource, createContext());

    expect(server.registerResource).toHaveBeenCalledTimes(1);
    const call = (vi.mocked(server.registerResource).mock.calls[0] ?? []) as unknown[];
    const [name, uri, metadata, handler] = call;

    expect(name).toBe('Test Resource');
    expect(uri).toBe('vmix://test/resource');
    expect(metadata).toEqual({
      title: 'Test Resource',
      description: 'Test resource',
      mimeType: 'application/json',
    });
    await expect((handler as () => Promise<unknown>)()).resolves.toEqual(result);
  });

  it('passes an explicit title through to the metadata', () => {
    const server = {
      registerResource: vi.fn(),
    } as unknown as McpServer;
    const resource = createResource({
      name: 'Test Resource',
      title: 'A Friendlier Title',
      uri: 'vmix://test/resource',
      description: 'Test resource',
      mimeType: 'text/markdown',
      handler: vi.fn().mockResolvedValue({ contents: [] }),
    });

    registerResource(server, resource, createContext());

    const call = (vi.mocked(server.registerResource).mock.calls[0] ?? []) as unknown[];
    const metadata = call[2];
    expect(metadata).toEqual({
      title: 'A Friendlier Title',
      description: 'Test resource',
      mimeType: 'text/markdown',
    });
  });
});

describe('resource definitions', () => {
  it('gives every resource a short stable name and a mimeType', async () => {
    const { allResources } = await import('../../../src/resources/index.js');
    for (const resource of allResources) {
      expect(resource.name, resource.uri).toBeTruthy();
      expect(resource.name.length, resource.uri).toBeLessThan(60);
      expect(resource.mimeType, resource.uri).toMatch(/^(application|text)\//);
    }
    // Names must be unique - the MCP client uses them as identifiers
    const names = allResources.map((resource) => resource.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

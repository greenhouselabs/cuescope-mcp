/**
 * Mock unified vMix client for testing
 */

import { vi } from 'vitest';
import type { IVmixClient } from '../../src/clients/types.js';
import { createMockHttpClient, createBasicStateXml } from './http-client.mock.js';
import { createMockTcpClient } from './tcp-client.mock.js';
import { normalizeInput } from '../../src/utils/index.js';

export type MockVmixClient = IVmixClient & {
  http: ReturnType<typeof createMockHttpClient>;
  tcp: ReturnType<typeof createMockTcpClient> | null;
  _setStateXml: (xml: string) => void;
};

/**
 * Create a mock unified vMix client
 */
export function createMockVmixClient(options: {
  tcpEnabled?: boolean;
} = {}): MockVmixClient {
  const httpClient = createMockHttpClient();
  const tcpClient = options.tcpEnabled !== false ? createMockTcpClient() : null;

  const mock: MockVmixClient = {
    http: httpClient,
    tcp: tcpClient,
    connected: true,

    connect: vi.fn(async () => {
      httpClient._setConnected(true);
      if (tcpClient) {
        tcpClient._setConnected(true);
      }
    }),

    disconnect: vi.fn(() => {
      httpClient._setConnected(false);
      if (tcpClient) {
        tcpClient.disconnect();
      }
    }),

    normalizeInput: vi.fn((input) => normalizeInput(input)),

    _setStateXml: (xml: string) => {
      httpClient._setStateXml(xml);
    },
  };

  return mock;
}

// Re-export for convenience
export { createMockHttpClient, createMockTcpClient, createBasicStateXml };

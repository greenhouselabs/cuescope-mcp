/**
 * Tests for state cache
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StateCache } from '../../../src/state/cache.js';
import { createMockHttpClient, createBasicStateXml } from '../../mocks/index.js';
import type { IVmixHttpClient } from '../../../src/clients/types.js';

/**
 * HTTP client whose getState() calls resolve only when the test says so,
 * for driving concurrency/race scenarios deterministically.
 */
function createDeferredHttpClient(): {
  client: IVmixHttpClient;
  getState: ReturnType<typeof vi.fn>;
  resolvers: Array<(xml: string) => void>;
} {
  const resolvers: Array<(xml: string) => void> = [];
  const getState = vi.fn(
    () =>
      new Promise<string>((resolve) => {
        resolvers.push(resolve);
      })
  );

  const client: IVmixHttpClient = {
    baseUrl: 'http://localhost:8088/api',
    execute: vi.fn(async () => undefined),
    isConnected: vi.fn(async () => true),
    getState: getState as unknown as IVmixHttpClient['getState'],
  };

  return { client, getState, resolvers };
}

describe('StateCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getState', () => {
    it('fetches state on first call', async () => {
      const httpClient = createMockHttpClient();
      const cache = new StateCache(httpClient);

      const state = await cache.getState();

      expect(httpClient.getState).toHaveBeenCalledTimes(1);
      expect(state.version).toBeDefined();
    });

    it('returns cached state within TTL', async () => {
      const httpClient = createMockHttpClient();
      const cache = new StateCache(httpClient, { ttlMs: 100 });

      await cache.getState();
      vi.advanceTimersByTime(50); // 50ms later
      await cache.getState();

      expect(httpClient.getState).toHaveBeenCalledTimes(1);
    });

    it('fetches fresh state after TTL expires', async () => {
      const httpClient = createMockHttpClient();
      const cache = new StateCache(httpClient, { ttlMs: 100 });

      await cache.getState();
      vi.advanceTimersByTime(150); // 150ms later
      await cache.getState();

      expect(httpClient.getState).toHaveBeenCalledTimes(2);
    });

    it('parses XML to state object', async () => {
      const httpClient = createMockHttpClient();
      httpClient._setStateXml(
        createBasicStateXml({
          active: 3,
          preview: 1,
          inputs: [
            { number: 1, title: 'Test Input', type: 'Video' },
          ],
        })
      );

      const cache = new StateCache(httpClient);
      const state = await cache.getState();

      expect(state.active).toBe(3);
      expect(state.preview).toBe(1);
      expect(state.inputs[0]?.title).toBe('Test Input');
    });
  });

  describe('getRawXml', () => {
    it('returns raw XML', async () => {
      const httpClient = createMockHttpClient();
      const xml = createBasicStateXml();
      httpClient._setStateXml(xml);

      const cache = new StateCache(httpClient);
      const result = await cache.getRawXml();

      expect(result).toBe(xml);
    });

    it('shares cache with getState', async () => {
      const httpClient = createMockHttpClient();
      const cache = new StateCache(httpClient, { ttlMs: 100 });

      await cache.getState();
      await cache.getRawXml();

      // Should only fetch once
      expect(httpClient.getState).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidate', () => {
    it('forces fresh fetch on next call', async () => {
      const httpClient = createMockHttpClient();
      const cache = new StateCache(httpClient, { ttlMs: 100 });

      await cache.getState();
      cache.invalidate();
      await cache.getState();

      expect(httpClient.getState).toHaveBeenCalledTimes(2);
    });
  });

  describe('concurrency', () => {
    it('shares a single in-flight fetch across concurrent callers', async () => {
      const { client, getState, resolvers } = createDeferredHttpClient();
      const cache = new StateCache(client, { ttlMs: 100, logLevel: 'error' });

      const p1 = cache.getState();
      const p2 = cache.getState();
      const p3 = cache.getRawXml();

      // All three callers arrived while the cache was stale; only one
      // request must go to vMix.
      expect(getState).toHaveBeenCalledTimes(1);

      resolvers[0]!(createBasicStateXml({ active: 5 }));

      const [s1, s2, xml] = await Promise.all([p1, p2, p3]);
      expect(s1.active).toBe(5);
      expect(s2.active).toBe(5);
      expect(xml).toContain('<active>5</active>');
      expect(getState).toHaveBeenCalledTimes(1);
    });

    it('does not let an older slow fetch overwrite newer data', async () => {
      const { client, resolvers } = createDeferredHttpClient();
      const cache = new StateCache(client, { ttlMs: 100, logLevel: 'error' });

      // Fetch A starts and hangs
      const oldCall = cache.getState();

      // Invalidation detaches fetch A; fetch B starts
      cache.invalidate();
      const newCall = cache.getState();

      // Fetch B (newer) completes first
      resolvers[1]!(createBasicStateXml({ active: 2 }));
      const newState = await newCall;
      expect(newState.active).toBe(2);

      // Fetch A (older) completes late with outdated data
      resolvers[0]!(createBasicStateXml({ active: 1 }));
      await oldCall;

      // Within TTL the cache must still hold fetch B's data
      const state = await cache.getState();
      expect(state.active).toBe(2);
    });

    it('propagates a fetch failure to all concurrent callers and recovers afterwards', async () => {
      const httpClient = createMockHttpClient();
      httpClient._simulateError(new Error('vMix unreachable'));
      const cache = new StateCache(httpClient, { ttlMs: 100, logLevel: 'error' });

      const p1 = cache.getState();
      const p2 = cache.getState();

      await expect(p1).rejects.toThrow('vMix unreachable');
      await expect(p2).rejects.toThrow('vMix unreachable');

      // A later call must retry rather than being stuck on the failed fetch
      httpClient._simulateError(null as unknown as Error);
      httpClient._setStateXml(createBasicStateXml({ active: 4 }));
      const state = await cache.getState();
      expect(state.active).toBe(4);
    });
  });
});

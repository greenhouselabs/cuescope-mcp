/**
 * Tests for HTTP client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VmixHttpClient } from '../../../src/clients/http-client.js';
import { ConnectionError, CommandError, TimeoutError } from '../../../src/errors/index.js';

describe('VmixHttpClient', () => {
  let client: VmixHttpClient;
  const mockFetch = vi.fn();

  beforeEach(() => {
    // Replace global fetch
    vi.stubGlobal('fetch', mockFetch);
    client = new VmixHttpClient({ host: 'localhost', port: 8088, logLevel: 'error' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('baseUrl', () => {
    it('returns correct URL', () => {
      expect(client.baseUrl).toBe('http://localhost:8088/api');
    });

    it('uses configured host and port', () => {
      const customClient = new VmixHttpClient({ host: '192.168.1.100', port: 9088 });
      expect(customClient.baseUrl).toBe('http://192.168.1.100:9088/api');
    });
  });

  describe('execute', () => {
    it('sends correct request for simple function', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await client.execute('Cut', { Input: '1' });

      const url = mockFetch.mock.calls[0]?.[0] as string;
      expect(url).toContain('Function=Cut');
      expect(url).toContain('Input=1');
    });

    it('passes an abort signal so timeouts cancel the request', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await client.execute('Cut', { Input: '1' });

      const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('omits undefined parameters', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await client.execute('Fade', { Input: '1', Duration: undefined });

      const url = mockFetch.mock.calls[0]?.[0] as string;
      expect(url).toContain('Input=1');
      expect(url).not.toContain('Duration');
    });

    it('throws CommandError on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad request'),
      });

      await expect(client.execute('Invalid', {})).rejects.toThrow(CommandError);
    });

    it('throws ConnectionError on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      await expect(client.execute('Cut', {})).rejects.toThrow(ConnectionError);
    });

    it('includes the system error code from error.cause in ConnectionError', async () => {
      const networkError = new TypeError('fetch failed');
      (networkError as TypeError & { cause?: unknown }).cause = { code: 'ECONNREFUSED' };
      mockFetch.mockRejectedValueOnce(networkError);

      await expect(client.execute('Cut', {})).rejects.toThrow(/ECONNREFUSED/);
    });

    it('treats TypeErrors without "fetch" in the message as connection errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('terminated'));

      await expect(client.execute('Cut', {})).rejects.toThrow(ConnectionError);
    });

    it('throws TimeoutError (not CommandError) and aborts the request on timeout', async () => {
      vi.useFakeTimers();

      let requestSignal: AbortSignal | undefined;
      mockFetch.mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) => {
            requestSignal = init.signal ?? undefined;
            init.signal?.addEventListener('abort', () => {
              reject(new Error('This operation was aborted'));
            });
          })
      );

      const fastClient = new VmixHttpClient({
        host: 'localhost',
        port: 8088,
        timeout: 1000,
        logLevel: 'error',
      });

      const promise = fastClient.execute('Cut', { Input: '1' });
      const expectation = expect(promise).rejects.toMatchObject({
        name: 'TimeoutError',
        code: 'TIMEOUT_ERROR',
        timeoutMs: 1000,
      });

      await vi.advanceTimersByTimeAsync(1000);
      await expectation;

      // The underlying fetch must actually be aborted, not left running
      expect(requestSignal?.aborted).toBe(true);
    });
  });

  describe('getState', () => {
    it('returns XML state', async () => {
      const mockXml = '<vmix><version>29.0</version></vmix>';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockXml),
      });

      const result = await client.getState();

      expect(result).toBe(mockXml);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8088/api',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('throws ConnectionError on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(client.getState()).rejects.toThrow(ConnectionError);
    });

    it('throws TimeoutError on timeout', async () => {
      vi.useFakeTimers();

      mockFetch.mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) => {
            init.signal?.addEventListener('abort', () => {
              reject(new Error('This operation was aborted'));
            });
          })
      );

      const fastClient = new VmixHttpClient({
        host: 'localhost',
        port: 8088,
        timeout: 500,
        logLevel: 'error',
      });

      const promise = fastClient.getState();
      const expectation = expect(promise).rejects.toBeInstanceOf(TimeoutError);

      await vi.advanceTimersByTimeAsync(500);
      await expectation;
    });
  });

  describe('isConnected', () => {
    it('returns true when vMix responds', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await client.isConnected();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8088/api',
        expect.objectContaining({ method: 'GET', signal: expect.any(AbortSignal) })
      );
    });

    it('returns false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.isConnected();

      expect(result).toBe(false);
    });

    it('returns false on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

      const result = await client.isConnected();

      expect(result).toBe(false);
    });

    it('returns false on timeout', async () => {
      vi.useFakeTimers();

      mockFetch.mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) => {
            init.signal?.addEventListener('abort', () => {
              reject(new Error('This operation was aborted'));
            });
          })
      );

      const promise = client.isConnected();
      await vi.advanceTimersByTimeAsync(5000);

      await expect(promise).resolves.toBe(false);
    });
  });
});

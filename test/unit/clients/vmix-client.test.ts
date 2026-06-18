/**
 * Tests for unified vMix client
 *
 * The net layer is mocked so no real sockets are opened: every TCP connect
 * attempt fails asynchronously, as if vMix's TCP port (8099) were closed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VmixClient } from '../../../src/clients/vmix-client.js';
import { ConnectionError } from '../../../src/errors/index.js';

vi.mock('net', async () => {
  const { EventEmitter } = await import('node:events');

  class RefusingSocket extends EventEmitter {
    writable = false;
    destroyed = false;

    connect(_port: number, _host: string): void {
      // Simulate a refused connection (vMix TCP port closed)
      queueMicrotask(() => {
        this.emit('error', new Error('connect ECONNREFUSED 127.0.0.1:8099'));
        this.destroy();
      });
    }

    destroy(): void {
      if (this.destroyed) {
        return;
      }
      this.destroyed = true;
      this.writable = false;
      queueMicrotask(() => this.emit('close'));
    }

    write(_data: string, cb?: (err?: Error) => void): boolean {
      cb?.(new Error('not connected'));
      return false;
    }
  }

  return { Socket: RefusingSocket };
});

describe('VmixClient', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates HTTP and TCP clients by default', () => {
      const client = new VmixClient({
        host: 'localhost',
        httpPort: 8088,
        tcpPort: 8099,
      });

      expect(client.http).toBeDefined();
      expect(client.tcp).toBeDefined();
    });

    it('omits TCP client when disabled', () => {
      const client = new VmixClient({
        host: 'localhost',
        httpPort: 8088,
        tcpPort: 8099,
        tcpEnabled: false,
      });

      expect(client.http).toBeDefined();
      expect(client.tcp).toBeNull();
    });
  });

  describe('fromConfig', () => {
    it('creates client from config object', () => {
      const client = VmixClient.fromConfig({
        VMIX_HOST: '192.168.1.100',
        VMIX_HTTP_PORT: 8088,
        VMIX_TCP_PORT: 8099,
        TCP_ENABLED: true,
        TCP_RECONNECT_DELAY: 5000,
        TCP_MAX_RECONNECTS: 10,
        TCP_CONNECT_TIMEOUT: 10000,
        STATE_CACHE_TTL: 100,
        LOG_LEVEL: 'info',
      });

      expect(client.http.baseUrl).toBe('http://192.168.1.100:8088/api');
    });
  });

  describe('connect', () => {
    it('verifies HTTP connection', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const client = new VmixClient({
        host: 'localhost',
        httpPort: 8088,
        tcpPort: 8099,
        tcpEnabled: false, // Disable TCP for this test
        logLevel: 'error',
      });

      await client.connect();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8088/api',
        expect.objectContaining({ method: 'GET', signal: expect.any(AbortSignal) })
      );
    });

    it('throws if HTTP connection fails', async () => {
      mockFetch.mockResolvedValue({ ok: false });

      const client = new VmixClient({
        host: 'localhost',
        httpPort: 8088,
        tcpPort: 8099,
        tcpEnabled: false,
        logLevel: 'error',
      });

      await expect(client.connect()).rejects.toThrow(ConnectionError);
    });

    it('continues if TCP connection fails', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const client = new VmixClient({
        host: 'localhost',
        httpPort: 8088,
        tcpPort: 8099,
        tcpEnabled: true,
        tcpConnectTimeout: 1000,
        tcpMaxReconnects: 0,
        logLevel: 'error',
      });

      // The mocked socket refuses every connection; connect() must still
      // resolve (HTTP-only operation) instead of crashing or rejecting.
      await expect(client.connect()).resolves.toBeUndefined();

      expect(client.connected).toBe(true);
      expect(client.tcp?.connected).toBe(false);

      client.disconnect();
      // Let queued microtask socket events settle
      await new Promise((resolve) => setImmediate(resolve));
    });
  });

  describe('connected', () => {
    it('is false before connect()', () => {
      const client = new VmixClient({
        host: 'localhost',
        httpPort: 8088,
        tcpPort: 8099,
        tcpEnabled: false,
      });

      expect(client.connected).toBe(false);
    });

    it('is true after a successful connect() and false after disconnect()', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const client = new VmixClient({
        host: 'localhost',
        httpPort: 8088,
        tcpPort: 8099,
        tcpEnabled: false,
        logLevel: 'error',
      });

      await client.connect();
      expect(client.connected).toBe(true);

      client.disconnect();
      expect(client.connected).toBe(false);
    });

    it('stays false when connect() fails', async () => {
      mockFetch.mockResolvedValue({ ok: false });

      const client = new VmixClient({
        host: 'localhost',
        httpPort: 8088,
        tcpPort: 8099,
        tcpEnabled: false,
        logLevel: 'error',
      });

      await expect(client.connect()).rejects.toThrow(ConnectionError);
      expect(client.connected).toBe(false);
    });
  });

  describe('normalizeInput', () => {
    it('normalizes number input', () => {
      const client = new VmixClient({
        host: 'localhost',
        httpPort: 8088,
        tcpPort: 8099,
      });

      expect(client.normalizeInput(1)).toBe('1');
      expect(client.normalizeInput(42)).toBe('42');
    });

    it('normalizes string input', () => {
      const client = new VmixClient({
        host: 'localhost',
        httpPort: 8088,
        tcpPort: 8099,
      });

      expect(client.normalizeInput('Camera 1')).toBe('Camera 1');
      expect(client.normalizeInput('  trimmed  ')).toBe('trimmed');
    });
  });
});

/**
 * Tests for the vMix TCP client
 *
 * Uses a fake net.Socket (no real sockets are opened).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VmixTcpClient } from '../../../src/clients/tcp-client.js';
import { ConnectionError } from '../../../src/errors/index.js';

interface FakeSocketLike {
  writable: boolean;
  destroyed: boolean;
  written: string[];
  connectCalls: Array<{ port: number; host: string }>;
  emit(event: string, ...args: unknown[]): boolean;
  _open(): void;
  _fail(err: Error): void;
  _close(): void;
  _data(chunk: string): void;
}

const harness = vi.hoisted(() => ({
  sockets: [] as unknown[],
}));

vi.mock('net', async () => {
  const { EventEmitter } = await import('node:events');

  class FakeSocket extends EventEmitter {
    writable = false;
    destroyed = false;
    written: string[] = [];
    connectCalls: Array<{ port: number; host: string }> = [];

    constructor() {
      super();
      harness.sockets.push(this);
    }

    connect(port: number, host: string): void {
      this.connectCalls.push({ port, host });
      // Real sockets never connect synchronously; tests drive the outcome
      // via _open() / _fail().
    }

    destroy(): void {
      if (this.destroyed) {
        return;
      }
      this.destroyed = true;
      this.writable = false;
      queueMicrotask(() => this.emit('close'));
    }

    write(data: string, cb?: (err?: Error) => void): boolean {
      this.written.push(data);
      cb?.();
      return true;
    }

    removeListener(event: string, listener: (...args: unknown[]) => void): this {
      return super.removeListener(event, listener) as this;
    }

    // Test helpers
    _open(): void {
      this.writable = true;
      this.emit('connect');
    }

    _fail(err: Error): void {
      this.emit('error', err);
      this.destroy();
    }

    _close(): void {
      this.writable = false;
      this.emit('close');
    }

    _data(chunk: string): void {
      this.emit('data', Buffer.from(chunk, 'utf8'));
    }
  }

  return { Socket: FakeSocket };
});

function lastSocket(): FakeSocketLike {
  const socket = harness.sockets[harness.sockets.length - 1];
  if (!socket) {
    throw new Error('No fake socket was created');
  }
  return socket as FakeSocketLike;
}

function createClient(overrides: Partial<ConstructorParameters<typeof VmixTcpClient>[0]> = {}) {
  return new VmixTcpClient({
    host: 'localhost',
    port: 8099,
    logLevel: 'error',
    ...overrides,
  });
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('VmixTcpClient', () => {
  beforeEach(() => {
    harness.sockets.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('error safety (C1)', () => {
    it('does not throw when a connection fails with zero external error listeners', async () => {
      const client = createClient({ maxReconnects: 0 });

      const connectPromise = client.connect();
      const socket = lastSocket();

      // EventEmitter throws synchronously on an unhandled 'error' event;
      // this proves the internal listener prevents a process crash.
      expect(() => socket._fail(new Error('connect ECONNREFUSED'))).not.toThrow();

      await expect(connectPromise).rejects.toThrow(ConnectionError);
      await flushMicrotasks();
    });

    it('does not throw on socket errors after connection with zero external listeners', async () => {
      const client = createClient({ maxReconnects: 0 });

      const connectPromise = client.connect();
      lastSocket()._open();
      await connectPromise;

      expect(() => lastSocket().emit('error', new Error('ECONNRESET'))).not.toThrow();

      client.disconnect();
      await flushMicrotasks();
    });

    it('emits error exactly once per initial connect failure (no double emit)', async () => {
      const client = createClient({ maxReconnects: 0 });
      const errors: Error[] = [];
      client.on('error', (err) => errors.push(err));

      const connectPromise = client.connect();
      lastSocket()._fail(new Error('boom'));

      await expect(connectPromise).rejects.toThrow('TCP connection failed: boom');
      await flushMicrotasks();

      expect(errors).toHaveLength(1);
    });
  });

  describe('connect concurrency', () => {
    it('shares the in-flight attempt and does not resolve before the socket is up', async () => {
      const client = createClient();

      const p1 = client.connect();
      const p2 = client.connect();

      // Only one socket should be opened for both callers
      expect(harness.sockets).toHaveLength(1);

      let secondResolved = false;
      void p2.then(() => {
        secondResolved = true;
      });
      await flushMicrotasks();
      expect(secondResolved).toBe(false);

      lastSocket()._open();
      await Promise.all([p1, p2]);

      expect(client.connected).toBe(true);
      client.disconnect();
      await flushMicrotasks();
    });

    it('rejects a pending connect immediately when disconnect() is called', async () => {
      const client = createClient({ connectTimeout: 10000 });

      const connectPromise = client.connect();
      client.disconnect();

      // Must reject promptly, not after the 10s connect timeout
      await expect(connectPromise).rejects.toThrow(/aborted/i);
      expect(client.connected).toBe(false);
      await flushMicrotasks();
    });

    it('clears the socket on connect timeout so a fresh attempt is possible', async () => {
      vi.useFakeTimers();
      const client = createClient({ connectTimeout: 1000, maxReconnects: 0 });

      const connectPromise = client.connect();
      const expectation = expect(connectPromise).rejects.toThrow('TCP connection timeout');
      await vi.advanceTimersByTimeAsync(1000);
      await expectation;

      expect(client.connected).toBe(false);

      // A new connect() must create a fresh socket
      const retryPromise = client.connect();
      expect(harness.sockets).toHaveLength(2);
      lastSocket()._open();
      await retryPromise;
      expect(client.connected).toBe(true);

      client.disconnect();
    });
  });

  describe('subscription replay after reconnect (H4)', () => {
    it('re-sends SUBSCRIBE commands after an automatic reconnect', async () => {
      vi.useFakeTimers();
      const client = createClient({ reconnectDelay: 50, maxReconnects: 5 });

      const connectPromise = client.connect();
      const first = lastSocket();
      first._open();
      await connectPromise;

      await client.subscribeTally();
      expect(first.written).toContain('SUBSCRIBE TALLY\r\n');

      // Connection drops -> reconnect is scheduled
      first._close();
      await vi.advanceTimersByTimeAsync(50);

      expect(harness.sockets).toHaveLength(2);
      const second = lastSocket();
      second._open();
      await vi.advanceTimersByTimeAsync(0);

      // The tally subscription is replayed without anyone calling subscribeTally()
      expect(second.written).toContain('SUBSCRIBE TALLY\r\n');
      expect(client.connected).toBe(true);

      client.disconnect();
    });

    it('clears subscriptions on explicit disconnect', async () => {
      vi.useFakeTimers();
      const client = createClient({ reconnectDelay: 50 });

      const connectPromise = client.connect();
      lastSocket()._open();
      await connectPromise;
      await client.subscribeTally();

      client.disconnect();
      await vi.advanceTimersByTimeAsync(0);

      // New session: no automatic replay of old subscriptions
      const reconnectPromise = client.connect();
      const fresh = lastSocket();
      fresh._open();
      await reconnectPromise;
      await vi.advanceTimersByTimeAsync(0);

      expect(fresh.written).not.toContain('SUBSCRIBE TALLY\r\n');
      client.disconnect();
    });
  });

  describe('tally freshness (H4)', () => {
    it('records lastTallyAt for each tally frame and flags staleness on disconnect', async () => {
      const client = createClient({ maxReconnects: 0 });

      const connectPromise = client.connect();
      lastSocket()._open();
      await connectPromise;

      expect(client.lastTally).toBeNull();
      expect(client.lastTallyAt).toBeNull();
      expect(client.tallyStale).toBe(false);

      const before = Date.now();
      lastSocket()._data('TALLY OK 012\r\n');

      expect(client.lastTally).toBe('012');
      expect(client.lastTallyAt).toBeGreaterThanOrEqual(before);
      expect(client.lastTallyAt).toBeLessThanOrEqual(Date.now());
      expect(client.tallyStale).toBe(false);

      // Connection drops: the frame we hold may now be outdated
      lastSocket()._close();
      expect(client.tallyStale).toBe(true);

      // A fresh frame after reconnect clears the staleness flag
      const reconnectPromise = client.connect();
      lastSocket()._open();
      await reconnectPromise;
      lastSocket()._data('TALLY OK 102\r\n');

      expect(client.lastTally).toBe('102');
      expect(client.tallyStale).toBe(false);

      client.disconnect();
      await flushMicrotasks();
    });
  });

  describe('receive buffer cap', () => {
    it('resets the buffer when it exceeds the limit and keeps processing afterwards', async () => {
      const client = createClient({ maxReconnects: 0 });

      const connectPromise = client.connect();
      lastSocket()._open();
      await connectPromise;

      // Oversized garbage without a delimiter must not accumulate forever
      lastSocket()._data('x'.repeat(1_048_577));

      // After the reset, a well-formed message still parses
      lastSocket()._data('TALLY OK 1\r\n');
      expect(client.lastTally).toBe('1');

      client.disconnect();
      await flushMicrotasks();
    });
  });

  describe('reconnect exhaustion', () => {
    it('emits reconnectExhausted and reports status when it gives up', async () => {
      const client = createClient({ maxReconnects: 0 });
      const exhausted = vi.fn();
      client.on('reconnectExhausted', exhausted);

      const connectPromise = client.connect();
      lastSocket()._open();
      await connectPromise;

      lastSocket()._close();

      expect(exhausted).toHaveBeenCalledTimes(1);
      expect(client.status).toBe('reconnect_exhausted');
      expect(client.connected).toBe(false);
    });

    it('reports lifecycle status transitions', async () => {
      const client = createClient();

      expect(client.status).toBe('disconnected');

      const connectPromise = client.connect();
      expect(client.status).toBe('connecting');

      lastSocket()._open();
      await connectPromise;
      expect(client.status).toBe('connected');

      client.disconnect();
      expect(client.status).toBe('disconnected');
      await flushMicrotasks();
    });
  });
});

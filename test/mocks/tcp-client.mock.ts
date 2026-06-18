/**
 * Mock TCP client for testing
 */

import { vi } from 'vitest';
import { EventEmitter } from 'events';
import type { IVmixTcpClient, TcpClientStatus } from '../../src/clients/types.js';

/**
 * Create a mock TCP client
 */
export function createMockTcpClient(): IVmixTcpClient & EventEmitter & {
  _setConnected: (connected: boolean) => void;
  _emitTally: (tally: string) => void;
  _emitActivator: (name: string, input: string, value: string) => void;
  _setTallyStale: (stale: boolean) => void;
} {
  const emitter = new EventEmitter();
  let isConnected = false;

  const mock = Object.assign(emitter, {
    connected: false,
    lastTally: null as string | null,
    lastTallyAt: null as number | null,
    tallyStale: false,
    status: 'disconnected' as TcpClientStatus,

    connect: vi.fn(async () => {
      isConnected = true;
      (mock as { connected: boolean }).connected = true;
      (mock as { status: TcpClientStatus }).status = 'connected';
      emitter.emit('connected');
    }),

    disconnect: vi.fn(() => {
      isConnected = false;
      (mock as { connected: boolean }).connected = false;
      (mock as { status: TcpClientStatus }).status = 'disconnected';
      if (mock.lastTally !== null) {
        (mock as { tallyStale: boolean }).tallyStale = true;
      }
      emitter.emit('disconnected');
    }),

    send: vi.fn(async () => {
      if (!isConnected) {
        throw new Error('Not connected');
      }
    }),

    subscribeTally: vi.fn(async () => {
      if (!isConnected) {
        throw new Error('Not connected');
      }
    }),

    subscribeActivators: vi.fn(async () => {
      if (!isConnected) {
        throw new Error('Not connected');
      }
    }),

    _setConnected: (connected: boolean) => {
      isConnected = connected;
      (mock as { connected: boolean }).connected = connected;
      (mock as { status: TcpClientStatus }).status = connected ? 'connected' : 'disconnected';
    },

    _emitTally: (tally: string) => {
      (mock as { lastTally: string | null }).lastTally = tally;
      (mock as { lastTallyAt: number | null }).lastTallyAt = Date.now();
      (mock as { tallyStale: boolean }).tallyStale = false;
      emitter.emit('tally', tally);
    },

    _emitActivator: (name: string, input: string, value: string) => {
      emitter.emit('activator', { name, input, value });
    },

    _setTallyStale: (stale: boolean) => {
      (mock as { tallyStale: boolean }).tallyStale = stale;
    },
  }) as IVmixTcpClient & EventEmitter & {
    _setConnected: (connected: boolean) => void;
    _emitTally: (tally: string) => void;
    _emitActivator: (name: string, input: string, value: string) => void;
    _setTallyStale: (stale: boolean) => void;
  };

  return mock;
}

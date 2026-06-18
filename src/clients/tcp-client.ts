/**
 * vMix TCP API client
 * Handles subscriptions and real-time events via TCP (port 8099)
 */

import { EventEmitter } from 'events';
import { Socket } from 'net';
import type {
  IVmixTcpClient,
  TcpClientOptions,
  TcpClientEvents,
  TcpClientStatus,
  ActivatorEvent,
} from './types.js';
import { ConnectionError } from '../errors/index.js';
import { createLogger, type Logger } from '../utils/index.js';

/**
 * Default options
 */
const DEFAULTS = {
  reconnectDelay: 5000,
  maxReconnects: 10,
  connectTimeout: 10000,
};

/**
 * Maximum size of the receive buffer before it is reset (1 MiB).
 * Protects against unbounded growth if vMix sends data without delimiters.
 */
const MAX_BUFFER_SIZE = 1_048_576;

/**
 * TCP client for vMix subscriptions
 */
export class VmixTcpClient extends EventEmitter implements IVmixTcpClient {
  private readonly host: string;
  private readonly port: number;
  private readonly reconnectDelay: number;
  private readonly maxReconnects: number;
  private readonly connectTimeout: number;
  private readonly logger: Logger;

  private socket: Socket | null = null;
  private buffer = '';
  private reconnectCount = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldReconnect = true;
  private reconnectsExhausted = false;
  private connectPromise: Promise<void> | null = null;
  private abortPendingConnect: ((reason: ConnectionError) => void) | null = null;
  /** Subscriptions to replay after an automatic reconnect (e.g. 'TALLY', 'ACTS') */
  private readonly subscriptions = new Set<string>();
  private _lastTally: string | null = null;
  private _lastTallyAt: number | null = null;
  private _tallyStale = false;

  constructor(options: TcpClientOptions) {
    super();
    this.host = options.host;
    this.port = options.port;
    this.reconnectDelay = options.reconnectDelay ?? DEFAULTS.reconnectDelay;
    this.maxReconnects = options.maxReconnects ?? DEFAULTS.maxReconnects;
    this.connectTimeout = options.connectTimeout ?? DEFAULTS.connectTimeout;
    this.logger = createLogger({ level: options.logLevel ?? 'info', prefix: 'vmix-tcp' });

    // TCP is optional: register an internal 'error' listener so an emitted
    // 'error' event can never crash the process when no external listener is
    // attached (Node throws on unhandled 'error' events).
    super.on('error', (err: unknown) => {
      this.logger.debug('TCP error event', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  get connected(): boolean {
    return this.socket?.writable ?? false;
  }

  get lastTally(): string | null {
    return this._lastTally;
  }

  get lastTallyAt(): number | null {
    return this._lastTallyAt;
  }

  get tallyStale(): boolean {
    return this._tallyStale;
  }

  get status(): TcpClientStatus {
    if (this.connected) {
      return 'connected';
    }
    if (this.connectPromise) {
      return this.reconnectCount > 0 ? 'reconnecting' : 'connecting';
    }
    if (this.reconnectTimer) {
      return 'reconnecting';
    }
    if (this.reconnectsExhausted) {
      return 'reconnect_exhausted';
    }
    return 'disconnected';
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    // Share the in-flight attempt so a concurrent connect() does not resolve
    // before the socket is actually up.
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.shouldReconnect = true;
    this.reconnectsExhausted = false;

    this.connectPromise = new Promise<void>((resolve, reject) => {
      const socket = new Socket();
      this.socket = socket;

      let settled = false;
      const settle = (err?: ConnectionError) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutHandle);
        this.connectPromise = null;
        this.abortPendingConnect = null;
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      };

      // Allow disconnect() to fail this attempt immediately instead of
      // leaving the caller hanging until the connect timeout fires.
      this.abortPendingConnect = (reason: ConnectionError) => {
        socket.destroy();
        if (this.socket === socket) {
          this.socket = null;
        }
        settle(reason);
      };

      const timeoutHandle = setTimeout(() => {
        socket.destroy();
        if (this.socket === socket) {
          this.socket = null;
        }
        settle(
          new ConnectionError(
            'TCP connection timeout',
            this.host,
            this.port,
            'tcp'
          )
        );
      }, this.connectTimeout);

      socket.once('connect', () => {
        this.reconnectCount = 0;
        this.logger.info('TCP connected', { host: this.host, port: this.port });
        settle();
        this.emit('connected');
        this.replaySubscriptions();
      });

      // Single persistent error handler: emits 'error' exactly once per
      // socket error and fails the pending connect attempt if there is one.
      socket.on('error', (err) => {
        this.logger.error('TCP socket error', err);
        this.emit('error', err);
        if (!settled) {
          if (this.socket === socket) {
            this.socket = null;
          }
          settle(
            new ConnectionError(
              `TCP connection failed: ${err.message}`,
              this.host,
              this.port,
              'tcp'
            )
          );
        }
      });

      socket.on('data', (data) => this.handleData(data));
      socket.on('close', () => this.handleDisconnect());

      this.logger.debug('Connecting to vMix TCP', { host: this.host, port: this.port });
      socket.connect(this.port, this.host);
    });

    return this.connectPromise;
  }

  disconnect(): void {
    this.shouldReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Fail any pending connect() promptly so callers are not left waiting
    // for the connect timeout.
    if (this.abortPendingConnect) {
      this.abortPendingConnect(
        new ConnectionError(
          'TCP connection aborted: disconnect() was called',
          this.host,
          this.port,
          'tcp'
        )
      );
    }

    this.subscriptions.clear();

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    this.logger.info('TCP disconnected');
  }

  async send(command: string): Promise<void> {
    if (!this.socket?.writable) {
      throw new ConnectionError(
        'TCP not connected',
        this.host,
        this.port,
        'tcp'
      );
    }

    return new Promise((resolve, reject) => {
      this.socket!.write(`${command}\r\n`, (err) => {
        if (err) {
          reject(new ConnectionError(
            `Failed to send command: ${err.message}`,
            this.host,
            this.port,
            'tcp'
          ));
        } else {
          this.logger.debug('TCP command sent', { command });
          resolve();
        }
      });
    });
  }

  async subscribeTally(): Promise<void> {
    this.subscriptions.add('TALLY');
    await this.send('SUBSCRIBE TALLY');
    this.logger.info('Subscribed to tally updates');
  }

  async subscribeActivators(): Promise<void> {
    this.subscriptions.add('ACTS');
    await this.send('SUBSCRIBE ACTS');
    this.logger.info('Subscribed to activator events');
  }

  // Type-safe event methods
  override on<E extends keyof TcpClientEvents>(
    event: E,
    listener: (...args: TcpClientEvents[E]) => void
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  override off<E extends keyof TcpClientEvents>(
    event: E,
    listener: (...args: TcpClientEvents[E]) => void
  ): this {
    return super.off(event, listener as (...args: unknown[]) => void);
  }

  override once<E extends keyof TcpClientEvents>(
    event: E,
    listener: (...args: TcpClientEvents[E]) => void
  ): this {
    return super.once(event, listener as (...args: unknown[]) => void);
  }

  /**
   * Re-send SUBSCRIBE commands after a (re)connect so push updates resume.
   * Without this, an auto-reconnected session would silently stop receiving
   * tally/activator events.
   */
  private replaySubscriptions(): void {
    for (const subscription of this.subscriptions) {
      void this.send(`SUBSCRIBE ${subscription}`)
        .then(() => {
          this.logger.info('Re-established subscription', { subscription });
        })
        .catch((err: unknown) => {
          this.logger.warn('Failed to re-establish subscription', {
            subscription,
            error: err instanceof Error ? err.message : String(err),
          });
        });
    }
  }

  private handleData(data: Buffer): void {
    this.buffer += data.toString('utf8');

    // Process complete messages (terminated by \r\n)
    let idx;
    while ((idx = this.buffer.indexOf('\r\n')) !== -1) {
      const message = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 2);
      this.processMessage(message);
    }

    // Cap the receive buffer: if no delimiter arrives, do not grow unbounded.
    if (this.buffer.length > MAX_BUFFER_SIZE) {
      this.logger.warn('TCP receive buffer exceeded limit; resetting', {
        size: this.buffer.length,
        limit: MAX_BUFFER_SIZE,
      });
      this.buffer = '';
    }
  }

  private processMessage(message: string): void {
    this.logger.debug('TCP message received', { message: message.substring(0, 100) });
    this.emit('message', message);

    const parts = message.split(' ');
    const command = parts[0];

    switch (command) {
      case 'TALLY':
        // Format: TALLY OK <tally_string>
        if (parts[1] === 'OK' && parts[2]) {
          this._lastTally = parts.slice(2).join('');
          this._lastTallyAt = Date.now();
          this._tallyStale = false;
          this.emit('tally', this._lastTally);
        }
        break;

      case 'ACTS':
        // Format: ACTS OK <name> <input> <value>
        if (parts[1] === 'OK') {
          const event: ActivatorEvent = {
            name: parts[2] ?? '',
            input: parts[3] ?? '',
            value: parts[4] ?? '',
          };
          this.emit('activator', event);
        }
        break;

      case 'VERSION':
        this.logger.info('vMix version', { version: parts.slice(1).join(' ') });
        break;

      default:
        // Unknown message type - just log it
        if (message.length > 0) {
          this.logger.debug('Unknown TCP message', { command, message });
        }
    }
  }

  private handleDisconnect(): void {
    this.logger.warn('TCP connection closed');

    // Any tally frame we hold may now be outdated; flag it until a fresh
    // frame arrives.
    if (this._lastTally !== null) {
      this._tallyStale = true;
    }

    this.emit('disconnected');

    // Attempt reconnection if enabled
    if (this.shouldReconnect && this.reconnectCount < this.maxReconnects) {
      this.reconnectCount++;
      this.logger.info('Scheduling reconnection', {
        attempt: this.reconnectCount,
        maxAttempts: this.maxReconnects,
        delayMs: this.reconnectDelay,
      });

      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect().catch((err) => {
          this.logger.error('Reconnection failed', err);
        });
      }, this.reconnectDelay);
    } else if (this.shouldReconnect && this.reconnectCount >= this.maxReconnects) {
      this.reconnectsExhausted = true;
      this.logger.error('Max reconnection attempts reached; giving up');
      this.emit('reconnectExhausted');
    }
  }
}

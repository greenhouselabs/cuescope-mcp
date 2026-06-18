/**
 * Client interface definitions
 * These interfaces enable dependency injection and testing
 */

import type { InputReference } from '../utils/index.js';
import type { LogLevel } from '../config/schema.js';

/**
 * Events emitted by the TCP client
 */
export interface TcpClientEvents {
  connected: [];
  disconnected: [];
  /** Emitted when automatic reconnection gives up after exhausting attempts */
  reconnectExhausted: [];
  error: [Error];
  tally: [string];
  activator: [ActivatorEvent];
  message: [string];
}

/**
 * Lifecycle status of the TCP client connection
 */
export type TcpClientStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'reconnect_exhausted';

/**
 * Activator event data from vMix
 */
export interface ActivatorEvent {
  name: string;
  input: string;
  value: string;
}

/**
 * HTTP client interface for vMix API commands
 */
export interface IVmixHttpClient {
  /**
   * Execute a vMix function
   * @param func Function name (e.g., "Cut", "Fade", "SetText")
   * @param params Function parameters
   */
  execute(func: string, params?: Record<string, string | number | undefined>): Promise<void>;

  /**
   * Get the current vMix state as XML
   */
  getState(): Promise<string>;

  /**
   * Check if vMix is reachable
   */
  isConnected(): Promise<boolean>;

  /**
   * Get the base URL for the vMix API
   */
  readonly baseUrl: string;
}

/**
 * TCP client interface for vMix subscriptions
 */
export interface IVmixTcpClient {
  /**
   * Connect to vMix TCP API
   */
  connect(): Promise<void>;

  /**
   * Disconnect from vMix
   */
  disconnect(): void;

  /**
   * Send a raw command
   */
  send(command: string): Promise<void>;

  /**
   * Subscribe to tally updates
   */
  subscribeTally(): Promise<void>;

  /**
   * Subscribe to activator events
   */
  subscribeActivators(): Promise<void>;

  /**
   * Whether the TCP connection is active
   */
  readonly connected: boolean;

  /**
   * Most recent tally frame pushed by vMix (raw digit string), or null if none
   * has arrived yet. Each position is an input: 0 off, 1 program, 2 preview.
   */
  readonly lastTally: string | null;

  /**
   * Epoch milliseconds when the most recent tally frame was received,
   * or null if no frame has arrived yet.
   */
  readonly lastTallyAt: number | null;

  /**
   * True when lastTally may be outdated (the connection dropped after the
   * frame was received and no fresh frame has arrived since).
   */
  readonly tallyStale: boolean;

  /**
   * Current connection lifecycle status, including whether automatic
   * reconnection is in progress or has given up.
   */
  readonly status: TcpClientStatus;

  /**
   * Event listeners
   */
  on<E extends keyof TcpClientEvents>(
    event: E,
    listener: (...args: TcpClientEvents[E]) => void
  ): this;

  off<E extends keyof TcpClientEvents>(
    event: E,
    listener: (...args: TcpClientEvents[E]) => void
  ): this;

  once<E extends keyof TcpClientEvents>(
    event: E,
    listener: (...args: TcpClientEvents[E]) => void
  ): this;
}

/**
 * Unified vMix client interface
 */
export interface IVmixClient {
  /**
   * HTTP client for commands and state
   */
  readonly http: IVmixHttpClient;

  /**
   * TCP client for subscriptions (null if disabled)
   */
  readonly tcp: IVmixTcpClient | null;

  /**
   * Initialize connections to vMix
   */
  connect(): Promise<void>;

  /**
   * Close all connections
   */
  disconnect(): void;

  /**
   * Normalize an input reference for API calls
   */
  normalizeInput(input: InputReference): string;

  /**
   * Whether the client is connected to vMix
   */
  readonly connected: boolean;
}

/**
 * Options for HTTP client
 */
export interface HttpClientOptions {
  host: string;
  port: number;
  timeout?: number;
  /** Minimum log level for this client's logger (default: 'info') */
  logLevel?: LogLevel;
}

/**
 * Options for TCP client
 */
export interface TcpClientOptions {
  host: string;
  port: number;
  reconnectDelay?: number;
  maxReconnects?: number;
  connectTimeout?: number;
  /** Minimum log level for this client's logger (default: 'info') */
  logLevel?: LogLevel;
}

/**
 * Options for unified client
 */
export interface VmixClientOptions {
  host: string;
  httpPort: number;
  tcpPort: number;
  tcpEnabled?: boolean;
  tcpReconnectDelay?: number;
  tcpMaxReconnects?: number;
  tcpConnectTimeout?: number;
  /** Minimum log level, propagated to the HTTP and TCP clients (default: 'info') */
  logLevel?: LogLevel;
}

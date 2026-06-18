/**
 * Unified vMix client
 * Combines HTTP and TCP clients with common configuration
 */

import type { IVmixClient, IVmixHttpClient, IVmixTcpClient, VmixClientOptions } from './types.js';
import { VmixHttpClient } from './http-client.js';
import { VmixTcpClient } from './tcp-client.js';
import type { Config } from '../config/index.js';
import { ConnectionError } from '../errors/index.js';
import { normalizeInput, createLogger, type InputReference, type Logger } from '../utils/index.js';

/**
 * Unified vMix client that manages HTTP and TCP connections
 */
export class VmixClient implements IVmixClient {
  public readonly http: IVmixHttpClient;
  public readonly tcp: IVmixTcpClient | null;
  private readonly logger: Logger;
  private readonly options: VmixClientOptions;
  private _connected = false;

  constructor(options: VmixClientOptions) {
    this.options = options;
    this.logger = createLogger({ level: options.logLevel ?? 'info', prefix: 'vmix-client' });

    // Create HTTP client
    this.http = new VmixHttpClient({
      host: options.host,
      port: options.httpPort,
      logLevel: options.logLevel,
    });

    // Create TCP client if enabled
    if (options.tcpEnabled !== false) {
      this.tcp = new VmixTcpClient({
        host: options.host,
        port: options.tcpPort,
        reconnectDelay: options.tcpReconnectDelay,
        maxReconnects: options.tcpMaxReconnects,
        connectTimeout: options.tcpConnectTimeout,
        logLevel: options.logLevel,
      });

      // TCP is optional: surface socket errors as warnings without letting an
      // unhandled 'error' event crash the process.
      this.tcp.on('error', (err) => {
        this.logger.warn('TCP error (non-fatal, TCP is optional)', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    } else {
      this.tcp = null;
    }
  }

  /**
   * Create a VmixClient from a Config object
   */
  static fromConfig(config: Config): VmixClient {
    return new VmixClient({
      host: config.VMIX_HOST,
      httpPort: config.VMIX_HTTP_PORT,
      tcpPort: config.VMIX_TCP_PORT,
      tcpEnabled: config.TCP_ENABLED,
      tcpReconnectDelay: config.TCP_RECONNECT_DELAY,
      tcpMaxReconnects: config.TCP_MAX_RECONNECTS,
      tcpConnectTimeout: config.TCP_CONNECT_TIMEOUT,
      logLevel: config.LOG_LEVEL,
    });
  }

  get connected(): boolean {
    // Reflects the last connect()/disconnect() lifecycle: true once the HTTP
    // health check has succeeded, false before connect() or after disconnect().
    // TCP is optional and does not affect this flag.
    return this._connected;
  }

  async connect(): Promise<void> {
    this.logger.info('Connecting to vMix', {
      host: this.options.host,
      httpPort: this.options.httpPort,
      tcpEnabled: this.tcp !== null,
    });

    // Check HTTP connection first
    const httpOk = await this.http.isConnected();
    if (!httpOk) {
      this._connected = false;
      throw new ConnectionError(
        'Cannot connect to vMix HTTP API. Ensure vMix is running and Web Controller is enabled.',
        this.options.host,
        this.options.httpPort,
        'http'
      );
    }

    this._connected = true;
    this.logger.info('HTTP connection verified');

    // Try TCP if enabled (optional - don't fail if it doesn't connect)
    if (this.tcp) {
      try {
        await this.tcp.connect();
        await this.tcp.subscribeTally();
        this.logger.info('TCP connection established with tally subscription');
      } catch (error) {
        this.logger.warn('TCP connection failed, continuing HTTP-only', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Don't throw - TCP is optional
      }
    }
  }

  disconnect(): void {
    this.logger.info('Disconnecting from vMix');
    this._connected = false;
    this.tcp?.disconnect();
  }

  normalizeInput(input: InputReference): string {
    return normalizeInput(input);
  }
}

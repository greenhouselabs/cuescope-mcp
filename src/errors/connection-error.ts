/**
 * Error thrown when connection to vMix fails
 */

import { VmixError } from './base.js';

/**
 * Connection error - thrown when unable to connect to vMix
 */
export class ConnectionError extends VmixError {
  public readonly host: string;
  public readonly port: number;
  public readonly transport: 'http' | 'tcp';

  constructor(
    message: string,
    host: string,
    port: number,
    transport: 'http' | 'tcp' = 'http'
  ) {
    super(message, 'CONNECTION_ERROR');
    this.name = 'ConnectionError';
    this.host = host;
    this.port = port;
    this.transport = transport;
  }

  override toUserMessage(): string {
    return (
      `Connection Error: Cannot reach vMix at ${this.host}:${this.port} (${this.transport.toUpperCase()}). ` +
      `Ensure vMix is running and Web Controller is enabled in Settings > Web Controller.`
    );
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      host: this.host,
      port: this.port,
      transport: this.transport,
    };
  }
}

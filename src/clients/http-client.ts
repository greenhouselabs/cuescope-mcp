/**
 * vMix HTTP API client
 * Handles command execution and state retrieval via HTTP (port 8088)
 */

import type { IVmixHttpClient, HttpClientOptions } from './types.js';
import { ConnectionError, CommandError, TimeoutError } from '../errors/index.js';
import { createLogger, type Logger } from '../utils/index.js';

/**
 * Default timeout for HTTP requests (30 seconds)
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * Timeout for the lightweight health check (5 seconds)
 */
const HEALTH_CHECK_TIMEOUT = 5000;

/**
 * Extract a useful detail string from a fetch network error,
 * including the system error code (e.g. ECONNREFUSED) when available.
 */
function describeNetworkError(error: Error): string {
  const cause = (error as { cause?: unknown }).cause;
  if (cause && typeof cause === 'object' && 'code' in cause) {
    const code = String(cause.code);
    return `${error.message} (${code})`;
  }
  return error.message;
}

/**
 * HTTP client for vMix API
 */
export class VmixHttpClient implements IVmixHttpClient {
  private readonly host: string;
  private readonly port: number;
  private readonly timeout: number;
  private readonly logger: Logger;

  constructor(options: HttpClientOptions) {
    this.host = options.host;
    this.port = options.port;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.logger = createLogger({ level: options.logLevel ?? 'info', prefix: 'vmix-http' });
  }

  get baseUrl(): string {
    return `http://${this.host}:${this.port}/api`;
  }

  /**
   * fetch with a real timeout: aborts the underlying request via
   * AbortController (so vMix is not left processing a request nobody is
   * waiting for) and always clears the timer.
   */
  private async fetchWithTimeout(
    url: string,
    timeoutMs: number,
    timeoutMessage: string,
    init: RequestInit = {}
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new TimeoutError(timeoutMessage, timeoutMs);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async execute(
    func: string,
    params: Record<string, string | number | undefined> = {}
  ): Promise<void> {
    const queryParams = new URLSearchParams({ Function: func });

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    }

    const url = `${this.baseUrl}/?${queryParams.toString()}`;

    this.logger.debug('Executing vMix function', { func, params });

    try {
      const response = await this.fetchWithTimeout(
        url,
        this.timeout,
        `vMix command timed out after ${this.timeout}ms`
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new CommandError(
          `HTTP ${response.status}: ${errorText}`,
          func,
          params,
          response.status
        );
      }

      this.logger.debug('vMix function executed successfully', { func });
    } catch (error) {
      if (error instanceof CommandError || error instanceof TimeoutError) {
        throw error;
      }

      // fetch (undici) surfaces network failures as TypeError, with the
      // system error (ECONNREFUSED etc.) attached as `cause`.
      if (error instanceof TypeError) {
        throw new ConnectionError(
          `Cannot reach vMix: ${describeNetworkError(error)}`,
          this.host,
          this.port,
          'http'
        );
      }

      // Other unexpected error
      throw new CommandError(
        error instanceof Error ? error.message : 'Unknown error',
        func,
        params
      );
    }
  }

  async getState(): Promise<string> {
    this.logger.debug('Fetching vMix state');

    try {
      const response = await this.fetchWithTimeout(
        this.baseUrl,
        this.timeout,
        `State fetch timed out after ${this.timeout}ms`
      );

      if (!response.ok) {
        throw new ConnectionError(
          `Failed to get vMix state: HTTP ${response.status}`,
          this.host,
          this.port,
          'http'
        );
      }

      const xml = await response.text();
      this.logger.debug('vMix state fetched', { length: xml.length });

      return xml;
    } catch (error) {
      if (error instanceof ConnectionError || error instanceof TimeoutError) {
        throw error;
      }

      const detail =
        error instanceof TypeError
          ? describeNetworkError(error)
          : error instanceof Error
            ? error.message
            : 'Unknown error';

      throw new ConnectionError(
        `Cannot fetch vMix state: ${detail}`,
        this.host,
        this.port,
        'http'
      );
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      // vMix's Web Controller returns 405 to HEAD requests, so use a lightweight
      // GET for the health check (a HEAD check produces false "cannot connect").
      const response = await this.fetchWithTimeout(
        this.baseUrl,
        HEALTH_CHECK_TIMEOUT,
        'Connection check timed out',
        { method: 'GET' }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}

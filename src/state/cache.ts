/**
 * State caching layer
 * Provides cached access to vMix state with configurable TTL
 */

import type { IVmixHttpClient } from '../clients/types.js';
import type { IStateCache, VmixState, StateCacheOptions } from './types.js';
import type { LogLevel } from '../config/schema.js';
import { parseVmixState } from './parser.js';
import { createLogger, type Logger } from '../utils/index.js';

/**
 * Default cache TTL in milliseconds
 */
const DEFAULT_TTL_MS = 100;

/**
 * Constructor options including the optional log level
 * (kept local so the shared StateCacheOptions type is unchanged)
 */
export type StateCacheConstructorOptions = StateCacheOptions & {
  /** Minimum log level for the cache logger (default: 'info') */
  logLevel?: LogLevel;
};

/**
 * State cache implementation
 * Caches parsed vMix state to reduce API calls
 */
export class StateCache implements IStateCache {
  private readonly httpClient: IVmixHttpClient;
  private readonly ttlMs: number;
  private readonly logger: Logger;

  private cachedState: VmixState | null = null;
  private cachedXml: string | null = null;
  private lastFetchTime = 0;

  /** Shared in-flight fetch so concurrent callers do not each hit vMix */
  private pendingFetch: Promise<void> | null = null;
  /** Monotonic counter: incremented when a fetch starts or the cache is invalidated */
  private fetchGeneration = 0;
  /** Generation of the data currently in the cache */
  private appliedGeneration = 0;

  constructor(httpClient: IVmixHttpClient, options: StateCacheConstructorOptions = {}) {
    this.httpClient = httpClient;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.logger = createLogger({ level: options.logLevel ?? 'info', prefix: 'state-cache' });
  }

  /**
   * Get parsed vMix state (uses cache if fresh)
   */
  async getState(): Promise<VmixState> {
    await this.ensureFresh();
    return this.cachedState!;
  }

  /**
   * Get raw XML state (uses cache if fresh)
   */
  async getRawXml(): Promise<string> {
    await this.ensureFresh();
    return this.cachedXml!;
  }

  /**
   * Invalidate the cache
   * Next getState/getRawXml call will fetch fresh data
   */
  invalidate(): void {
    this.cachedState = null;
    this.cachedXml = null;
    this.lastFetchTime = 0;
    // Detach any in-flight fetch and mark it stale: its late result must not
    // repopulate the cache with pre-invalidation data.
    this.pendingFetch = null;
    this.appliedGeneration = ++this.fetchGeneration;
    this.logger.debug('Cache invalidated');
  }

  /**
   * Check if cache is stale
   */
  private isStale(): boolean {
    if (!this.cachedState || !this.cachedXml) {
      return true;
    }
    return Date.now() - this.lastFetchTime > this.ttlMs;
  }

  /**
   * Ensure cache is fresh, fetching if needed.
   *
   * Concurrent callers share a single in-flight fetch. After awaiting a
   * shared fetch the staleness is re-checked, because the awaited fetch may
   * have been discarded by a concurrent invalidate().
   */
  private async ensureFresh(): Promise<void> {
    while (this.isStale()) {
      if (this.pendingFetch) {
        await this.pendingFetch;
        continue;
      }
      await this.startFetch();
    }

    this.logger.debug('Using cached state', {
      ageMs: Date.now() - this.lastFetchTime,
    });
  }

  /**
   * Start a new fetch and register it as the shared in-flight fetch.
   * A fetch result is only applied if no newer fetch (or invalidation)
   * superseded it while it was in flight.
   */
  private async startFetch(): Promise<void> {
    this.logger.debug('Cache stale, fetching fresh state');

    const generation = ++this.fetchGeneration;

    const fetchPromise = (async () => {
      const xml = await this.httpClient.getState();
      const state = parseVmixState(xml);

      if (generation < this.appliedGeneration) {
        // A newer fetch or an invalidate() superseded this one; do not let
        // older data overwrite newer data.
        this.logger.debug('Discarding superseded fetch result', {
          generation,
          appliedGeneration: this.appliedGeneration,
        });
        return;
      }

      this.appliedGeneration = generation;
      this.cachedXml = xml;
      this.cachedState = state;
      this.lastFetchTime = Date.now();

      this.logger.debug('State cached', {
        inputs: state.inputs.length,
        active: state.active,
        preview: state.preview,
      });
    })();

    this.pendingFetch = fetchPromise;
    try {
      await fetchPromise;
    } finally {
      if (this.pendingFetch === fetchPromise) {
        this.pendingFetch = null;
      }
    }
  }
}

/**
 * Create a state cache with the given HTTP client
 */
export function createStateCache(
  httpClient: IVmixHttpClient,
  options?: StateCacheConstructorOptions
): IStateCache {
  return new StateCache(httpClient, options);
}

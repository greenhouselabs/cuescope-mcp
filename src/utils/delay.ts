/**
 * Promise-based delay utilities
 */

import { TimeoutError } from '../errors/timeout-error.js';

/**
 * Wait for a specified number of milliseconds
 * @param ms Milliseconds to wait
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a timeout promise that rejects after a specified time
 *
 * Note: the underlying timer cannot be cancelled; prefer `withTimeout`,
 * which clears its timer once the raced promise settles.
 *
 * @param ms Timeout in milliseconds
 * @param message Error message
 * @returns Promise that rejects with a TimeoutError after timeout
 */
export function timeout<T>(ms: number, message?: string): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(message ?? `Operation timed out after ${ms}ms`, ms));
    }, ms);
  });
}

/**
 * Execute a promise with a timeout
 *
 * The internal timer is always cleared once the race settles, so a fast
 * promise does not leak a live timer. Note this cannot abort the underlying
 * work; for fetch calls, pair with an AbortController.
 *
 * @param promise The promise to execute
 * @param ms Timeout in milliseconds
 * @param message Error message on timeout
 * @returns The promise result, or throws a TimeoutError on timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message?: string
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(message ?? `Operation timed out after ${ms}ms`, ms));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param options Retry options
 */
export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export async function retry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };

  if (!Number.isFinite(opts.maxAttempts) || opts.maxAttempts < 1) {
    throw new RangeError(
      `retry: maxAttempts must be at least 1 (received ${String(opts.maxAttempts)})`
    );
  }

  let lastError: unknown;
  let currentDelay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (opts.shouldRetry && !opts.shouldRetry(error, attempt)) {
        throw error;
      }

      // Don't delay after the last attempt
      if (attempt < opts.maxAttempts) {
        await delay(currentDelay);
        currentDelay = Math.min(currentDelay * opts.backoffMultiplier, opts.maxDelayMs);
      }
    }
  }

  throw lastError;
}

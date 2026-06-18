/**
 * Tests for delay utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { delay, timeout, withTimeout, retry } from '../../../src/utils/index.js';
import { TimeoutError } from '../../../src/errors/index.js';

describe('delay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves after specified time', async () => {
    const promise = delay(1000);

    vi.advanceTimersByTime(999);
    // Promise should not be resolved yet

    vi.advanceTimersByTime(1);
    await expect(promise).resolves.toBeUndefined();
  });

  it('resolves immediately for 0ms', async () => {
    const promise = delay(0);
    vi.advanceTimersByTime(0);
    await expect(promise).resolves.toBeUndefined();
  });
});

describe('timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects after specified time', async () => {
    const promise = timeout(1000);

    vi.advanceTimersByTime(1000);
    await expect(promise).rejects.toThrow('timed out');
  });

  it('uses custom message', async () => {
    const promise = timeout(1000, 'Custom timeout');

    vi.advanceTimersByTime(1000);
    await expect(promise).rejects.toThrow('Custom timeout');
  });
});

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns result if promise resolves before timeout', async () => {
    const promise = withTimeout(
      new Promise((resolve) => setTimeout(() => resolve('success'), 500)),
      1000
    );

    vi.advanceTimersByTime(500);
    await expect(promise).resolves.toBe('success');
  });

  it('rejects if timeout occurs first', async () => {
    const promise = withTimeout(
      new Promise((resolve) => setTimeout(() => resolve('success'), 2000)),
      1000
    );

    vi.advanceTimersByTime(1000);
    await expect(promise).rejects.toThrow('timed out');
  });

  it('rejects with a typed TimeoutError', async () => {
    const promise = withTimeout(new Promise(() => undefined), 1000);
    const expectation = expect(promise).rejects.toMatchObject({
      name: 'TimeoutError',
      code: 'TIMEOUT_ERROR',
      timeoutMs: 1000,
    });

    vi.advanceTimersByTime(1000);
    await expectation;
  });

  it('clears its timer once the promise resolves (no timer leak)', async () => {
    const promise = withTimeout(
      new Promise((resolve) => setTimeout(() => resolve('fast'), 100)),
      60000
    );

    vi.advanceTimersByTime(100);
    await expect(promise).resolves.toBe('fast');

    // The 60s timeout timer must have been cleared
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('timeout (typed error)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects with a TimeoutError instance', async () => {
    const promise = timeout(500);
    const expectation = expect(promise).rejects.toBeInstanceOf(TimeoutError);

    vi.advanceTimersByTime(500);
    await expectation;
  });
});

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await retry(fn, { maxAttempts: 3, initialDelayMs: 100 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const promise = retry(fn, { maxAttempts: 3, initialDelayMs: 100, backoffMultiplier: 1 });

    // First call fails immediately
    await vi.advanceTimersByTimeAsync(100); // Wait for first retry delay
    await vi.advanceTimersByTimeAsync(100); // Wait for second retry delay

    await expect(promise).resolves.toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after max attempts', async () => {
    vi.useRealTimers(); // Use real timers for this test

    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(
      retry(fn, { maxAttempts: 2, initialDelayMs: 10, backoffMultiplier: 1 })
    ).rejects.toThrow('always fails');

    expect(fn).toHaveBeenCalledTimes(2);

    vi.useFakeTimers(); // Restore fake timers for other tests
  });

  it('rejects with RangeError when maxAttempts is less than 1', async () => {
    const fn = vi.fn().mockResolvedValue('never called');

    await expect(retry(fn, { maxAttempts: 0 })).rejects.toThrow(RangeError);
    await expect(retry(fn, { maxAttempts: -1 })).rejects.toThrow(/maxAttempts/);
    expect(fn).not.toHaveBeenCalled();
  });

  it('respects shouldRetry callback', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('non-retryable'));

    const promise = retry(fn, {
      maxAttempts: 3,
      initialDelayMs: 100,
      shouldRetry: () => false, // Never retry
    });

    await expect(promise).rejects.toThrow('non-retryable');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('applies exponential backoff', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const promise = retry(fn, {
      maxAttempts: 3,
      initialDelayMs: 100,
      backoffMultiplier: 2,
      maxDelayMs: 10000,
    });

    // First retry after 100ms
    await vi.advanceTimersByTimeAsync(100);
    // Second retry after 200ms (100 * 2)
    await vi.advanceTimersByTimeAsync(200);

    await expect(promise).resolves.toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

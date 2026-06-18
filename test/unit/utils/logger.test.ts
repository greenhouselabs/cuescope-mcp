/**
 * Tests for logger utilities (default-logger lifecycle)
 */

import { describe, it, expect } from 'vitest';
import { Logger, getLogger, setDefaultLogger } from '../../../src/utils/index.js';

describe('getLogger', () => {
  it('returns the same instance on repeated calls', () => {
    const first = getLogger();
    const second = getLogger();

    expect(second).toBe(first);
  });

  it('does not silently replace the default when called with options', () => {
    const original = getLogger();
    const withOptions = getLogger({ level: 'debug', prefix: 'sneaky' });

    // Once created, the default logger is immutable through getLogger
    expect(withOptions).toBe(original);
  });

  it('can be replaced explicitly via setDefaultLogger', () => {
    const replacement = new Logger({ level: 'error', prefix: 'replaced' });

    setDefaultLogger(replacement);

    expect(getLogger()).toBe(replacement);
  });
});

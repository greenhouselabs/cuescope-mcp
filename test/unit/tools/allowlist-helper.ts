/**
 * Shared test helper: assert that every vMix function name a tool actually
 * executed (recorded by the HTTP client mock) exists in the official vMix
 * function allowlist.
 *
 * This is the runtime complement to the static scan in
 * function-allowlist.test.ts - template-composed names (`Foo${bar}`) can only
 * be checked once composed at runtime.
 */

import { expect } from 'vitest';
import { isAllowlistedVmixFunction } from '../../../src/validation/script-validator.js';

export function expectExecutedFunctionsAllowlisted(http: {
  _getExecutedFunctions: () => string[];
}): void {
  for (const fn of http._getExecutedFunctions()) {
    expect(
      isAllowlistedVmixFunction(fn),
      `executed function "${fn}" is not in the official vMix function allowlist`
    ).toBe(true);
  }
}

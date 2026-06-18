/**
 * Vitest setup file
 * This runs before all tests
 */

import { vi } from 'vitest';

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Set test environment variables.
//
// Snapshot the original values first and restore them in afterAll. Under the
// default forks pool each test file gets its own worker process, so leakage
// is unlikely — but the restore keeps this correct under the threads pool,
// vmThreads, or `--no-isolate`, where workers (and process.env) are shared.
const ENV_KEYS = ['VMIX_HOST', 'VMIX_HTTP_PORT', 'VMIX_TCP_PORT', 'LOG_LEVEL'] as const;
const originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};
for (const key of ENV_KEYS) {
  originalEnv[key] = process.env[key];
}

process.env['VMIX_HOST'] = 'localhost';
process.env['VMIX_HTTP_PORT'] = '8088';
process.env['VMIX_TCP_PORT'] = '8099';
process.env['LOG_LEVEL'] = 'error'; // Suppress logs during tests

// Clean up after all tests
afterAll(() => {
  vi.restoreAllMocks();

  for (const key of ENV_KEYS) {
    const original = originalEnv[key];
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
});

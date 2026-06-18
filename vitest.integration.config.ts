import { defineConfig } from 'vitest/config';

/**
 * Integration test config — runs tests against a REAL vMix instance.
 * Use `npm run test:integration`. Tests self-skip if vMix is unreachable.
 * Kept separate so the default `npm test` stays hermetic (unit only).
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.test.ts'],
    exclude: ['node_modules', 'build'],
    setupFiles: ['./test/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});

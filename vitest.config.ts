import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['node_modules', 'build', 'test/integration/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Measure ALL source files, including ones no test ever imports —
      // otherwise dead/untested modules are invisible in the report.
      include: ['src/**/*.ts'],
      exclude: [
        // Generated allowlist data — no logic to cover.
        'src/validation/vmix-functions.generated.ts',
        // Process entry point — boots the real server (stdio transport).
        'src/index.ts',
        '**/*.d.ts',
      ],
      // Floors set ~6 points below achieved coverage at the time of writing
      // (lines 90.5, statements 89.7, functions 92.6, branches 78.0) so
      // genuine regressions fail CI without making routine changes flaky.
      thresholds: {
        lines: 84,
        statements: 83,
        functions: 86,
        branches: 71,
      },
    },
    setupFiles: ['./test/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});

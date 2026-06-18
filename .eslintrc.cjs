module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    'no-console': ['warn', { allow: ['error', 'warn'] }],
  },
  overrides: [
    {
      // Test files are not part of tsconfig.json's project (it only includes
      // src/), so type-checked rules cannot run on them. Lint them with the
      // non-type-checked ruleset and test-appropriate relaxations.
      files: ['test/**/*.ts', 'vitest.config.ts', 'vitest.integration.config.ts'],
      extends: ['plugin:@typescript-eslint/disable-type-checked'],
      rules: {
        // Mocks and fixtures legitimately use `any` and non-null assertions.
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        // Unused helpers/imports in tests are noise, not bugs — keep visible
        // as warnings without failing the lint gate.
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      },
    },
    {
      // Build/maintenance scripts: plain ESM JavaScript plus one standalone
      // TS file, also outside the tsconfig project. Console output is their UI.
      files: ['scripts/**/*.mjs', 'scripts/**/*.ts'],
      extends: ['plugin:@typescript-eslint/disable-type-checked'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
  ignorePatterns: ['build/', 'node_modules/', 'coverage/', '*.js', '*.cjs'],
};

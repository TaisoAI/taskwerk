import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'test/**',
        'scripts/**',
        'dist/**',
        'coverage/**',
        '**/*.test.js',
        '**/*.spec.js',
        'vitest.config.js',
      ],
    },
  },
});
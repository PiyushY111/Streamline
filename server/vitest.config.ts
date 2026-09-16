import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 20000,
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/services/**/*.ts',
        'src/repositories/**/*.ts',
        'src/middlewares/**/*.ts',
        'src/utils/**/*.ts',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/__tests__/**',
        'src/db/**',
      ],
    },
  },
});

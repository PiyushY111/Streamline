import { defineConfig } from 'vitest/config';

// Dummy values so `vitest` can boot src/config/env.ts (which validates required
// env vars at import time) on a fresh clone with no .env file. dotenv.config()
// in env.ts does not override vars already set in process.env, so these are
// only used when the real .env (or CI env) doesn't already provide a value.
// They must never be valid enough to reach a real database, Redis, or Gemini.
const TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://test:test@localhost:5432/streamline_test',
  ENCRYPTION_KEY: 'a'.repeat(64),
  JWT_SECRET: 'test-jwt-secret-do-not-use',
  AI_PROVIDER: 'mock',
};

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: TEST_ENV,
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

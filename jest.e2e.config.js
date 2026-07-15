/**
 * Jest configuration for selenium-webdriver e2e tests.
 *
 * globalSetup boots the Bun demo server (demo/index.ts) on port 3000 and
 * globalTeardown kills it. Tests drive a headless Chrome via Selenium Manager
 * (bundled with selenium-webdriver — no chromedriver package needed).
 *
 * Run with: bun run test:e2e
 */

/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/e2e'],
  globalSetup: '<rootDir>/tests/e2e/setup/globalSetup.cjs',
  globalTeardown: '<rootDir>/tests/e2e/setup/globalTeardown.cjs',
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
  testMatch: ['**/*.e2e.ts'],
  testTimeout: 60000,
}

/** @type {import('jest').Config} */
export default {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/tests/unit'],
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/tests/e2e/'],
}

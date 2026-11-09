// rootDir is `packages/` so coverage also covers `packages/shared`, which the backend
// imports through its workspace link; tests are still only looked up in the backend.
export default {
  rootDir: '..',
  roots: ['<rootDir>/backend'],
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'backend/src/**/*.js',
    'shared/src/**/*.js',
    '!backend/src/__tests__/**',
    '!backend/src/index.js',
    '!shared/src/**/index.js',
  ],
  globalSetup: '<rootDir>/backend/src/__tests__/globalSetup.js',
  globalTeardown: '<rootDir>/backend/src/__tests__/globalTeardown.js',
  setupFilesAfterEnv: ['<rootDir>/backend/src/__tests__/setup.js'],
  testTimeout: 10000,
};

import path from 'path'
import { defineConfig } from '@playwright/test'

// Dedicated ports and database: the tests create and delete real entities,
// so they must never run against the development or race database.
const BACKEND_PORT = 3101
const FRONTEND_PORT = 5175
const E2E_DB = path.resolve(import.meta.dirname, '../backend/prisma/e2e.db')

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/globalSetup.js',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    // The app runs in French on the race PC, and the existing tests assert
    // French labels; without this Playwright would default to en-US.
    locale: 'fr-FR',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: [
    {
      // The database is built before the server boots: Playwright starts
      // webServers in parallel with globalSetup, so the schema is created here.
      command: 'node ../frontend/tests/prepare-e2e-db.js && node src/index.js',
      cwd: path.resolve(import.meta.dirname, '../backend'),
      url: `http://localhost:${BACKEND_PORT}/health`,
      // never reuse a running server: it would be pointed at the real database
      reuseExistingServer: false,
      timeout: 60000,
      env: {
        DATABASE_URL: `file:${E2E_DB}`,
        PORT: String(BACKEND_PORT),
        USE_MOCK_DEVICE: 'true',
      },
    },
    {
      command: `npx vite --port ${FRONTEND_PORT} --strictPort`,
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: false,
      timeout: 60000,
      env: { BACKEND_PORT: String(BACKEND_PORT) },
    },
  ],
})

import { defineConfig } from '@playwright/test'
import path from 'node:path'
export default defineConfig({
  testDir: '.',
  testMatch: 'screen.spec.js',
  workers: 1,
  timeout: 45000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5181', viewport: { width: 1440, height: 1000 } },
  webServer: [
    {
      command: 'node tests/race-screen/server.js',
      cwd: path.resolve(import.meta.dirname, '../..'),
      url: 'http://127.0.0.1:3221/health',
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: 'node ../../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5181 --strictPort',
      cwd: path.resolve(import.meta.dirname, '../..'),
      url: 'http://127.0.0.1:5181',
      reuseExistingServer: false,
      timeout: 30000,
      env: { BACKEND_PORT: '3221' },
    },
  ],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})

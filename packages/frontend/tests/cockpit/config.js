import { defineConfig } from '@playwright/test'
import path from 'node:path'
export default defineConfig({
  testDir: '.',
  testMatch: 'import.spec.js',
  workers: 1,
  timeout: 45000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5178', viewport: { width: 1440, height: 1000 } },
  webServer: [
    {
      command: 'node tests/cockpit/server.js',
      cwd: path.resolve(import.meta.dirname, '../..'),
      url: 'http://127.0.0.1:3218/health',
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: 'node ../../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5178 --strictPort',
      cwd: path.resolve(import.meta.dirname, '../..'),
      url: 'http://127.0.0.1:5178',
      reuseExistingServer: false,
      timeout: 30000,
      env: { BACKEND_PORT: '3218' },
    },
  ],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})

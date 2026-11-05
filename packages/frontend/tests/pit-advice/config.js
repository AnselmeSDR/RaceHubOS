import { defineConfig } from '@playwright/test'
import path from 'node:path'
export default defineConfig({
  testDir: '.',
  testMatch: 'pit.spec.js',
  workers: 1,
  timeout: 45000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5187', viewport: { width: 1440, height: 1000 } },
  webServer: [
    {
      command: 'node tests/pit-advice/server.js',
      cwd: path.resolve(import.meta.dirname, '../..'),
      url: 'http://127.0.0.1:3227/health',
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: 'node ../../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5187 --strictPort',
      cwd: path.resolve(import.meta.dirname, '../..'),
      url: 'http://127.0.0.1:5187',
      reuseExistingServer: false,
      timeout: 30000,
      env: { BACKEND_PORT: '3227' },
    },
  ],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})

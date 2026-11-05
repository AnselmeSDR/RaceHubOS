import { defineConfig } from '@playwright/test'
import path from 'node:path'
export default defineConfig({
  testDir: '.',
  testMatch: 'sector.spec.js',
  workers: 1,
  timeout: 45000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5184', viewport: { width: 1440, height: 1000 } },
  webServer: [
    {
      command: 'node tests/sector-timing/server.js',
      cwd: path.resolve(import.meta.dirname, '../..'),
      url: 'http://127.0.0.1:3224/health',
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: 'node ../../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5184 --strictPort',
      cwd: path.resolve(import.meta.dirname, '../..'),
      url: 'http://127.0.0.1:5184',
      reuseExistingServer: false,
      timeout: 30000,
      env: { BACKEND_PORT: '3224' },
    },
  ],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})

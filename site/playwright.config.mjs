import os from 'node:os';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

const PORT = 4390;

export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.mjs',
  outputDir: path.join(os.tmpdir(), 'racehubos-site-results'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}`, browserName: 'chromium' },
  webServer: {
    command: `node tests/serve.mjs ${PORT}`,
    cwd: import.meta.dirname,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 30000,
  },
});

import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4200', channel: 'chrome', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'node apps/api/dist/main.js',
      cwd: root,
      url: 'http://127.0.0.1:3000/api/v1/health',
      reuseExistingServer: true,
      timeout: 60000,
    },
    {
      command: 'npm --workspace apps/web start -- --host 127.0.0.1',
      cwd: root,
      url: 'http://127.0.0.1:4200',
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
});

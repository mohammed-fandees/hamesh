import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Sweeps any Chromium profile a test couldn't remove itself (e2e/support/profile.ts).
  globalSetup: './e2e/support/global-setup.ts',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    headless: true,
    trace: 'retain-on-failure',
  },
});

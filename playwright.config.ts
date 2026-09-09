import { defineConfig, devices } from '@playwright/test';

const apiBaseUrl = 'http://127.0.0.1:8787';
const storefrontBaseUrl = 'http://127.0.0.1:5173';
const adminBaseUrl = 'http://127.0.0.1:5174';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: storefrontBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --dir apps/api-worker exec wrangler d1 migrations apply beeecom-demo --local --config wrangler.qa.jsonc && pnpm --dir apps/api-worker exec wrangler dev --local --config wrangler.qa.jsonc --port 8787',
      url: `${apiBaseUrl}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `VITE_API_BASE_URL=${apiBaseUrl} pnpm --dir apps/storefront-web exec vite --host 127.0.0.1 --port 5173`,
      url: storefrontBaseUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `VITE_API_BASE_URL=${apiBaseUrl} pnpm --dir apps/admin-web exec vite --host 127.0.0.1 --port 5174`,
      url: adminBaseUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});

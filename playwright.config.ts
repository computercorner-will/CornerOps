import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 3000);

/**
 * One smoke test against a production build. Run `pnpm build` first, then `pnpm test:e2e`.
 * The sign-in page and auth redirect need no database or Microsoft login.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm start --port ${port}`,
    url: `http://localhost:${port}/signin`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

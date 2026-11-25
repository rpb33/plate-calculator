import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173/plate-calculator/', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 7'],
        launchOptions: process.env.PLAYWRIGHT_CHROME_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } : {},
      },
    },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'] } },
    {
      name: 'chromium-desktop',
      use: {
        viewport: { width: 1100, height: 900 },
        launchOptions: process.env.PLAYWRIGHT_CHROME_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } : {},
      },
    },
  ],
  webServer: {
    // Serve the real production build under a repository subpath.
    command: 'node scripts/serve-build.mjs',
    url: 'http://127.0.0.1:4173/plate-calculator/',
    reuseExistingServer: !process.env.CI,
  },
});

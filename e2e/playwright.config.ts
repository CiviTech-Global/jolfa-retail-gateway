import { defineConfig, devices } from '@playwright/test'
import { API_PORT, SERVER_DIR, serverEnv, WEB_BASE_URL, WEB_DIR, WEB_PORT } from './env'

export default defineConfig({
  testDir: './specs',
  globalSetup: './global-setup.ts',
  outputDir: './test-results',

  // Specs share one database and one API server, so they run serially. Several
  // of them assert on global state (stock levels, admin listings, the homepage
  // section set) that parallel workers would race on.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['list']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: WEB_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Persian RTL app: pin locale/timezone so date and number formatting is
    // deterministic regardless of the machine running the suite.
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        /**
         * CI downloads Playwright's own Chromium (`npm run install-browsers`).
         * Locally we drive the system Chrome instead, because the Playwright
         * CDN is geo-blocked in some regions — `cdn.playwright.dev` returns
         * "this service is not available in your location" — and a `channel`
         * needs no download at all. Override with PLAYWRIGHT_CHANNEL, e.g.
         * `PLAYWRIGHT_CHANNEL=msedge npm test`.
         */
        channel: process.env.PLAYWRIGHT_CHANNEL ?? (process.env.CI ? undefined : 'chrome'),
      },
    },
  ],

  webServer: [
    {
      // `npm run dev` is `tsx watch`; the plain entrypoint is used instead so
      // the server doesn't restart mid-suite on a file touch.
      command: 'npx tsx src/index.ts',
      cwd: SERVER_DIR,
      env: serverEnv(),
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      cwd: WEB_DIR,
      env: {
        ...(process.env as Record<string, string>),
        VITE_API_BASE_URL: `http://localhost:${API_PORT}/api/v1`,
      },
      url: WEB_BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
})

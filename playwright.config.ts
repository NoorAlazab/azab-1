import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for QA CaseForge.
 *
 * Test layout follows a strict Page Object Model under tests/e2e/:
 *   tests/e2e/pages/      - Page Objects (one class per route)
 *   tests/e2e/fixtures/   - shared fixtures (auth, test data)
 *   tests/e2e/specs/      - actual *.spec.ts files (the only ones picked up)
 *
 * See tests/e2e/README.md for conventions.
 */
export default defineConfig({
  testDir: './tests/e2e/specs',

  // Maximum time one test can run
  timeout: 60 * 1000,

  // Test execution settings
  fullyParallel: false, // Run tests sequentially for exploration
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for exploration testing

  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-results.json' }],
  ],

  // Shared settings for all projects
  use: {
    // Base URL for navigation
    // Override with environment variable or pass directly in tests
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',

    // Collect trace on failure for debugging
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Navigation timeout
    navigationTimeout: 30 * 1000,

    // Action timeout (clicks, fills, etc.)
    actionTimeout: 10 * 1000,

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // Accept downloads
    acceptDownloads: true,

    // Ignore HTTPS errors (useful for dev environments)
    ignoreHTTPSErrors: true,
  },

  // Configure projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to test on other browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Web server configuration (optional - for local development)
  // Uncomment if you want Playwright to start your dev server automatically
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  // },
});

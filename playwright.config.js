// EDITOR: HULBERT
import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Share the Supabase gate result with workers.
  globalSetup: './e2e/global-setup.js',
  // Test and assertion timeouts.
  timeout: 30 * 1000,
  expect: {
    // Maximum wait for an assertion.
    timeout: 5000,
  },
  // Prevent accidental test.only on CI.
  forbidOnly: !!process.env.CI,
  // Retry only on CI.
  retries: process.env.CI ? 2 : 0,
  // Serialize tests on CI.
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  // Shared browser settings.
  use: {
    actionTimeout: 0,
    // Base URL for page.goto().
    baseURL: process.env.CI ? 'http://localhost:4173' : 'http://localhost:5173',
    trace: 'on-first-retry',
    headless: !!process.env.CI,
  },

  projects: [
    {
      name: 'chromium',
      testIgnore: /\.supabase\.spec\.js$/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'firefox',
      testIgnore: /\.supabase\.spec\.js$/,
      // Firefox runs headless and serially for reliable navigation.
      workers: 1,
      use: {
        ...devices['Desktop Firefox'],
        headless: true,
      },
    },
    {
      name: 'webkit',
      testIgnore: /\.supabase\.spec\.js$/,
      use: {
        ...devices['Desktop Safari'],
      },
    },
    {
      // Supabase tests avoid artifacts that could contain credentials.
      name: 'supabase',
      testMatch: /\.supabase\.spec\.js$/,
      workers: 1,
      use: {
        ...devices['Desktop Chrome'],
        trace: 'off',
        screenshot: 'off',
        video: 'off',
      },
    },
  ],

  // Keep Playwright artifacts separate from unit-test reports.
  outputDir: 'test-results/playwright',
  // Use the dev server locally and the preview server on CI.
  webServer: {
    command: process.env.CI ? 'npm run preview' : 'npm run dev',
    port: process.env.CI ? 4173 : 5173,
    reuseExistingServer: !process.env.CI,
  },
})

import { defineConfig, devices } from "@playwright/test";

/**
 * Admin-portal end-to-end runs against an ALREADY RUNNING server (usually
 * `npm run dev` with `DEV_LOGIN_PASSWORD` set and, for the assistant flow,
 * `AI_PROVIDER=mock`). These tests sign in through the dev-preview role
 * buttons and need MongoDB, so they are not part of `npm run test:e2e` /
 * CI; run them with:
 *
 *   E2E_ADMIN_BASE_URL=http://localhost:3000 npx playwright test -c playwright.admin.config.ts
 */
const baseURL = process.env.E2E_ADMIN_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e-admin",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report-admin" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 30_000,
    navigationTimeout: 90_000,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
      testMatch: /mobile\.spec\.ts/,
      // Builds on the tasks the desktop flow creates.
      dependencies: ["desktop"],
    },
  ],
});

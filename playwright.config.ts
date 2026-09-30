import { defineConfig, devices } from "@playwright/test";

/**
 * Happy-path e2e against the local emulators + seed data.
 * Before running: `npm run emulators` (window 1), `npm run seed` (window 2),
 * and .env.local with NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true.
 * First time only: `npx playwright install chromium`.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

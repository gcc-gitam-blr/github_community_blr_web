import { defineConfig, devices } from "@playwright/test";

/* Browser tests against the production build.
   Locally:  npm run build && npm run test:e2e        (uses your installed Microsoft Edge)
   In CI:    Chromium is installed by the workflow. */
const PORT = 3100;
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false, // the Epoch demo store lives in the browser; keep tests independent but orderly
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "msedge" },
  webServer: { command: `npx next start -p ${PORT}`, url: `http://localhost:${PORT}`, reuseExistingServer: !process.env.CI, timeout: 60_000 },
  projects: [{ name: "desktop", testIgnore: /phone.spec.ts/ }, { name: "phone", use: { ...devices["Pixel 7"], channel: process.env.CI ? undefined : "msedge" }, testMatch: /phone\.spec\.ts/ }],
});

import { defineConfig, devices } from "@playwright/test";

/* Browser tests against the production build.
   Locally:  npm run build:test && npm run test:e2e   (uses your installed Microsoft Edge)
   build:test and the server below run with NODE_ENV=test, so .env.local is ignored: tests never touch the
   real database or send real email. global-setup refuses a build that contains the real Supabase URL.
   In CI:    Chromium is installed by the workflow. */
const PORT = Number(process.env.PORT) || 3100; // PORT=3101 npx playwright test runs a second suite alongside
const FORMS_PORT = PORT + 10; // the forms project: the same build, with its server pointed at the stand-in database
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 90_000, // the longest flows (a whole Epoch day, axe on the home page) take ~30 s alone and slow down when 3 workers share a laptop or CI runner
  expect: { timeout: 8_000 },
  fullyParallel: false, // the Epoch demo store lives in the browser; keep tests independent but orderly
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "msedge" },
  webServer: [
    { command: `npx next start -p ${PORT}`, url: `http://localhost:${PORT}`, reuseExistingServer: !process.env.CI, timeout: 60_000, env: { NODE_ENV: "test", CERT_SAMPLE: "1" } }, // CERT_SAMPLE: the certificate designs are checked too
    // the public forms, end to end: a stand-in database running the real schema, and the same build pointed at it
    { command: "npx tsx tests/e2e/fake-supabase.ts", url: "http://127.0.0.1:54329/__health", reuseExistingServer: !process.env.CI, timeout: 90_000 },
    { command: `npx next start -p ${FORMS_PORT}`, url: `http://localhost:${FORMS_PORT}`, reuseExistingServer: !process.env.CI, timeout: 60_000,
      env: { NODE_ENV: "test", SUPABASE_URL: "http://127.0.0.1:54329", SUPABASE_SERVICE_ROLE_KEY: "test-service-key", EMAIL_SECRET: "forms-test-secret" } },
  ],
  projects: [
    { name: "desktop", testIgnore: /(phone|forms)\.spec\.ts/ },
    { name: "phone", use: { ...devices["Pixel 7"], channel: process.env.CI ? undefined : "msedge" }, testMatch: /phone\.spec\.ts/ },
    { name: "forms", use: { baseURL: `http://localhost:${FORMS_PORT}` }, testMatch: /forms\.spec\.ts/ },
  ],
});

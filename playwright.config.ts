import { defineConfig, devices } from "@playwright/test";

// PORT=3200 npx playwright test, when another app already has 3000
const url = `http://localhost:${process.env.PORT ?? 3000}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  // the site may be a private garden: open its gate once for every test
  globalSetup: "./tests/e2e/gate.ts",
  retries: 0,
  use: {
    baseURL: url,
    trace: "retain-on-failure",
    storageState: ".playwright/gate.json",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run dev -- -p ${process.env.PORT ?? 3000}`,
    url,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

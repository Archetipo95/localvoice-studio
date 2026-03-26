import { defineConfig } from "@playwright/test";

const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests",
  testIgnore: ["**/ui_accessibility.spec.ts"],
  timeout: isCi ? 45000 : 30000,
  expect: {
    timeout: isCi ? 10000 : 5000,
  },
  fullyParallel: false,
  retries: isCi ? 2 : 0,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 120000,
  },
});

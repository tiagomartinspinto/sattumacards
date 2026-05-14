const { defineConfig } = require("@playwright/test");

const port = Number(process.env.PLAYWRIGHT_PORT || 4305);
const baseURL = `http://127.0.0.1:${port}`;

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: {
    command: "node server.js",
    env: {
      ...process.env,
      LOG_LEVEL: "error",
      NODE_ENV: "test",
      PORT: String(port),
    },
    reuseExistingServer: !process.env.CI,
    url: `${baseURL}/health`,
  },
});

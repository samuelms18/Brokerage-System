import { defineConfig } from "@playwright/test";

// Uses the preinstalled Chromium when present (cloud dev containers);
// otherwise Playwright's own browser (`npx playwright install chromium`).
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH ??
  (require("node:fs").existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3100",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1280, height: 860 } } },
  ],
  webServer: {
    command: "npm run build && npx next start -p 3100",
    env: { INSECURE_COOKIES: "1" },
    url: "http://localhost:3100/login",
    timeout: 240_000,
    reuseExistingServer: false,
  },
});

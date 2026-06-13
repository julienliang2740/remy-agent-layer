import { defineConfig } from "@playwright/test";

/**
 * E2E against the static web export. Run `npm run e2e` (exports first) or
 * `npx playwright test` if dist-web already exists.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:4173",
    headless: true,
  },
  webServer: {
    command: "npx serve dist-web -l 4173 -s",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});

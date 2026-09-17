import { defineConfig, devices } from "@playwright/test";

// E2E runs against the REAL production artefact (the static export), not the dev server.
export default defineConfig({
  testDir: "e2e",
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  webServer: { command: "node scripts/serve-out.mjs 4173", url: "http://localhost:4173", reuseExistingServer: !process.env.CI },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "safari", use: { ...devices["Desktop Safari"] } },
    { name: "iphone", use: { ...devices["iPhone 14"] } },
  ],
});

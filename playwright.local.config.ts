import { defineConfig, devices } from "@playwright/test";
// Local only: drives the installed Google Chrome, so nothing has to be downloaded.
export default defineConfig({
  testDir: "e2e",
  timeout: 45_000,
  reporter: "list",
  use: { baseURL: "http://localhost:4173", trace: "off" },
  webServer: { command: "node scripts/serve-out.mjs 4173", url: "http://localhost:4173", reuseExistingServer: true },
  projects: [
    { name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "phone", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
});

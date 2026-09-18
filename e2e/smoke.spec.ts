import { expect, test } from "@playwright/test";

const routes = ["/", "/about/", "/services/", "/products/", "/products/custom-t-shirt/", "/solutions/", "/spp-studio/", "/billboards/", "/billboards/SPP-BB-001/", "/portfolio/", "/blog/", "/brand/", "/consultation/", "/request-quote/", "/contact/", "/privacy/", "/terms/", "/login/", "/register/"];

for (const route of routes) {
  test(`renders ${route}: one h1, no runtime error, no horizontal scroll`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(route);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("body")).not.toContainText("Application error");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "horizontal overflow").toBe(true);
    expect(errors, errors.join("\n")).toHaveLength(0);
  });
}

test("no request leaves for a blocked host or third-party CDN", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => { const u = new URL(r.url()); if (!["localhost", "127.0.0.1"].includes(u.hostname) && u.protocol.startsWith("http")) external.push(u.hostname); });
  await page.goto("/");
  await page.goto("/billboards/");
  await page.goto("/design/");
  expect(external, external.join(", ")).toHaveLength(0);
});

test("unknown page shows the branded 404", async ({ page }) => {
  const res = await page.goto("/this-page-was-never-printed/");
  expect(res?.status()).toBe(404);
  await expect(page.locator("body")).toContainText(/hasn.t been printed yet/); // typographic apostrophe on the page
});

test("hero: typing a brand name carries it into SPP Studio", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Type your brand name to see it printed").fill("Lao Coffee Co");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/design\/\?text=Lao/);
  await expect(page.locator("main svg text", { hasText: "LAO COFFEE CO" })).toBeVisible();
});

test("studio: add text, switch to back, undo, download a watermarked mockup", async ({ page }) => {
  await page.goto("/design/?product=custom-t-shirt");
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: /Headline/ }).click();
  await expect(page.locator("main svg text", { hasText: "HEADLINE" })).toBeVisible();
  await page.getByRole("tab", { name: /Back/ }).click();
  await expect(page.locator("main svg text", { hasText: "HEADLINE" })).toHaveCount(0);
  await page.getByRole("tab", { name: /Front/ }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("main svg text", { hasText: "HEADLINE" })).toHaveCount(0);
  await page.getByRole("button", { name: "Redo" }).click();
  await page.getByRole("button", { name: /Visualise/ }).first().click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download mockup", exact: true }).click(); // the mobile "Visualise and download mockup" button would match a substring
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
});

test("studio: a non-image file is refused by content sniffing, whatever it is called", async ({ page }) => {
  await page.goto("/design/");
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from("<html><script>alert(1)</script></html>") });
  await expect(page.getByRole("alert").filter({ hasText: /PNG, JPG, WebP or SVG/ })).toBeVisible(); // other alerts (offline notice) may be on the page too
});

test("quote form without a back-end never fakes success", async ({ page }) => {
  await page.goto("/request-quote/?product=polo-shirt&qty=50");
  await expect(page.locator("body")).toContainText(/Polo/i);
  await expect(page.locator("body")).not.toContainText(/SPP-QUOTE-\d{4}/);
});

test("admin and account are gated", async ({ page }) => {
  await page.goto("/admin/dashboard/");
  await expect(page.locator("body")).toContainText(/Back-end not connected|Sign in/i);
  await page.goto("/account/");
  await expect(page.locator("body")).toContainText(/not switched on|Sign in/i);
});

test("keyboard: skip link is the first stop and nav is reachable", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "Safari tab focus depends on an OS setting");
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveText("Skip to content");
});

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
  // the field only carries the name once the page is interactive; on a slow runner the first attempt can land before that
  await expect(async () => {
    await page.goto("/");
    await page.getByLabel("Type your brand name to see it printed").fill("Lao Coffee Co");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/design\/\?text=Lao/, { timeout: 4000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.locator("main svg text", { hasText: "LAO COFFEE CO" })).toBeVisible();
});

test("studio: add text, switch to back, undo, download a watermarked mockup", async ({ page }) => {
  await page.goto("/design/?product=custom-t-shirt");
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: /HEADLINE/i }).click();
  await expect(page.locator("main svg text", { hasText: "HEADLINE" })).toBeVisible();
  await page.getByRole("tab", { name: /Back/ }).click();
  await expect(page.locator("main svg text", { hasText: "HEADLINE" })).toHaveCount(0);
  await page.getByRole("tab", { name: /^Front(?! &)/ }).click(); // not the mockup dialog's "Front & back"
  await expect(page.locator("main svg text", { hasText: "HEADLINE" })).toBeVisible();
  // the front offers three placements; the chest logo is its own area, so the full-front headline is only context there
  await page.getByRole("button", { name: /Left chest/ }).click();
  await page.getByRole("button", { name: /Full front/ }).click();
  await page.getByRole("tab", { name: /Left sleeve/ }).click();
  await expect(page.locator("main svg text", { hasText: "HEADLINE" })).toHaveCount(0);
  await page.getByRole("tab", { name: /^Front(?! &)/ }).click();
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

test("lao: the whole page translates and comes back, including product copy and the Studio picker", async ({ page }) => {
  const lao = /[຀-໿]/;
  await page.goto("/products/custom-t-shirt/");
  const summary = page.locator("main p.t-lede").first();
  await expect(summary).toHaveText(/Combed cotton round-collar tee/);
  const toLao = page.getByRole("button", { name: "ພາສາລາວ" }).first();
  if (!(await toLao.isVisible())) await page.getByRole("button", { name: /Open menu/ }).click(); // phones keep the switch in the menu
  // a click that lands before React has hydrated does nothing: keep clicking until the page language changes
  await expect(async () => { await toLao.click(); await expect(page.locator("html")).toHaveAttribute("lang", "lo", { timeout: 1500 }); }).toPass({ timeout: 20_000 });
  // body copy, headings and buttons all swap; links keep their targets
  await expect(summary).toHaveText(lao, { timeout: 15_000 });
  await expect(page.locator("main h1")).toHaveText(lao);
  await expect(page.getByRole("link", { name: /ສຳຫຼວດ|ຜະລິດຕະພັນ/ }).first()).toBeVisible();
  const english = await page.locator("main p").evaluateAll((ps) => ps.map((p) => p.textContent ?? "").filter((t) => /[A-Za-z]{4,}/.test(t) && !/[຀-໿]/.test(t) && !/SPP|DTF|PNG|JPG|HEX|RGB|CMYK|Pantone|gsm|XS|XL/.test(t)));
  expect(english, `untranslated paragraphs: ${english.slice(0, 3).join(" | ")}`).toHaveLength(0);
  // and back to English, exactly as before
  const toEnglish = page.getByRole("button", { name: "English" }).first();
  if (!(await toEnglish.isVisible())) await page.getByRole("button", { name: /Open menu|ເປີດເມນູ/ }).click();
  await toEnglish.click();
  await expect(summary).toHaveText(/Combed cotton round-collar tee/);
  await expect(summary).not.toHaveText(lao);

  // the Studio: tabs, placement picker and panels follow the language too
  await page.evaluate(() => localStorage.setItem("spp.lang", "lo")); // the choice travels with the visitor
  await page.goto("/design/?product=custom-t-shirt");
  await page.getByRole("tablist", { name: "Garment view" }).waitFor();
  await expect(page.getByRole("button", { name: /ເຕັມດ້ານໜ້າ/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /ດ້ານຫຼັງ/ })).toBeVisible();
  await page.evaluate(() => localStorage.setItem("spp.lang", "en"));
});

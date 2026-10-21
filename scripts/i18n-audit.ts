/**
 * Lao coverage audit: opens every exported page in Chrome with the language
 * set to Lao, drives the states a visitor can reach without an account (Studio
 * panels and dialogs, quote-builder steps, form validation, billboard upload
 * controls, map filters), and reports every piece of visible English that is
 * left — text nodes and the attributes the translator covers.
 *
 *   npm run build && node scripts/serve-out.mjs 4173 &
 *   npx tsx scripts/i18n-audit.ts            → scripts/data/i18n-leftovers.json
 */
import { chromium, type Page } from "@playwright/test";
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const BASE = process.env.BASE_URL ?? "http://localhost:4173";
// Latin that is fine in Lao: brand, codes, units, file types, colour codes, sizes, prices
const ALLOWED = /^(SPP|My SPP|SPP Studio|Studio|Jarvis|WhatsApp|Facebook|Email|EN|ລາວ|OK|QR|LED|BB|DTF|PNG|JPG|JPEG|WebP|SVG|PDF|AI|EPS|HEX|RGB|CMYK|Pantone|gsm|px|pt|mm|cm|m|m²|kg|km|XS|S|M|L|XL|\d+XL|L\/XL|A\d|Aa|V\d+|R \d+|T\d|N|E|S|W|Do Not Track|Supabase|OpenStreetMap|geoBoundaries|Google Maps|Asia\/Vientiane|spp_sole@yahoo\.com|SPP-BB-\d+|SPP Sole Co\., Ltd|SOLE CO\., LTD|Co\., Ltd|CO|CREW|VIENTIANE FC|yourcompany\.la|Bricolage Grotesque|Instrument Serif Italic|Geist|JetBrains Mono|Noto Sans Lao|Grotesque|Design ID|ID|CC BY \d(\.\d)?|ODbL|WCAG \d(\.\d)?|AAA?|HEADLINE|CHAMPIONS|TEAM \d+|CREW \d+|BOOM!|GOOD VIBES|Est\. \d+|EST\. \d+ · VIENTIANE|Sabaidee|Riverside|Signature|hand made|with love|brand name|modern|Match Day|Kitchen Crew|Noodle|HOUSE|Stacked|Monogram|Chest Mark|Impact Block|Tall Condensed|Sport Block|Retro Rounded|Editorial Serif|Serif Italic|Brush Script|Retro Script|Marker|Handwritten|Clean Sans|Geometric Sans|Technical Mono|Lao Sans|Lao|Patuxai|Vientiane|Laos|Lao PDR|spp-logo(-mono-(ink|white))?\.svg|[A-Z]{2,4})$/;
const looksEnglish = (t: string) => /[A-Za-z]{3,}/.test(t) && !/[຀-໿]/.test(t) && !ALLOWED.test(t.trim()) && !/^[\d\s.,:;×+%°′″#()\-–—·/₭$€\w@]*$/.test(t.replace(/[A-Za-z]/g, "")) === false;

function* files(dir: string): Generator<string> {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (!/_next/.test(f)) yield* files(p); } else if (f.endsWith(".html")) yield p;
  }
}

const found = new Map<string, Set<string>>();
async function scan(page: Page, where: string) {
  await page.waitForTimeout(700);
  // passed as source text: tsx would otherwise inject helpers the page does not have
  const items = (await page.evaluate(`(() => {
    const out = [];
    const skip = (el) => !!(el && el.closest("script,style,noscript,svg,code,pre,textarea,[lang='lo'],[data-no-translate],[data-i18n-slot]"));
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const t = (n.textContent || "").replace(/\s+/g, " ").trim();
      if (!t || skip(n.parentElement)) continue;
      const cs = getComputedStyle(n.parentElement);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      out.push("T " + t);
    }
    for (const el of document.querySelectorAll("[placeholder],[aria-label],[title],img[alt]")) {
      if (skip(el)) continue;
      for (const a of ["placeholder", "aria-label", "title", "alt"]) { const v = el.getAttribute(a); if (v) out.push("A " + v.replace(/\s+/g, " ").trim()); }
    }
    out.push("T " + document.title);
    return out;
  })()`)) as string[];
  for (const it of items) {
    const text = it.slice(2);
    if (!/[A-Za-z]{3,}/.test(text) || /[຀-໿]/.test(text)) continue;
    const core = text.replace(/\d+/g, "").trim();
    if (ALLOWED.test(core) || ALLOWED.test(text)) continue;
    // every Latin word allowed on its own means the string is fine (e.g. "SPP · DTF")
    const words = text.split(/[^A-Za-z]+/).filter((w) => w.length >= 3);
    if (words.every((w) => ALLOWED.test(w))) continue;
    let s = found.get(it); if (!s) found.set(it, (s = new Set())); s.add(where);
  }
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem("spp.lang", "lo"));
  const page = await ctx.newPage();
  const pages = [...files(join(ROOT, "out"))].filter((p) => !/\/(admin|account|_not-found)\b/.test(p)).sort();
  for (const file of pages) {
    const url = BASE + "/" + relative(join(ROOT, "out"), file).replace(/index\.html$/, "").replace(/\.html$/, "/");
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await scan(page, url);
    process.stdout.write(".");
  }
  console.log("\nstatic pages done — now the interactive states");

  // ── Studio: every panel, the placement picker, the Visualise dialog and its tabs
  await page.goto(BASE + "/design/?product=custom-t-shirt", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  for (const name of ["ແມ່ແບບ", "ຂໍ້ຄວາມ", "ອົງປະກອບ", "ອັບໂຫຼດ", "Jarvis", "ຊັ້ນ", "ກວດກ່ອນພິມ", "ຜະລິດຕະພັນ"]) {
    const b = page.getByRole("button", { name, exact: true }).first();
    if (await b.count()) { await b.click(); await scan(page, "studio:" + name); }
  }
  // add a headline and a shape, select it (inspector), run preflight with something to say
  await page.getByRole("button", { name: "ຂໍ້ຄວາມ", exact: true }).first().click();
  await page.getByRole("button", { name: /HEADLINE/ }).first().click();
  await page.waitForTimeout(400);
  await scan(page, "studio:text-selected");
  await page.getByRole("button", { name: "ກວດກ່ອນພິມ", exact: true }).first().click();
  await scan(page, "studio:preflight-with-art");
  await page.getByRole("button", { name: /VISUALISE|ເບິ່ງຕົວຢ່າງ/i }).first().click();
  await page.waitForTimeout(1500);
  await scan(page, "studio:visualise");
  for (const tab of ["3D", /ຮຽງແຖວທີມ|Team line-up/, /ແຂວນ|On the rail/]) {
    const t = page.getByRole("tab", { name: tab }).first();
    if (await t.count()) { await t.click(); await page.waitForTimeout(1200); await scan(page, "studio:visualise-tab"); }
  }
  await page.keyboard.press("Escape");
  for (const slug of ["sports-cap", "tote-bag", "polo-shirt"]) {
    await page.goto(BASE + `/design/?product=${slug}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await scan(page, "studio:" + slug);
  }

  // ── quote builder: add a product, open each step, trigger validation
  await page.goto(BASE + "/request-quote/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const add = page.getByRole("button", { name: /^(ເພີ່ມ|Add)$/ }).first();
  if (await add.count()) { await add.click(); await page.waitForTimeout(500); await scan(page, "quote:line-added"); }
  const submit = page.getByRole("button", { name: /ຂໍໃບສະເໜີລາຄາ|Request a quote|Send/ }).last();
  if (await submit.count()) { await submit.click({ force: true }).catch(() => {}); await page.waitForTimeout(800); await scan(page, "quote:validation"); }

  // ── consultation + contact validation
  for (const [url, btn] of [["/consultation/", /ຂໍເວລານີ້|Request this time/], ["/contact/", /ສົ່ງຂໍ້ຄວາມ|Send message/]] as const) {
    await page.goto(BASE + url, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const b = page.getByRole("button", { name: btn }).first();
    if (await b.count()) { await b.click({ force: true }).catch(() => {}); await page.waitForTimeout(800); await scan(page, url + "validation"); }
  }

  // ── billboard page: night mode, driver distance, enquiry form
  await page.goto(BASE + "/billboards/SPP-BB-001/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  for (const name of [/ກາງຄືນ|Night/, /ຜູ້ຂັບລົດ|Driver/]) { const b = page.getByRole("button", { name }).first(); if (await b.count()) { await b.click().catch(() => {}); await page.waitForTimeout(400); } }
  await scan(page, "billboard:night-driver");
  const req = page.getByRole("button", { name: /ສົ່ງທາງ WhatsApp|Send on WhatsApp/ }).first();
  if (await req.count()) { await req.click({ force: true }).catch(() => {}); await page.waitForTimeout(800); await scan(page, "billboard:validation"); }

  // ── solutions: project builder step, campaign builder
  await page.goto(BASE + "/solutions/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const cont = page.getByRole("button", { name: /ຕໍ່ໄປ|Continue/ }).first();
  if (await cont.count()) { await cont.click({ force: true }).catch(() => {}); await page.waitForTimeout(600); await scan(page, "solutions:step2"); }

  await browser.close();
  const out = [...found].sort(([a], [b]) => a.localeCompare(b)).map(([k, w]) => ({ text: k.slice(2), kind: k[0] === "A" ? "attribute" : "text", where: [...w].slice(0, 3) }));
  writeFileSync(join(ROOT, "scripts/data/i18n-leftovers.json"), JSON.stringify(out, null, 1));
  console.log(`${out.length} English leftovers → scripts/data/i18n-leftovers.json`);
}
main().catch((e) => { console.error(e); process.exit(1); });

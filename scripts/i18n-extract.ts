/**
 * Gathers every English segment the whole-page Lao layer could translate:
 *   1. every exported page (out/**\/*.html) opened in Chrome, read with the SAME
 *      collectSegments() the live page uses;
 *   2. text and labels written in JSX in the client-side parts of the site
 *      (dialogs, panels, toasts), which the exported HTML does not show.
 * Writes scripts/data/i18n-segments.json (every key, with where it was seen)
 * and reports which keys src/content/lao/segments.json does not translate yet.
 *
 *   npm run build && node scripts/serve-out.mjs 4173 &   # the exported site
 *   npx tsx scripts/i18n-extract.ts
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { keyOf, worthTranslating } from "../src/lib/i18n/segments";

const ROOT = join(__dirname, "..");
const BASE = process.env.BASE_URL ?? "http://localhost:4173";

function* files(dir: string, ext: RegExp): Generator<string> {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (!/node_modules|_next/.test(f)) yield* files(p, ext); }
    else if (ext.test(f)) yield p;
  }
}

const seen = new Map<string, Set<string>>();
const attrsSeen = new Map<string, Set<string>>();
const note = (map: Map<string, Set<string>>, key: string, where: string) => { let s = map.get(key); if (!s) map.set(key, (s = new Set())); s.add(where); };

async function main() {
// ── 1 · the exported pages, read in the browser with the real collector
const src = readFileSync(join(ROOT, "src/lib/i18n/dom-translator.ts"), "utf8").replace(/^import .*$/m, "") + "\n" + readFileSync(join(ROOT, "src/lib/i18n/segments.ts"), "utf8");
const js = ts.transpileModule(src.replace(/^export /gm, ""), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText + "\nwindow.__collect = () => collectSegments(document.body);";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
const pages = [...files(join(ROOT, "out"), /\.html$/)].filter((p) => !/\/(admin|account|_not-found)\b/.test(p)) // the 404 page is public and translated too.sort();
for (const file of pages) {
  const url = BASE + "/" + relative(join(ROOT, "out"), file).replace(/index\.html$/, "").replace(/\.html$/, "/");
  await page.goto(url, { waitUntil: "networkidle" });
  await page.addScriptTag({ content: js });
  const got = (await page.evaluate("window.__collect()")) as { segments: string[]; attrs: string[] };
  for (const k of got.segments) note(seen, k, url);
  for (const k of got.attrs) note(attrsSeen, k, url);
  process.stdout.write(`${url}  ${got.segments.length} segments\n`);
}
await browser.close();

// ── 2 · JSX text and labels in client-side components the exported HTML never shows
const ATTR_NAMES = new Set(["placeholder", "aria-label", "title", "alt", "label", "aria-description"]);
const SRC_DIRS = ["src/components", "src/app/(site)", "src/app/account", "src/app/design", "src/app/login", "src/app/register", "src/lib/studio", "src/lib/jarvis.ts", "src/lib/backend/api.ts"];
for (const dir of SRC_DIRS) {
  const abs = join(ROOT, dir);
  const list = statSync(abs).isDirectory() ? [...files(abs, /\.tsx?$/)] : [abs];
  for (const file of list) {
    if (/\/admin\//.test(file)) continue;
    const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const where = relative(ROOT, file);
    const add = (text: string, attr = false) => {
      const { key } = keyOf(text);
      if (worthTranslating(key)) note(attr ? attrsSeen : seen, key, where);
    };
    const visit = (n: ts.Node) => {
      if (ts.isJsxText(n)) {
        const t = n.getText().replace(/\s+/g, " ").trim();
        // only a text run that is a whole segment on its own is useful here; mixed runs come from the pages
        if (t && /^[^{}<>]+$/.test(t) && ts.isJsxElement(n.parent) && n.parent.children.every((c) => ts.isJsxText(c))) add(t);
      } else if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer) && ATTR_NAMES.has(n.name.getText())) add(n.initializer.text, n.name.getText() !== "label");
      else if (ts.isJsxExpression(n) && n.expression && ts.isStringLiteral(n.expression) && ts.isJsxElement(n.parent)) add(n.expression.text);
      else if (ts.isPropertyAssignment(n) && ts.isStringLiteral(n.initializer) && /^(title|label|body|detail|text|summary|hint|message|blurb|caption|description|placeholder|question|answer|name|eyebrow|cta|note|help)$/.test(n.name.getText()) && n.initializer.text.length > 2) add(n.initializer.text);
      else if (ts.isCallExpression(n) && /^(toast|setError|setMessage)$/.test(n.expression.getText()) && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) add(n.arguments[0].text);
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
}

}

// ── 3 · write out and report
async function report() {
const existing = JSON.parse(readFileSync(join(ROOT, "src/content/lao/segments.json"), "utf8")) as { segments: Record<string, string>; attrs: Record<string, string> };
const out = {
  // in the order they were met, page by page, so a translator reads them in context
  segments: Object.fromEntries([...seen].map(([k, w]) => [k, [...w].slice(0, 4)])),
  attrs: Object.fromEntries([...attrsSeen].map(([k, w]) => [k, [...w].slice(0, 4)])),
};
writeFileSync(join(ROOT, "scripts/data/i18n-segments.json"), JSON.stringify(out, null, 1));
const missing = { segments: Object.keys(out.segments).filter((k) => !existing.segments[k]), attrs: Object.keys(out.attrs).filter((k) => !existing.attrs[k]) };
writeFileSync(join(ROOT, "scripts/data/i18n-pending.json"), JSON.stringify(missing, null, 1));
// batches of pending keys, grouped by where they were first seen, for translating in context
const groupOf = (w: string) => (w.startsWith("http") ? new URL(w).pathname.split("/")[1] || "home" : w.split("/").slice(0, 3).join("/"));
const batches = new Map<string, Record<string, string>>();
for (const k of missing.segments) { const g = groupOf(out.segments[k]![0]!); let b = batches.get(g); if (!b) batches.set(g, (b = {})); b[k] = ""; }
for (const k of missing.attrs) { const g = "attrs"; let b = batches.get(g); if (!b) batches.set(g, (b = {})); b[k] = ""; }
mkdirSync(join(ROOT, "scripts/data/pending"), { recursive: true });
for (const f of readdirSync(join(ROOT, "scripts/data/pending"))) rmSync(join(ROOT, "scripts/data/pending", f));
for (const [g, b] of batches) {
  const keys = Object.keys(b);
  for (let i = 0; i < keys.length; i += 110) writeFileSync(join(ROOT, `scripts/data/pending/${g.replace(/[^a-z0-9()-]+/gi, "-")}-${String(i / 110 + 1).padStart(2, "0")}.json`), JSON.stringify(Object.fromEntries(keys.slice(i, i + 110).map((k) => [k, ""])), null, 1));
}
const chars = (ks: string[]) => ks.reduce((n, k) => n + k.length, 0);
console.log(`\n${Object.keys(out.segments).length} segments (${chars(Object.keys(out.segments))} chars), ${Object.keys(out.attrs).length} attributes — pending: ${missing.segments.length} segments (${chars(missing.segments)} chars), ${missing.attrs.length} attributes`);
}

main().then(report).catch((e) => { console.error(e); process.exit(1); });

/**
 * Rasterises the share image and the Apple touch icon from SVG composed here,
 * so both stay in step with the wordmark geometry in src/components/brand/Logo.tsx.
 *
 *   npx tsx scripts/build-og.ts
 *
 * Text is set in system fonts (librsvg cannot see the site's self-hosted
 * webfonts); the wordmark itself is pure path data and renders identically anywhere.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { LOGO_DOT, LOGO_PATHS } from "../src/components/brand/Logo";
import { settings } from "../src/content/seed/settings";

const root = path.resolve(__dirname, "..");
const INK = "#09090a";
const FOG = "#f6f4ef";
const YELLOW = "#ffd60a";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const SERIF = "'Times New Roman', Times, serif";
const MONO = "Menlo, 'SF Mono', 'Courier New', monospace";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const mark = (stroke: string, dot: string) =>
  `<g fill="none" stroke="${stroke}" stroke-width="20">${Object.values(LOGO_PATHS).map((d) => `<path d="${d}"/>`).join("")}</g><circle cx="${LOGO_DOT.cx}" cy="${LOGO_DOT.cy}" r="${LOGO_DOT.r}" fill="${dot}"/>`;

const [line1 = "", line2 = "", ...restWords] = settings.tagline.split(/(?<=\.)\s+/);
const line3 = restWords.join(" ");
const lastWord = line3.split(" ").pop() ?? "";
const line3Lead = line3.slice(0, line3.length - lastWord.length);

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <pattern id="dots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="1.4" fill="${FOG}"/></pattern>
    <radialGradient id="fade" cx="82%" cy="30%" r="60%"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <mask id="m"><rect width="1200" height="630" fill="url(#fade)"/></mask>
  </defs>
  <rect width="1200" height="630" fill="${INK}"/>
  <rect width="1200" height="630" fill="url(#dots)" mask="url(#m)"/>
  <g stroke="#4a4a52" stroke-width="2"><path d="M40 70H64M70 40V64M1160 70H1136M1130 40V64M40 560H64M70 590V566M1160 560H1136M1130 590V566"/></g>
  <g transform="translate(96 104) scale(1.5)">${mark(FOG, YELLOW)}</g>
  <g fill="none" stroke="${YELLOW}" stroke-width="2"><circle cx="1086" cy="122" r="16"/><path d="M1060 122H1112M1086 96V148"/></g>
  <g font-family="${SANS}" font-weight="700" font-size="76" letter-spacing="-3" fill="${FOG}">
    <text x="92" y="388">${esc(line1)} ${esc(line2)}</text>
    <text x="92" y="472">${esc(line3Lead)}<tspan font-family="${SERIF}" font-style="italic" font-weight="400" letter-spacing="-1" fill="${YELLOW}">${esc(lastWord.toLowerCase())}</tspan></text>
  </g>
  <text x="96" y="548" font-family="${MONO}" font-size="19" letter-spacing="3.4" fill="#a19e97">APPAREL · PRINT · SIGNAGE · BILLBOARDS — ${esc(settings.address.city.toUpperCase())}, ${esc(settings.address.country.toUpperCase())}</text>
  <g transform="translate(0 618)"><rect width="300" height="12" fill="#00aeef"/><rect x="300" width="300" height="12" fill="#ec008c"/><rect x="600" width="300" height="12" fill="${YELLOW}"/><rect x="900" width="300" height="12" fill="#1a1a1e"/></g>
</svg>`;

// Apple masks the corners itself, so the plate runs full-bleed with no crop marks near the edge.
const apple = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 128 128">
  <rect width="128" height="128" fill="${YELLOW}"/>
  <g transform="translate(18 42) scale(0.426)">${mark("#0a0a0b", "#0a0a0b")}</g>
</svg>`;

async function main() {
  await mkdir(path.join(root, "public"), { recursive: true });
  await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile(path.join(root, "public/og.png"));
  await sharp(Buffer.from(apple), { density: 144 }).resize(180, 180).png({ compressionLevel: 9 }).toFile(path.join(root, "src/app/apple-icon.png"));
  process.stdout.write("wrote public/og.png (1200×630) and src/app/apple-icon.png (180×180)\n");
}

main().catch((e) => { process.stderr.write(`${(e as Error).message}\n`); process.exit(1); });

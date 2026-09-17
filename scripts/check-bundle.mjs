// Release gate: scans the static export for things that must never ship.
//  1. secrets (service-role keys, API keys, tokens)
//  2. hosts the client's ISP blocks, or third-party runtime CDNs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = "out";
const rules = [
  [/sk-ant-[A-Za-z0-9_-]{10,}/, "Anthropic API key"],
  [/service_role/, "Supabase service-role reference"],
  [/github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{30,}/, "GitHub token"],
  [/re_[A-Za-z0-9]{20,}_[A-Za-z0-9]{10,}/, "Resend API key"],
  [/-----BEGIN (RSA |EC )?PRIVATE KEY-----/, "private key"],
  [/https?:\/\/[a-z0-9.-]*\.(vercel\.app|pages\.dev|web\.app|onrender\.com)\b/i, "host blocked by the client's ISP"],
  [/https?:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\b/i, "third-party runtime CDN"],
  [/@vercel\//, "Vercel package"],
];
const found = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(html|js|css|json|txt|xml|webmanifest|svg)$/.test(name)) {
      const text = readFileSync(p, "utf8");
      for (const [re, label] of rules) { const m = re.exec(text); if (m) found.push(`${label}: ${p}  →  ${m[0].slice(0, 60)}`); }
    }
  }
};
try { walk(root); } catch { console.error("No ./out folder — run `npm run build` first."); process.exit(1); }
if (found.length) { console.error(`✗ ${found.length} problem(s) in the shipped bundle:\n` + found.map((f) => "  " + f).join("\n")); process.exit(1); }
console.log("✓ bundle clean: no secrets, no blocked hosts, no third-party CDNs");

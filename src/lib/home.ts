import { z } from "zod";
import { PRINT_STYLES } from "@/components/hero/prints";
import { blank, blankSection, defaultHome, HOME_SECTION_ORDER, link } from "@/content/seed/home";
import type { Bilingual, HomeConfig, HomeLink, HomeSection, HomeSectionKey } from "@/content/types";

/**
 * The `home` settings row, read defensively. Whatever is stored — nothing, an
 * older shape, a hand-edited value — the result is always a complete
 * HomeConfig: a bad field falls back to its default, an over-long text is cut
 * to its limit, an unknown section is ignored and a missing one is put back in
 * its designed place. Reading can therefore never break the site build.
 */
export const HOME_LIMITS = { word: 22, eyebrow: 80, title: 140, lede: 400, body: 600, label: 40, announcement: 160, href: 300, seoTitle: 80, seoDescription: 200, products: 12, projects: 6, categories: 24, faqs: 12, faqLimit: 12 } as const;

export const HOME_SECTION_KEYS = HOME_SECTION_ORDER;
export const isHomeSectionKey = (v: unknown): v is HomeSectionKey => typeof v === "string" && (HOME_SECTION_KEYS as readonly string[]).includes(v);

/** A site path ("/products/", "/solutions/?goal=x") or a full https:// address. Never protocol-relative, never javascript:. */
export const isHomeHref = (v: string) => v.length <= HOME_LIMITS.href && /^(\/(?!\/)[^\s]*|https:\/\/[^\s/]+[^\s]*)$/.test(v);

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (max: number) => z.string().catch("").transform((s) => s.trim().slice(0, max).trim());
const bilingual = (max: number) => z.object({ en: text(max), lo: text(max) }).catch(() => blank());
const href = z.string().catch("").transform((s) => (isHomeHref(s.trim()) ? s.trim() : ""));
const button = (fallback: string) => z.object({ label: bilingual(HOME_LIMITS.label), href }).catch(() => link(fallback));
const list = (ok: (s: string) => boolean, max: number) => z.array(z.unknown()).catch([]).transform((a) => [...new Set(a.filter((v): v is string => typeof v === "string" && ok(v)))].slice(0, max));

const sectionSchema = z.object({
  key: z.enum(HOME_SECTION_KEYS as [HomeSectionKey, ...HomeSectionKey[]]),
  visible: z.boolean().catch(true),
  eyebrow: bilingual(HOME_LIMITS.eyebrow),
  title: bilingual(HOME_LIMITS.title),
  lede: bilingual(HOME_LIMITS.lede),
  body: bilingual(HOME_LIMITS.body),
  categories: list((s) => SLUG.test(s), HOME_LIMITS.categories),
  products: list((s) => SLUG.test(s), HOME_LIMITS.products),
  projects: list((s) => SLUG.test(s), HOME_LIMITS.projects),
  faqIds: list((s) => UUID.test(s), HOME_LIMITS.faqs),
  faqLimit: z.number().int().min(1).max(HOME_LIMITS.faqLimit).catch(5),
  primary: button(""),
  secondary: button(""),
});

const STYLE_NAMES = PRINT_STYLES.map((s) => s.name);

const heroSchema = z.object({
  word: z.string().catch("").transform((s) => s.trim().slice(0, HOME_LIMITS.word).trim() || "SPP"),
  styles: list((s) => STYLE_NAMES.includes(s), STYLE_NAMES.length),
  eyebrow: bilingual(HOME_LIMITS.eyebrow),
  line1: bilingual(HOME_LIMITS.label),
  line2: bilingual(HOME_LIMITS.label),
  line3: bilingual(HOME_LIMITS.label),
  accent: bilingual(HOME_LIMITS.label),
  lede: bilingual(HOME_LIMITS.lede),
  primaryCta: button("/request-quote/"),
  secondaryCta: button("/services/"),
});

const announcementSchema = z.object({
  visible: z.boolean().catch(false),
  text: bilingual(HOME_LIMITS.announcement),
  href,
  tone: z.enum(["gold", "navy"]).catch("gold"),
});

const seoSchema = z.object({
  title: z.object({ en: text(HOME_LIMITS.seoTitle) }).catch(() => ({ en: "" })),
  description: z.object({ en: text(HOME_LIMITS.seoDescription) }).catch(() => ({ en: "" })),
});

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function readSections(raw: unknown): HomeSection[] {
  const out: HomeSection[] = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    // a row from an older shape may lack fields: start from the blank section so every key exists
    const key = obj(item).key;
    if (!isHomeSectionKey(key) || out.some((s) => s.key === key)) continue;
    const r = sectionSchema.safeParse({ ...blankSection(key), ...obj(item) });
    if (r.success) out.push(r.data);
  }
  // Sections the stored value does not know (added to the site later) go back where they were designed to sit.
  HOME_SECTION_KEYS.forEach((key, i) => {
    if (out.some((s) => s.key === key)) return;
    const before = HOME_SECTION_KEYS.slice(0, i).reverse().find((k) => out.some((s) => s.key === k));
    out.splice(before ? out.findIndex((s) => s.key === before) + 1 : 0, 0, blankSection(key));
  });
  return out;
}

export function parseHome(value: unknown): HomeConfig {
  const d = defaultHome();
  const v = obj(value);
  const part = <T>(schema: z.ZodType<T>, input: unknown, fallback: T): T => {
    const r = schema.safeParse(input);
    return r.success ? r.data : fallback;
  };
  const hero = obj(v.hero);
  const announcement = part(announcementSchema, { ...d.announcement, ...obj(v.announcement) }, d.announcement);
  return {
    // a bar with nothing to say is never shown
    announcement: { ...announcement, visible: announcement.visible && Boolean(announcement.text.en || announcement.text.lo) },
    hero: part(heroSchema, { ...d.hero, ...hero }, d.hero),
    sections: readSections(v.sections),
    seo: part(seoSchema, { ...d.seo, ...obj(v.seo) }, d.seo),
  };
}

/** What the editor refuses to save, as `path → message`. Reading stays lenient; writing is strict. */
export function validateHome(c: HomeConfig): Record<string, string> {
  const e: Record<string, string> = {};
  const over = (path: string, b: Bilingual | { en: string }, max: number) => {
    for (const [lang, s] of Object.entries(b)) if (s.length > max) e[`${path}.${lang}`] = `Keep this under ${max} characters.`;
  };
  const url = (path: string, v: string, required = false) => {
    if (!v.trim()) { if (required) e[path] = "Choose where this button goes."; return; }
    if (!isHomeHref(v.trim())) e[path] = "Use a page from the list, or a full address starting with https://";
  };
  const btn = (path: string, b: HomeLink, required = false) => { over(`${path}.label`, b.label, HOME_LIMITS.label); url(`${path}.href`, b.href, required); };

  if (!c.hero.word.trim()) e["hero.word"] = "Enter the word to print — for example SPP.";
  else if (c.hero.word.trim().length > HOME_LIMITS.word) e["hero.word"] = `Keep the word to ${HOME_LIMITS.word} characters or fewer.`;
  if (c.hero.styles.some((s) => !STYLE_NAMES.includes(s))) e["hero.styles"] = "One of the print styles no longer exists. Untick it and save again.";
  over("hero.eyebrow", c.hero.eyebrow, HOME_LIMITS.eyebrow);
  for (const k of ["line1", "line2", "line3", "accent"] as const) over(`hero.${k}`, c.hero[k], HOME_LIMITS.label);
  over("hero.lede", c.hero.lede, HOME_LIMITS.lede);
  btn("hero.primaryCta", c.hero.primaryCta, true);
  btn("hero.secondaryCta", c.hero.secondaryCta);

  over("announcement.text", c.announcement.text, HOME_LIMITS.announcement);
  if (c.announcement.visible && !c.announcement.text.en.trim() && !c.announcement.text.lo.trim()) e["announcement.text.en"] = "Write the announcement, or switch the bar off.";
  url("announcement.href", c.announcement.href);

  for (const s of c.sections) {
    const p = `sections.${s.key}`;
    over(`${p}.eyebrow`, s.eyebrow, HOME_LIMITS.eyebrow);
    over(`${p}.title`, s.title, HOME_LIMITS.title);
    over(`${p}.lede`, s.lede, HOME_LIMITS.lede);
    over(`${p}.body`, s.body, HOME_LIMITS.body);
    if (s.products.length > HOME_LIMITS.products) e[`${p}.products`] = `Choose up to ${HOME_LIMITS.products} products.`;
    if (s.projects.length > HOME_LIMITS.projects) e[`${p}.projects`] = `Choose up to ${HOME_LIMITS.projects} projects.`;
    if (s.faqIds.length > HOME_LIMITS.faqs) e[`${p}.faqIds`] = `Choose up to ${HOME_LIMITS.faqs} questions.`;
    if (!Number.isInteger(s.faqLimit) || s.faqLimit < 1 || s.faqLimit > HOME_LIMITS.faqLimit) e[`${p}.faqLimit`] = `Show between 1 and ${HOME_LIMITS.faqLimit} questions.`;
    if (s.key === "cta") { btn(`${p}.primary`, s.primary, true); btn(`${p}.secondary`, s.secondary); }
  }

  over("seo.title", c.seo.title, HOME_LIMITS.seoTitle);
  over("seo.description", c.seo.description, HOME_LIMITS.seoDescription);
  return e;
}

/** Sections that carry a "Plate NN" marker. `blocks` is free-form content and the closing band has none. */
const PLATED: readonly HomeSectionKey[] = ["manifesto", "plates", "goals", "studio", "outdoor", "capabilities", "featured", "work", "testimonials", "faq", "connect"];
/** The numbers the page was designed with (Get in touch shares 09 with the FAQ, because testimonials are usually absent). */
const DESIGNED: Partial<Record<HomeSectionKey, string>> = { manifesto: "01", plates: "02", goals: "03", studio: "04", outdoor: "05", capabilities: "06", work: "07", testimonials: "08", faq: "09", connect: "09" };

/**
 * Plate numbers for the sections that will actually be drawn (`shown`, in page
 * order). The designed page keeps its designed numbers; once staff reorder,
 * hide or add a section the plates simply count up in the order they appear.
 */
export function plateNumbers(sections: HomeSection[], shown: readonly HomeSectionKey[]): Partial<Record<HomeSectionKey, string>> {
  const designed = sections.every((s, i) => s.key === HOME_SECTION_KEYS[i] && s.visible) && !shown.includes("featured");
  if (designed) return DESIGNED;
  const out: Partial<Record<HomeSectionKey, string>> = {};
  let n = 0;
  for (const key of shown) if (PLATED.includes(key)) out[key] = String(++n).padStart(2, "0");
  return out;
}

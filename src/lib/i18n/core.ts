import { en, type Key } from "./en";
import { lo } from "./lo";

/**
 * The pure half of the i18n layer: no React, no browser APIs, so it can be
 * unit-tested and imported from anywhere. The client half is `./index.tsx`.
 */
export type { Key };
export type Lang = "en" | "lo";
export type Vars = Record<string, string | number>;

export const LANGS: readonly Lang[] = ["en", "lo"];
export const DEFAULT_LANG: Lang = "en";
export const STORAGE_KEY = "spp.lang";
export const dictionaries: Record<Lang, Record<Key, string>> = { en, lo };

export const isLang = (v: unknown): v is Lang => v === "en" || v === "lo";

/** Fills `{name}` placeholders; an unknown placeholder is left as written so a slip is visible, not silent. */
export const interpolate = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s);

/** Lao falls back to English rather than ever showing a raw key. */
export const translate = (lang: Lang, key: Key, vars?: Vars) => interpolate(dictionaries[lang][key] ?? en[key], vars);

export type TFn = (key: Key, vars?: Vars) => string;

/**
 * English literals that pages pass to shared chrome (CtaBand, PageHero…) as
 * plain strings. Mapping them here lets server pages stay untouched while the
 * chrome still speaks Lao. Anything not listed renders as authored.
 */
const LITERALS: Record<string, Key> = {
  "Start a project": "common.startProject",
  "Request a quote": "common.requestQuote",
  "Open SPP Studio": "common.openStudio",
  "Let's talk": "common.letsTalk",
  "Build my project": "common.buildProject",
  "Start from a goal": "common.startFromGoal",
  "Book a consultation": "common.bookConsultation",
  "Contact SPP": "common.contactSpp",
  "Explore the catalogue": "common.exploreCatalogue",
  "Explore billboards": "common.exploreBillboards",
  "See bundles": "common.seeBundles",
  "Start from a template": "common.startFromTemplate",
  "Explore our services": "common.exploreServices",
  "Design something": "common.designSomething",
  "Upload artwork": "common.uploadArtwork",
  "Download logos": "common.downloadLogos",
  "See it applied": "common.seeApplied",
  "WhatsApp SPP": "common.whatsappSpp",
  "Email SPP": "common.emailSpp",
  "Services": "hero.services",
  "Solutions": "hero.solutions",
  "SPP Studio": "hero.studio",
  "Portfolio": "hero.portfolio",
  "Journal": "hero.journal",
  "Smart quote builder": "hero.quote",
  "Contact": "hero.contact",
  "Consultation": "hero.consultation",
  "SPP Outdoor Network": "hero.billboards",
  "Privacy": "hero.privacy",
  "Terms": "hero.terms",
  "SPP brand guidelines": "hero.brand",
  "How it works": "hero.howItWorks",
  "Templates": "hero.templates",
  "What you can design": "hero.whatYouCanDesign",
  "SPP Project Builder": "sol.pbEyebrow",
  "Campaign Builder": "sol.cbEyebrow",
  "Bundles": "sol.bundlesEyebrow",
  "Sign in": "auth.plateSignIn",
  "Create account": "auth.plateCreate",
  // messages written by the shared contact schema in lib/backend/api.ts
  "Please tell us your name.": "auth.errName",
  "That email address does not look right.": "auth.errEmail",
  "That phone number does not look right.": "auth.errPhone",
  "Please give us an email or a phone number.": "form.errContact",
};

/** Typographic and straight apostrophes are the same phrase. */
export const keyForLiteral = (text: string): Key | undefined => LITERALS[text.replace(/[‘’]/g, "'").trim()];

/** Translates a known English literal; returns the text unchanged when it is not a known phrase or the language is English. */
export const translateLiteral = (lang: Lang, text: string) => {
  const key = keyForLiteral(text);
  return key && lang !== "en" ? translate(lang, key) : text;
};

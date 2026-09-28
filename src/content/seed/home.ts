import type { Bilingual, HomeConfig, HomeLink, HomeSection, HomeSectionKey } from "../types";

/**
 * The landing page as designed. Every text field is EMPTY on purpose: empty
 * means "use the wording built into the site", so this file invents nothing and
 * the page renders exactly as it did before the Home page editor existed.
 * Staff change it in Command Center → CMS → Home page; the seed never
 * overwrites what they saved (`on conflict (key) do nothing`).
 */
export const HOME_SECTION_ORDER: readonly HomeSectionKey[] = ["manifesto", "plates", "goals", "studio", "outdoor", "capabilities", "featured", "work", "testimonials", "faq", "blocks", "connect", "cta"];

export const blank = (): Bilingual => ({ en: "", lo: "" });
export const link = (href: string): HomeLink => ({ label: blank(), href });

export const blankSection = (key: HomeSectionKey): HomeSection => ({
  key,
  visible: true,
  eyebrow: blank(),
  title: blank(),
  lede: blank(),
  body: blank(),
  categories: [],
  products: [],
  projects: [],
  faqIds: [],
  faqLimit: 5,
  primary: link(key === "cta" ? "/request-quote/" : ""),
  secondary: link(key === "cta" ? "/consultation/" : ""),
});

/** A fresh copy each time, so nobody can mutate the defaults by accident. */
export const defaultHome = (): HomeConfig => ({
  announcement: { visible: false, text: blank(), href: "", tone: "gold" },
  hero: {
    word: "SPP",
    styles: [],
    eyebrow: blank(),
    line1: blank(),
    line2: blank(),
    line3: blank(),
    accent: blank(),
    lede: blank(),
    primaryCta: link("/request-quote/"),
    secondaryCta: link("/services/"),
  },
  sections: HOME_SECTION_ORDER.map(blankSection),
  seo: { title: { en: "" }, description: { en: "" } },
});

export const home: HomeConfig = defaultHome();

import { HOME_DEFAULTS } from "@/components/home/defaults";
import type { Bilingual, HomeSectionKey } from "@/content/types";
import { HOME_LIMITS } from "@/lib/home";
import { en } from "@/lib/i18n/en";
import { lo } from "@/lib/i18n/lo";

/* What the Home page editor shows for each part of the landing page: a plain
   name, what the section is and where its list comes from, and the text fields
   it accepts — each with the wording the site uses while the field is empty. */

export type CopyName = "eyebrow" | "title" | "lede" | "body";
export type CopyMeta = { name: CopyName; label: string; max: number; rows?: number; /** *asterisks* mark the accent word */ accent?: boolean; fallback: Bilingual; hint?: string };

const only = (text: string): Bilingual => ({ en: text, lo: "" });
const field = (name: CopyName, label: string, max: number, fallback: Bilingual, extra: Partial<CopyMeta> = {}): CopyMeta => ({ name, label, max, fallback, ...extra });
const eyebrow = (text: string | Bilingual) => field("eyebrow", "Small label", HOME_LIMITS.eyebrow, typeof text === "string" ? only(text) : text, { hint: "The short line above the headline, beside the plate number." });
const title = (text: string | Bilingual) => field("title", "Headline", HOME_LIMITS.title, typeof text === "string" ? only(text) : text, { accent: true, rows: 2 });
const lede = (text: string | Bilingual) => field("lede", "Introduction", HOME_LIMITS.lede, typeof text === "string" ? only(text) : text, { rows: 4 });

export type SectionMeta = {
  label: string;
  /** what the visitor sees */
  blurb: string;
  /** where the section's list is edited, when it has one */
  source?: { text: string; href: string; label: string };
  fields: CopyMeta[];
};

const D = HOME_DEFAULTS;

export const SECTION_META: Record<HomeSectionKey, SectionMeta> = {
  manifesto: { label: "Position statement", blurb: "The gold band under the hero: what SPP stands for, and the five verbs from Ideate to Promote.", fields: [eyebrow(D.manifesto.eyebrow), field("title", "Headline", HOME_LIMITS.title, only(D.manifesto.title), { accent: true, rows: 2 }), lede(D.manifesto.lede)] },
  plates: { label: "How we work (five plates)", blurb: "The scrolling story of the five steps — Idea, Design, Visualise, Produce, Promote — each with its drawing.", fields: [eyebrow(D.plates.eyebrow), title(D.plates.title), lede(D.plates.lede)] },
  goals: { label: "Start from a goal", blurb: "The list of goals a visitor can start from. Each one opens the Project Builder.", source: { text: "The goals themselves are edited in", href: "/admin/cms/?tab=solutions", label: "CMS → Solutions" }, fields: [eyebrow(D.goals.eyebrow), title(D.goals.title), lede(D.goals.lede)] },
  studio: { label: "SPP Studio", blurb: "Introduces the online designer with up to four design templates.", source: { text: "The templates shown are the ones marked Featured in", href: "/admin/cms/?tab=templates", label: "CMS → Design templates" }, fields: [eyebrow(D.studio.eyebrow), title(D.studio.title), lede(D.studio.lede)] },
  outdoor: { label: "Billboards", blurb: "The billboard network in figures, counted from the published sites. Hidden automatically while no site is published.", source: { text: "Sites are managed in", href: "/admin/billboards/", label: "Billboards" }, fields: [eyebrow(D.outdoor.eyebrow), title(D.outdoor.title), lede(D.outdoor.lede)] },
  capabilities: { label: "Product categories", blurb: "One illustrated card per product category, linking to the catalogue.", source: { text: "Category names and descriptions are edited in", href: "/admin/cms/?tab=categories", label: "CMS → Categories" }, fields: [eyebrow(D.capabilities.eyebrow), title(D.capabilities.title)] },
  featured: { label: "Featured products", blurb: "Products you choose, as cards with photo, minimum order and lead time. Not shown until at least one product is chosen.", source: { text: "Photos, minimum order and lead time come from each product in", href: "/admin/products/", label: "Products" }, fields: [eyebrow(D.featured.eyebrow), title(D.featured.title), field("lede", "Introduction (optional)", HOME_LIMITS.lede, only(""), { rows: 3 })] },
  work: { label: "Selected work", blurb: "Up to six case studies from the portfolio.", source: { text: "Case studies are edited in", href: "/admin/cms/?tab=portfolio", label: "CMS → Portfolio" }, fields: [eyebrow(D.work.eyebrow), title(D.work.title)] },
  testimonials: { label: "Testimonials", blurb: "The first three published testimonials. Hidden automatically while there are none — the site never shows an invented quote.", source: { text: "Testimonials (with recorded consent) are added in", href: "/admin/cms/?tab=testimonials", label: "CMS → Testimonials" }, fields: [eyebrow(D.testimonials.eyebrow)] },
  faq: { label: "Questions and answers", blurb: "A short list of frequently asked questions.", source: { text: "Questions and answers are edited in", href: "/admin/cms/?tab=faqs", label: "CMS → FAQs" }, fields: [eyebrow(D.faq.eyebrow), title(D.faq.title), lede(D.faq.lede)] },
  blocks: { label: "Custom blocks", blurb: "Free-form content built in the page builder: text, image, gallery, video, banner, product grid and more.", fields: [] },
  connect: {
    label: "Get in touch",
    blurb: "Every contact channel SPP has filled in: WhatsApp, phone, email, social pages, address and hours.",
    source: { text: "Numbers, address and hours are edited in", href: "/admin/settings/", label: "Settings → Company & contact" },
    fields: [
      eyebrow({ en: en["connect.plate"], lo: lo["connect.plate"] }),
      title({ en: `${en["connect.title"]} *${en["connect.titleFeel"]}*`, lo: `${lo["connect.title"]} *${lo["connect.titleFeel"]}*` }),
      lede({ en: en["connect.body"], lo: lo["connect.body"] }),
    ],
  },
  cta: {
    label: "Closing call to action",
    blurb: "The gold band that ends the page, with one or two buttons.",
    fields: [
      field("title", "Headline", HOME_LIMITS.title, only(D.cta.title), { accent: true, rows: 2 }),
      field("body", "Supporting line", HOME_LIMITS.body, only(D.cta.body), { rows: 3 }),
    ],
  },
};

export type HeroCopyName = "eyebrow" | "line1" | "line2" | "line3" | "accent" | "lede";
const heroField = (name: HeroCopyName, label: string, max: number, key: keyof typeof en, extra: { rows?: number; hint?: string } = {}) => ({ name, label, max, fallback: { en: en[key], lo: lo[key] } as Bilingual, ...extra });
export const HERO_FIELDS = [
  heroField("eyebrow", "Small label", HOME_LIMITS.eyebrow, "hero.eyebrow"),
  heroField("line1", "Headline — line 1", HOME_LIMITS.label, "hero.line1"),
  heroField("line2", "Headline — line 2", HOME_LIMITS.label, "hero.line2"),
  heroField("line3", "Headline — line 3", HOME_LIMITS.label, "hero.line3"),
  heroField("accent", "Accent word", HOME_LIMITS.label, "hero.line3accent", { hint: "Ends line 3, set in gold italics. Shown in lower case." }),
  heroField("lede", "Introduction", HOME_LIMITS.lede, "hero.lede", { rows: 4 }),
] as const;

export const HERO_BUTTONS = {
  primaryCta: { label: "Main button", fallback: { en: en["common.startProject"], lo: lo["common.startProject"] } as Bilingual, required: true },
  secondaryCta: { label: "Second button", fallback: { en: en["common.exploreServices"], lo: lo["common.exploreServices"] } as Bilingual, required: false },
} as const;

export const CTA_BUTTONS = {
  primary: { label: "Main button", fallback: { en: en["common.startProject"], lo: lo["common.startProject"] } as Bilingual, required: true },
  secondary: { label: "Second button", fallback: { en: en["common.letsTalk"], lo: lo["common.letsTalk"] } as Bilingual, required: false },
} as const;

/** Pages of the site a button can point to. Product and CMS pages are added from the database. */
export const SITE_ROUTES: { href: string; label: string }[] = [
  { href: "/request-quote/", label: "Request a quote" },
  { href: "/consultation/", label: "Book a consultation" },
  { href: "/contact/", label: "Contact" },
  { href: "/products/", label: "Products (catalogue)" },
  { href: "/services/", label: "Services" },
  { href: "/solutions/", label: "Solutions (Project Builder)" },
  { href: "/spp-studio/", label: "SPP Studio (introduction)" },
  { href: "/design/", label: "SPP Studio (open the designer)" },
  { href: "/billboards/", label: "Billboards" },
  { href: "/portfolio/", label: "Portfolio" },
  { href: "/blog/", label: "Journal" },
  { href: "/campaigns/", label: "Campaigns" },
  { href: "/about/", label: "About SPP" },
  { href: "/account/", label: "My SPP (customer sign-in)" },
];

/** The parts of the editor, in the order of the left-hand list. */
export type EditorItem = "announcement" | "hero" | HomeSectionKey | "seo";
export const isEditorItem = (v: string, sections: readonly HomeSectionKey[]): v is EditorItem => v === "announcement" || v === "hero" || v === "seo" || (sections as readonly string[]).includes(v);

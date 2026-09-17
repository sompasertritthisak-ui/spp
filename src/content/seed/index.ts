import type { SiteContent } from "../types";
import { billboards } from "./billboards";
import { categories, products, services } from "./catalogue";
import { bundles, faqs, portfolio, posts, solutions, templates, testimonials } from "./editorial";
import { flags, settings } from "./settings";

/** The seed is the single source for first-run content: it builds the static
 *  site before a database exists AND generates supabase/seed.sql. */
export const seed: SiteContent = {
  settings,
  flags,
  categories,
  products,
  services,
  solutions,
  bundles,
  billboards,
  portfolio,
  faqs,
  testimonials,
  posts,
  templates,
};

import type { Key } from "@/lib/i18n/core";

/* `label` is the English shown in the static HTML; `key` is what the language switch translates. */
type NavLink = { href: string; label: string; key: Key; accent?: true };

export const primaryNav: readonly NavLink[] = [
  { href: "/services/", label: "Services", key: "nav.services" },
  { href: "/products/", label: "Products", key: "nav.products" },
  { href: "/solutions/", label: "Solutions", key: "nav.solutions" },
  { href: "/spp-studio/", label: "Studio", key: "nav.studio", accent: true },
  { href: "/billboards/", label: "Billboards", key: "nav.billboards" },
  { href: "/portfolio/", label: "Work", key: "nav.work" },
];

export const secondaryNav: readonly NavLink[] = [
  { href: "/about/", label: "About", key: "nav.about" },
  { href: "/blog/", label: "Journal", key: "nav.journal" },
  { href: "/brand/", label: "Brand", key: "nav.brand" },
  { href: "/consultation/", label: "Book a consultation", key: "nav.consultation" },
  { href: "/contact/", label: "Contact", key: "nav.contact" },
];

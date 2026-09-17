export type AdminNavItem = { href: string; label: string; cap: string | null; keywords?: string };
export type AdminNavGroup = { label: string; items: AdminNavItem[] };

/** `cap` mirrors the SQL can(domain) capability. It only hides links — RLS is the real gate. */
export const adminNav: AdminNavGroup[] = [
  { label: "Today", items: [{ href: "/admin/dashboard/", label: "Command Center", cap: null, keywords: "home today attention" }] },
  {
    label: "Sales",
    items: [
      { href: "/admin/leads/", label: "Leads", cap: "sales", keywords: "crm pipeline" },
      { href: "/admin/quotes/", label: "Quotes", cap: "sales" },
      { href: "/admin/consultations/", label: "Consultations", cap: "sales", keywords: "meetings bookings" },
      { href: "/admin/projects/", label: "Projects", cap: "sales" },
      { href: "/admin/orders/", label: "Orders", cap: "sales" },
    ],
  },
  { label: "Studio", items: [{ href: "/admin/designs/", label: "Designs & Artwork", cap: "designs", keywords: "preflight approval mockup" }] },
  { label: "Production", items: [{ href: "/admin/production/", label: "Production & QC", cap: "production", keywords: "jobs quality delivery" }] },
  {
    label: "Outdoor",
    items: [
      { href: "/admin/billboards/", label: "Billboards", cap: "billboards", keywords: "map bookings outdoor" },
      { href: "/admin/campaigns/", label: "Campaigns & QR", cap: "campaigns", keywords: "qr tracking" },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/admin/products/", label: "Products", cap: "catalogue" },
      { href: "/admin/pricing/", label: "Pricing", cap: "pricing", keywords: "rules tiers discounts" },
      { href: "/admin/bundles/", label: "Bundles", cap: "catalogue" },
    ],
  },
  { label: "Content", items: [{ href: "/admin/cms/", label: "CMS", cap: "content", keywords: "pages blog portfolio faq media templates" }] },
  { label: "Insight", items: [{ href: "/admin/analytics/", label: "Analytics", cap: "analytics", keywords: "funnel conversion" }] },
  { label: "System", items: [{ href: "/admin/settings/", label: "Settings", cap: "settings", keywords: "flags team roles audit email" }] },
];

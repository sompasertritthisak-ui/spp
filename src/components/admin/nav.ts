/** `cap`: the capability (or any one of several) a role needs — at view level — to be offered the link. */
export type AdminNavItem = { href: string; label: string; cap: string | readonly string[] | null; keywords?: string };
export type AdminNavGroup = { label: string; items: AdminNavItem[] };

/** Whether to offer a link, given the signed-in person's `can` from useAuth(). */
export const navVisible = (item: Pick<AdminNavItem, "cap">, can: (domain: string) => boolean) =>
  item.cap === null || (typeof item.cap === "string" ? can(item.cap) : item.cap.some(can));

/** `cap` mirrors the SQL can(domain) capability of the person's role, as set in Settings → Roles & hierarchy.
 *  It only hides links — RLS is the real gate. */
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
  {
    label: "Content",
    items: [
      { href: "/admin/cms/home/", label: "Home page", cap: "content", keywords: "landing hero sections featured announcement" },
      { href: "/admin/cms/", label: "CMS", cap: "content", keywords: "pages blog portfolio faq media templates" },
    ],
  },
  { label: "Insight", items: [{ href: "/admin/analytics/", label: "Analytics", cap: "analytics", keywords: "funnel conversion" }] },
  { label: "System", items: [{ href: "/admin/settings/", label: "Settings", cap: ["settings", "team"], keywords: "flags people team roles hierarchy permissions audit email" }] },
];

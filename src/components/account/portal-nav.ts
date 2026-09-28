import type { Key } from "@/lib/i18n/core";

/* `label` is the English name; `key` is what the language switch translates. */
export const portalNav: readonly { href: string; label: string; key: Key }[] = [
  { href: "/account/", label: "Overview", key: "portal.overview" },
  { href: "/account/brand/", label: "My Brand", key: "portal.brand" },
  { href: "/account/designs/", label: "My Designs", key: "portal.designs" },
  { href: "/account/quotes/", label: "My Quotes", key: "portal.quotes" },
  { href: "/account/orders/", label: "My Orders", key: "portal.orders" },
  { href: "/account/projects/", label: "My Projects", key: "portal.projects" },
  { href: "/account/billboards/", label: "My Billboards", key: "portal.billboards" },
  { href: "/account/files/", label: "My Files", key: "portal.files" },
  { href: "/account/notifications/", label: "Notifications", key: "portal.notifications" },
  { href: "/account/profile/", label: "Profile", key: "portal.profile" },
];

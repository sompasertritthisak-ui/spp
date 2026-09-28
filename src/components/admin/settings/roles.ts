"use client";
import { GRANTABLE_DOMAINS, type CapLevel, type Domain } from "@/lib/backend/auth";
import { backend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { BRAND } from "@/lib/brand";
import { adminError, type RawError } from "../resource/errors";

/* Roles & hierarchy — what list_roles() returns, and the words the screens use
   for it. The database decides everything; this file only describes it. */

export type Caps = Partial<Record<Domain, CapLevel>>;
export type RoleRow = { id: string; key: string; name: string; description: string; rank: number; isSystem: boolean; legacy: string | null; colour: string | null; caps: Caps; members: number; updatedAt: string };

export const SUPER_RANK = 100;
export const MAX_RANK = 99;

/** Plain-language cover notes for the capability matrix. Order = order on screen. */
export const DOMAIN_INFO: readonly { key: Domain; label: string; covers: string; edit: string }[] = [
  { key: "sales", label: "Sales", covers: "Leads, quotes, orders, consultations, projects, customer companies and pre-orders.", edit: "Create and price quotes, send them, convert them to orders, move leads." },
  { key: "finance", label: "Finance", covers: "Money on orders: totals, deposits and payment status.", edit: "Record payments and change payment status." },
  { key: "pricing", label: "Pricing", covers: "The confidential pricing rules behind every online estimate, and the simulator.", edit: "Add, change and switch off pricing rules. Sales can already read them." },
  { key: "designs", label: "Designs", covers: "Customer designs, artwork files, preflight checks and brand profiles.", edit: "Approve artwork, request changes, sign off preflight." },
  { key: "production", label: "Production", covers: "Production jobs, quality control and deliveries — never prices.", edit: "Move jobs, record QC, schedule and complete deliveries." },
  { key: "catalogue", label: "Catalogue", covers: "Products, variants, categories and bundles.", edit: "Create and edit products, categories and bundles." },
  { key: "content", label: "Content", covers: "CMS pages, the home page, blog, portfolio, services, FAQs, testimonials, team and media.", edit: "Write and publish content, upload and delete media." },
  { key: "billboards", label: "Billboards", covers: "Billboard sites, availability and booking enquiries.", edit: "Edit sites, block dates, confirm or decline bookings." },
  { key: "campaigns", label: "Campaigns", covers: "Campaign landing pages and tracked QR codes.", edit: "Create campaigns and QR codes." },
  { key: "analytics", label: "Analytics", covers: "Marketing analytics, the funnel, QR scans and AI usage. Reading only — there is nothing to edit.", edit: "Same as view." },
  { key: "settings", label: "Settings", covers: "Company details, feature flags, email outbox and backups.", edit: "Change company details and switch features on or off." },
  { key: "team", label: "Team", covers: "People and their roles.", edit: "Give roles to people below your own rank, and remove staff access. Also opens the audit log." },
];
export const DOMAIN_LABEL = Object.fromEntries(DOMAIN_INFO.map((d) => [d.key, d.label])) as Record<Domain, string>;

export type RoleDraft = { key: string; name: string; description: string; rank: number; colour: string | null; caps: Caps };
const everything = (level: CapLevel): Caps => Object.fromEntries(GRANTABLE_DOMAINS.map((d) => [d, level])) as Caps;

/** One-click starting points. Nothing is created until the super admin saves. */
export const ROLE_TEMPLATES: readonly (RoleDraft & { blurb: string })[] = [
  { key: "accounts", name: "Accounts", rank: 55, colour: BRAND.gold, description: "Records payments and follows up invoices; sees sales and analytics without changing them.", blurb: "Finance edit · Sales view · Analytics view", caps: { finance: "edit", sales: "view", analytics: "view" } },
  { key: "customer-service", name: "Customer service", rank: 45, colour: BRAND.sky, description: "Answers customers and keeps their enquiries moving; sees artwork and billboard requests.", blurb: "Sales edit · Designs view · Billboards view", caps: { sales: "edit", designs: "view", billboards: "view" } },
  { key: "warehouse-delivery", name: "Warehouse & delivery", rank: 40, colour: BRAND.violet, description: "Packs, dispatches and delivers finished work.", blurb: "Production edit", caps: { production: "edit" } },
  { key: "viewer", name: "Viewer", rank: 10, colour: BRAND.fog, description: "Can look at everything a role may be given, and change nothing.", blurb: "View on everything", caps: everything("view") },
];

/** Offered as swatches; the stored value is just a hex, so any saved colour still shows. */
export const ROLE_COLOURS: readonly { value: string; label: string }[] = [
  { value: BRAND.gold, label: "Gold" }, { value: BRAND.goldDeep, label: "Deep gold" }, { value: BRAND.sky, label: "Sky" }, { value: BRAND.cyan, label: "Cyan" },
  { value: BRAND.violet, label: "Violet" }, { value: BRAND.magenta, label: "Magenta" }, { value: BRAND.fog, label: "Fog" }, { value: BRAND.white, label: "White" },
];

export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^[^a-z]+/, "").replace(/-+$/, "").slice(0, 40);
export const validKey = (k: string) => /^[a-z][a-z0-9_-]{1,39}$/.test(k) && k !== "customer" && k !== "staff";

export const capSummary = (caps: Caps) => {
  const edit = GRANTABLE_DOMAINS.filter((d) => caps[d] === "edit").length, view = GRANTABLE_DOMAINS.filter((d) => caps[d] === "view").length;
  return edit + view === 0 ? "No capabilities" : [edit === GRANTABLE_DOMAINS.length ? "Edit everything" : edit ? `Edit ${edit}` : "", view ? `View ${view}` : ""].filter(Boolean).join(" · ");
};

const asRoles = (v: unknown): RoleRow[] => (Array.isArray(v) ? (v as RoleRow[]).map((r) => ({ ...r, caps: r.caps ?? {}, members: Number(r.members ?? 0) })) : []);

export function useRoles(enabled = true) {
  const q = useQuery<RoleRow[]>(async () => {
    const r = await backend()!.rpc("list_roles");
    return r.error ? { data: null, error: r.error } : { data: asRoles(r.data), error: null };
  }, [], { enabled });
  return { roles: q.data, loading: q.loading, error: q.error, reload: q.reload };
}

/** Staff-facing wording for what the role RPCs refuse. */
export function roleError(e: RawError): string {
  const m = e?.message ?? "";
  if (/own role/i.test(m)) return "You cannot change your own role.";
  if (/last super admin/i.test(m)) return "There must always be a super admin. Make someone else a super admin first.";
  if (/super admin required/i.test(m)) return "Only a super admin can do that.";
  if (/forbidden: rank/i.test(m)) return e?.hint || "That is at or above your own rank.";
  if (/still has members/i.test(m)) return e?.hint || "Move the people on this role to another role first.";
  if (/system roles cannot be deleted/i.test(m)) return "The built-in roles cannot be deleted. You can rename them or change what they may do.";
  if (/security cannot be granted/i.test(m)) return "Security stays with the super admin and cannot be given to a role.";
  if (/guest session/i.test(m)) return "That is a guest session, not an account. The person needs to register first.";
  if (/^invalid:/i.test(m)) return e?.hint || `The database rejected that: ${m.replace(/^invalid:\s*/i, "")}.`;
  if (/not found: role/i.test(m)) return "That role no longer exists. Reload and try again.";
  return adminError(e);
}

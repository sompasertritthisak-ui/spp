"use client";
import Link from "next/link";
import { clsx } from "clsx";
import { canDo, type Role } from "@/lib/backend/auth";
import { ErrorNote } from "../ui";

export type AttentionCounts = Partial<Record<"newLeads" | "highValueLeads" | "quotesAwaiting" | "followUpsDue" | "consultations" | "billboardEnquiries" | "artworkApprovals" | "urgentOrders" | "jobsOverdue" | "jobsBlocked" | "abandonedHighIntent", number | null>>;

type Tile = { key: keyof AttentionCounts; one: string; many: string; why: string; href: (role: Role | undefined) => string; tone: "yellow" | "danger" | "warn" };
const TILES: Tile[] = [
  { key: "jobsOverdue", one: "job overdue", many: "jobs overdue", why: "Past the production deadline", href: () => "/admin/production/?filter=overdue", tone: "danger" },
  { key: "jobsBlocked", one: "job blocked", many: "jobs blocked", why: "Waiting on something — unblock it", href: () => "/admin/production/?filter=blocked", tone: "danger" },
  { key: "urgentOrders", one: "urgent order", many: "urgent orders", why: "Due within three days or late", href: (r) => (canDo(r, "sales") ? "/admin/orders/?urgent=1" : "/admin/production/?filter=urgent"), tone: "danger" },
  { key: "newLeads", one: "new lead", many: "new leads", why: "Nobody has made contact yet", href: () => "/admin/leads/?view=table&status=new", tone: "yellow" },
  { key: "quotesAwaiting", one: "quote awaiting response", many: "quotes awaiting response", why: "Customers are waiting for a price", href: () => "/admin/quotes/?status=awaiting", tone: "yellow" },
  { key: "artworkApprovals", one: "artwork approval", many: "artwork approvals", why: "Submitted designs to review", href: () => "/admin/designs/?status=submitted", tone: "yellow" },
  { key: "followUpsDue", one: "follow-up due", many: "follow-ups due", why: "Promised call-backs, today or earlier", href: () => "/admin/leads/?view=table&due=1", tone: "warn" },
  { key: "consultations", one: "consultation request", many: "consultation requests", why: "Approve, decline or suggest a time", href: () => "/admin/consultations/?status=requested", tone: "yellow" },
  { key: "billboardEnquiries", one: "billboard enquiry", many: "billboard enquiries", why: "Requests are not bookings until confirmed", href: () => "/admin/billboards/?tab=bookings", tone: "yellow" },
  { key: "highValueLeads", one: "high-value lead open", many: "high-value leads open", why: "High or urgent priority, still in play", href: () => "/admin/leads/?view=table&priority=hot", tone: "warn" },
  { key: "abandonedHighIntent", one: "abandoned high-intent visit", many: "abandoned high-intent visits", why: "Started a design, quote or booking this week", href: () => "/admin/leads/?view=abandoned", tone: "warn" },
];
const toneCls = { yellow: "text-yellow", danger: "text-danger", warn: "text-warn" } as const;
const toneBar = { yellow: "bg-yellow", danger: "bg-danger", warn: "bg-warn" } as const;

/** WHAT NEEDS MY ATTENTION? Null counts are outside the role's remit and are not drawn at all. */
export function Attention({ counts, loading, error, onRetry, role }: { counts: AttentionCounts | null; loading: boolean; error: string | null; onRetry: () => void; role: Role | undefined }) {
  if (error) return <ErrorNote message={error} onRetry={onRetry} />;
  if (loading && !counts) return <div aria-busy="true" className="grid grid-cols-2 gap-px border border-ink-700 bg-ink-700 md:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="bg-ink-900 p-5"><div className="skeleton h-12 w-16" /><div className="skeleton mt-4 h-4 w-32" /></div>)}</div>;
  const inRemit = TILES.filter((t) => counts?.[t.key] != null);
  const hot = inRemit.filter((t) => (counts?.[t.key] ?? 0) > 0);
  const clear = inRemit.filter((t) => (counts?.[t.key] ?? 0) === 0);

  if (hot.length === 0)
    return (
      <div className="crop flex flex-wrap items-center gap-6 border border-ok/30 bg-ink-900 p-6 sm:p-8">
        <svg aria-hidden viewBox="0 0 40 40" className="h-12 w-12 flex-none text-ok" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="20" cy="20" r="18" /><path d="M11 20.5l6 6L29.5 14" /></svg>
        <div>
          <p className="t-heading uppercase text-fog-50">All clear.</p>
          <p className="mt-1.5 max-w-xl text-sm text-fog-400">Nothing in your remit is waiting on you right now{inRemit.length ? ` — ${inRemit.length} queues checked` : ""}. A good moment to follow up a quiet lead or tidy the pipeline.</p>
        </div>
      </div>
    );

  return (
    <div>
      <ul className="grid grid-cols-2 gap-px border border-ink-700 bg-ink-700 md:grid-cols-3 xl:grid-cols-4">
        {hot.map((t, i) => {
          const n = counts?.[t.key] ?? 0;
          return (
            <li key={t.key} className={clsx("bg-ink-900", i === 0 && "col-span-2 md:col-span-1 xl:col-span-2")}>
              <Link href={t.href(role)} className="group relative flex h-full min-h-36 flex-col justify-between p-5 transition-colors hover:bg-ink-850 focus-visible:bg-ink-850">
                <span aria-hidden className={clsx("absolute inset-y-0 left-0 w-0.5", toneBar[t.tone])} />
                <span className={clsx("t-data font-medium leading-none", i === 0 ? "text-7xl" : "text-5xl", toneCls[t.tone])}>{n}</span>
                <span className="mt-4 block">
                  <span className="t-label flex items-center justify-between gap-2 text-fog-50">{n === 1 ? t.one : t.many}<svg aria-hidden viewBox="0 0 20 10" className="h-2.5 w-5 flex-none text-fog-500 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-yellow" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M0 5h18M14 1l4 4-4 4" /></svg></span>
                  <span className="mt-1 block text-xs text-fog-500">{t.why}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {clear.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fog-500">
          <span className="t-label inline-flex items-center gap-1.5 text-[0.625rem] text-ok"><svg aria-hidden viewBox="0 0 12 10" className="h-2 w-2.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 5l3.5 3.5L11 1" /></svg>Clear</span>
          {clear.map((t) => <Link key={t.key} href={t.href(role)} className="hover:text-fog-100">{t.many}</Link>)}
        </p>
      )}
    </div>
  );
}

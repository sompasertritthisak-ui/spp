"use client";
import Link from "next/link";
import { useQuery } from "@/lib/backend/hooks";
import { formatDate } from "@/lib/format";
import { db } from "../ops/data";
import { SectionTitle } from "../ops/parts";
import { StatusPill } from "../ui";

type Linked = { kind: string; id: string; ref: string; status: string; at: string; href: string };

/** Everything that grew out of this lead — the chain stays connected. */
export function LeadLinks({ leadId }: { leadId: string }) {
  const q = useQuery<Linked[]>(async () => {
    const b = db();
    const [quotes, consults, projects, orders, bookings] = await Promise.all([
      b.from("quotes").select("id,ref,status,created_at").eq("lead_id", leadId),
      b.from("consultations").select("id,ref,status,created_at").eq("lead_id", leadId),
      b.from("projects").select("id,ref,stage,created_at").eq("lead_id", leadId),
      b.from("orders").select("id,ref,status,created_at").eq("lead_id", leadId),
      b.from("billboard_bookings").select("id,ref,status,created_at").eq("lead_id", leadId),
    ]);
    const map = (rows: { id: string; ref: string; status?: string; stage?: string; created_at: string }[] | null, kind: string, href: (id: string) => string): Linked[] => (rows ?? []).map((r) => ({ kind, id: r.id, ref: r.ref, status: r.status ?? r.stage ?? "", at: r.created_at, href: href(r.id) }));
    return [
      ...map(quotes.data, "Quote", (id) => `/admin/quotes/?id=${id}`), ...map(consults.data, "Consultation", (id) => `/admin/consultations/?id=${id}`),
      ...map(projects.data, "Project", (id) => `/admin/projects/?id=${id}`), ...map(orders.data, "Order", (id) => `/admin/orders/?id=${id}`),
      ...map(bookings.data, "Billboard booking", (id) => `/admin/billboards/?booking=${id}`),
    ].sort((a, b2) => b2.at.localeCompare(a.at));
  }, [leadId]);
  return (
    <section aria-label="Linked records">
      <SectionTitle>Linked records</SectionTitle>
      {q.loading && !q.data && <div className="skeleton h-10" />}
      {q.data?.length === 0 && <p className="text-sm text-fog-500">Nothing linked yet. Create a quote or project from the actions above.</p>}
      <ul>
        {q.data?.map((l) => (
          <li key={`${l.kind}-${l.id}`} className="border-b border-ink-800 last:border-0">
            <Link href={l.href} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm hover:bg-ink-850">
              <span className="t-label w-28 text-[0.625rem] text-fog-500">{l.kind}</span><span className="t-data text-fog-50">{l.ref}</span><StatusPill status={l.status} /><span className="t-data ml-auto text-xs text-fog-500">{formatDate(l.at)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

"use client";
import Link from "next/link";
import { canDo, type Role } from "@/lib/backend/auth";
import { useQuery } from "@/lib/backend/hooks";
import type { LeadStatus, ProductionStatus } from "@/lib/backend/db-types";
import { formatLakShort, formatNumber, relativeTime, titleCase } from "@/lib/format";
import { PipelineBar } from "../charts/PipelineBar";
import { Sparkline } from "../charts/Sparkline";
import { db, isoDay } from "../ops/data";
import { ErrorNote, Panel, Stat, StatusPill } from "../ui";

const VTE_OFFSET = 7 * 3600e3; // Laos is UTC+7 all year
const startOfVientianeDay = (now: number) => new Date(Math.floor((now + VTE_OFFSET) / 864e5) * 864e5 - VTE_OFFSET).toISOString();

type TodayData = { leads: number | null; quotes: number | null; due: number | null; dueLabel: string };
export function Today({ role, now }: { role: Role | undefined; now: number }) {
  const sales = canDo(role, "sales"), production = canDo(role, "production");
  const q = useQuery<TodayData>(async () => {
    const since = startOfVientianeDay(now), today = isoDay(now + VTE_OFFSET), week = isoDay(now + VTE_OFFSET + 7 * 864e5);
    const count = async (table: string, f: (x: ReturnType<ReturnType<typeof db>["from"]>) => PromiseLike<{ count: number | null }>) => (await f(db().from(table))).count;
    const [leads, quotes, due] = await Promise.all([
      sales ? count("leads", (t) => t.select("id", { count: "exact", head: true }).gte("created_at", since)) : null,
      sales ? count("quotes", (t) => t.select("id", { count: "exact", head: true }).gte("created_at", since)) : null,
      sales ? count("orders", (t) => t.select("id", { count: "exact", head: true }).gte("due_on", today).lte("due_on", week).not("status", "in", "(completed,cancelled)"))
        : production ? count("production_orders", (t) => t.select("id", { count: "exact", head: true }).gte("due_on", today).lte("due_on", week).not("status", "in", "(completed,cancelled)")) : null,
    ]);
    return { leads, quotes, due, dueLabel: "Orders due in 7 days" };
  }, [sales, production]);
  if (!sales && !production) return null;
  const v = (n: number | null | undefined) => (q.loading && !q.data ? <span className="skeleton inline-block h-7 w-10 align-middle" /> : n == null ? "—" : formatNumber(n));
  return (
    <section aria-label="Today">
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {sales && <Link href="/admin/leads/?view=table" className="block transition-opacity hover:opacity-80"><Stat label="New leads today" value={v(q.data?.leads)} hint="Vientiane time" tone={q.data?.leads ? "yellow" : "neutral"} /></Link>}
        {sales && <Link href="/admin/quotes/" className="block transition-opacity hover:opacity-80"><Stat label="Quote requests today" value={v(q.data?.quotes)} hint="Vientiane time" /></Link>}
        <Link href={sales ? "/admin/orders/" : "/admin/production/"} className="block transition-opacity hover:opacity-80"><Stat label="Orders due this week" value={v(q.data?.due)} hint="Open orders, next 7 days" /></Link>
      </div>
    </section>
  );
}

const STAGES: LeadStatus[] = ["new", "contacted", "qualified", "quote", "negotiation", "won"];
export function SalesPipeline() {
  const q = useQuery<{ status: LeadStatus; estimated_value_lak: number | null }[]>(() => db().from("leads").select("status,estimated_value_lak").neq("status", "lost").limit(5000), []);
  const stages = STAGES.map((s) => {
    const rows = q.data?.filter((l) => l.status === s) ?? [];
    return { key: s, label: titleCase(s), count: rows.length, valueLak: rows.reduce((t, l) => t + Number(l.estimated_value_lak ?? 0), 0), href: `/admin/leads/?view=table&status=${s}` };
  });
  const open = stages.slice(0, 5).reduce((t, s) => t + s.valueLak, 0);
  return (
    <Panel title="Sales pipeline" action={<Link href="/admin/leads/" className="t-label text-[0.625rem] text-yellow hover:text-fog-50">Open board</Link>}>
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      {q.loading && !q.data ? <div className="skeleton h-32 w-full" /> : <PipelineBar title="New → Won" desc={`Open pipeline value ${formatLakShort(open)} across ${formatNumber(stages.slice(0, 5).reduce((t, s) => t + s.count, 0))} leads (estimated, not invoiced).`} stages={stages} />}
    </Panel>
  );
}

type ActivityRow = { id: string; kind: string; body: string; at: string; lead_id: string; leads: { ref: string; name: string } | null };
type NoteRow = { id: string; kind: string; title: string; body: string; href: string; created_at: string };
export function ActivityStream({ role }: { role: Role | undefined }) {
  const sales = canDo(role, "sales");
  const acts = useQuery<ActivityRow[]>(() => db().from("lead_activities").select("id,kind,body,at,lead_id,leads(ref,name)").order("at", { ascending: false }).limit(12).returns<ActivityRow[]>(), [], { enabled: sales });
  const notes = useQuery<NoteRow[]>(() => db().from("notifications").select("id,kind,title,body,href,created_at").order("created_at", { ascending: false }).limit(12), [], { enabled: !sales });
  const loading = sales ? acts.loading && !acts.data : notes.loading && !notes.data;
  const items = sales
    ? acts.data?.map((a) => ({ id: a.id, tag: a.kind, title: a.leads ? `${a.leads.name}` : "Lead", body: a.body, at: a.at, href: `/admin/leads/?id=${a.lead_id}` }))
    : notes.data?.map((n) => ({ id: n.id, tag: n.kind.replace(/_/g, " "), title: n.title, body: n.body, at: n.created_at, href: n.href || "/admin/dashboard/" }));
  return (
    <Panel title="Recent activity" flush>
      <ErrorNote message={sales ? acts.error : notes.error} onRetry={() => void (sales ? acts.reload() : notes.reload())} />
      <ol>
        {loading && Array.from({ length: 6 }, (_, i) => <li key={i} className="border-b border-ink-800 px-4 py-3"><div className="skeleton h-5 w-full" /></li>)}
        {items?.map((i) => (
          <li key={i.id} className="border-b border-ink-800 last:border-0">
            <Link href={i.href} className="grid grid-cols-[4.75rem_1fr_auto] items-baseline gap-3 px-4 py-2.5 text-sm hover:bg-ink-850">
              <span className="t-label truncate text-[0.625rem] text-fog-500">{i.tag}</span>
              <span className="min-w-0"><span className="block truncate text-fog-50">{i.title}</span>{i.body && <span className="block truncate text-xs text-fog-400">{i.body}</span>}</span>
              <span className="t-data text-[0.6875rem] text-fog-500">{relativeTime(i.at)}</span>
            </Link>
          </li>
        ))}
        {items?.length === 0 && <li className="px-4 py-10 text-center text-sm text-fog-500">Quiet so far. Activity appears here as enquiries arrive and the team responds.</li>}
      </ol>
    </Panel>
  );
}

const JOB_STATES: ProductionStatus[] = ["queued", "in_progress", "blocked", "qc", "done"];
export function ProductionSnapshot({ now }: { now: number }) {
  const q = useQuery<{ status: ProductionStatus; deadline: string | null }[]>(() => db().from("production_jobs").select("status,deadline").limit(2000), []);
  const today = isoDay(now);
  const total = q.data?.length ?? 0;
  return (
    <Panel title="Production snapshot" action={<Link href="/admin/production/" className="t-label text-[0.625rem] text-yellow hover:text-fog-50">Open board</Link>}>
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      {q.loading && !q.data ? <div className="skeleton h-28" /> : total === 0 ? (
        <p className="py-6 text-sm text-fog-500">No production jobs yet. Jobs are created when an order is released to production.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {JOB_STATES.map((s) => {
            const rows = q.data?.filter((j) => j.status === s) ?? [];
            const late = s === "done" ? 0 : rows.filter((j) => j.deadline && j.deadline < today).length;
            return (
              <li key={s} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
                <StatusPill status={s} className="justify-self-start" />
                <svg aria-hidden viewBox="0 0 100 6" preserveAspectRatio="none" className="h-1.5 w-full"><rect width="100" height="6" className="fill-ink-800" /><rect width={total ? (rows.length / total) * 100 : 0} height="6" className={s === "blocked" ? "fill-danger" : s === "done" ? "fill-ok" : "fill-fog-300"} /></svg>
                <span className="t-data text-right text-fog-50">{rows.length}{late > 0 && <span className="ml-2 text-xs text-danger">▲ {late} late</span>}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

type Summary = { visitors: number; leads: number; quotes: number; orders: number; revenueLak: number; pipelineLak: number; daily: { day: string; visitors: number; leads: number }[] };
export function KeyMetrics() {
  const q = useQuery<Summary>(() => db().rpc("funnel_summary"), []);
  const d = q.data;
  const rate = d && d.visitors > 0 ? `${((d.leads / d.visitors) * 100).toFixed(1)}%` : "—";
  return (
    <Panel title="Last 30 days" action={<Link href="/admin/analytics/" className="t-label text-[0.625rem] text-yellow hover:text-fog-50">Full analytics</Link>}>
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      {q.loading && !d ? <div className="skeleton h-28" /> : d && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
          {[
            { k: "Visitors", v: formatNumber(d.visitors), spark: d.daily.map((x) => x.visitors) },
            { k: "Leads", v: formatNumber(d.leads), spark: d.daily.map((x) => x.leads) },
            { k: "Visitor → lead", v: rate },
            { k: "Quotes", v: formatNumber(d.quotes) },
            { k: "Orders", v: formatNumber(d.orders) },
            { k: "Order value", v: formatLakShort(Number(d.revenueLak)) },
          ].map((m) => (
            <div key={m.k}>
              <dt className="t-label text-[0.625rem] text-fog-500">{m.k}</dt>
              <dd className="mt-1.5 flex items-end justify-between gap-2"><span className="t-data text-2xl leading-none text-fog-50">{m.v}</span>{m.spark && <Sparkline values={m.spark} label={`${m.k} per day, last 30 days`} className="h-6 w-16" />}</dd>
            </div>
          ))}
        </dl>
      )}
    </Panel>
  );
}

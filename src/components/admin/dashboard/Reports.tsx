"use client";
import Link from "next/link";
import { useQuery } from "@/lib/backend/hooks";
import { formatLakShort, formatNumber } from "@/lib/format";
import { db } from "../ops/data";
import { ErrorNote, Panel } from "../ui";

const VTE_OFFSET = 7 * 3600e3;
/** Monday 00:00 and the 1st 00:00 in Vientiane, as ISO — the periods SPP reports on. */
function periods(now: number) {
  const local = new Date(now + VTE_OFFSET);
  const day = local.getUTCDay() || 7;
  const monday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - (day - 1)) - VTE_OFFSET;
  const first = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - VTE_OFFSET;
  return { week: new Date(monday).toISOString(), month: new Date(first).toISOString() };
}
type Slice = { leads: number; quotesSent: number; orders: number; revenue: number };
type Data = { week: Slice; month: Slice };
type Q = { sent_at: string | null; total_lak: number | null };
type O = { created_at: string; total_lak: number | null };

/** Week / month tallies from the live tables. Revenue is the sum of quoted order totals — SPP does not invoice through this system. */
export function Reports({ now }: { now: number }) {
  const q = useQuery<Data>(async () => {
    const { week, month } = periods(now);
    const b = db();
    const [leadsW, leadsM, quotes, orders] = await Promise.all([
      b.from("leads").select("id", { count: "exact", head: true }).gte("created_at", week),
      b.from("leads").select("id", { count: "exact", head: true }).gte("created_at", month),
      b.from("quotes").select("sent_at,total_lak").gte("sent_at", month).limit(5000),
      b.from("orders").select("created_at,total_lak").gte("created_at", month).neq("status", "cancelled").limit(5000),
    ]);
    const err = [leadsW, leadsM, quotes, orders].find((r) => r.error)?.error;
    if (err) return { data: null, error: err };
    const slice = (since: string): Slice => {
      const qs = ((quotes.data ?? []) as Q[]).filter((x) => (x.sent_at ?? "") >= since);
      const os = ((orders.data ?? []) as O[]).filter((x) => x.created_at >= since);
      return { leads: since === week ? leadsW.count ?? 0 : leadsM.count ?? 0, quotesSent: qs.length, orders: os.length, revenue: os.reduce((t, o) => t + Number(o.total_lak ?? 0), 0) };
    };
    return { data: { week: slice(week), month: slice(month) }, error: null };
  }, [now]);
  const d = q.data;
  const cell = (n: number | undefined, money = false) => (q.loading && !d ? <span className="skeleton inline-block h-5 w-12" /> : n == null ? "—" : money ? formatLakShort(n) : formatNumber(n));
  const rows: { k: string; w: keyof Slice; money?: boolean; href: string }[] = [
    { k: "New leads", w: "leads", href: "/admin/leads/?view=table" }, { k: "Quotes sent", w: "quotesSent", href: "/admin/quotes/?status=sent" },
    { k: "Orders created", w: "orders", href: "/admin/orders/?status=all" }, { k: "Order value", w: "revenue", money: true, href: "/admin/orders/?status=all" },
  ];
  return (
    <Panel title="Reports" action={<span className="t-label text-[0.625rem] text-fog-500">Vientiane calendar</span>} flush>
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      <table className="w-full text-sm">
        <thead><tr className="border-b border-ink-700 text-left"><th scope="col" className="t-label h-10 px-4 font-medium text-fog-500">Measure</th><th scope="col" className="t-label h-10 px-4 text-right font-medium text-fog-500">This week</th><th scope="col" className="t-label h-10 px-4 text-right font-medium text-fog-500">This month</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k} className="border-b border-ink-800 last:border-0">
              <td className="px-4 py-2.5"><Link href={r.href} className="text-fog-100 hover:text-yellow">{r.k}</Link></td>
              <td className="t-data px-4 py-2.5 text-right text-fog-50">{cell(d?.week[r.w], r.money)}</td>
              <td className="t-data px-4 py-2.5 text-right text-fog-50">{cell(d?.month[r.w], r.money)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-ink-700 px-4 py-2.5 text-xs text-fog-500">Order value is from quoted totals, not invoiced or paid amounts. Export any list as Excel or CSV from Quotes and Orders.</p>
    </Panel>
  );
}

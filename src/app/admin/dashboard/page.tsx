"use client";
import { Button } from "@/components/ui/Button";
import { Attention, type AttentionCounts } from "@/components/admin/dashboard/Attention";
import { ActivityStream, KeyMetrics, ProductionSnapshot, SalesPipeline, Today } from "@/components/admin/dashboard/panels";
import { db, useNow } from "@/components/admin/ops/data";
import { canDo, useAuth } from "@/lib/backend/auth";
import { useQuery } from "@/lib/backend/hooks";

const vteDate = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Vientiane" });
const vteHour = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Vientiane" });

export default function DashboardPage() {
  const { profile } = useAuth();
  const role = profile?.role;
  const now = useNow();
  const attention = useQuery<AttentionCounts>(() => db().rpc("attention_summary"), []);
  const hour = Number(vteHour.format(now));
  const first = (profile?.full_name || profile?.email || "").split(/[\s@]/)[0];
  const sales = canDo(role, "sales");

  return (
    <div className="mx-auto flex max-w-[92rem] flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="t-label flex items-center gap-3 text-fog-500"><span aria-hidden className="reg text-yellow" />SPP Command Center · {vteDate.format(now)} · Vientiane</p>
          <h1 className="t-title mt-3 text-fog-50">{hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}{first ? `, ${first}` : ""}.</h1>
        </div>
        {sales && <div className="flex flex-wrap gap-2"><Button href="/admin/leads/?new=1" variant="outline" size="sm">New lead</Button><Button href="/admin/quotes/?new=1" size="sm">New quote</Button></div>}
      </header>

      <section aria-labelledby="attn">
        <h2 id="attn" className="t-label mb-3 text-fog-300">What needs my attention</h2>
        <Attention counts={attention.data} loading={attention.loading} error={attention.error} onRetry={() => void attention.reload()} role={role} />
      </section>

      <Today role={role} now={now} />

      {sales && <SalesPipeline />}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <ActivityStream role={role} />
        <div className="flex flex-col gap-6">
          {(canDo(role, "production") || sales) && <ProductionSnapshot now={now} />}
          {canDo(role, "analytics") && <KeyMetrics />}
        </div>
      </div>
    </div>
  );
}

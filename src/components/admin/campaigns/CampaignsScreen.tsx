"use client";
import { clsx } from "clsx";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { canDo, useAuth } from "@/lib/backend/auth";
import { backend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import type { CampaignsRow } from "@/lib/backend/db-types";
import { formatDate, formatNumber } from "@/lib/format";
import { isoDay } from "../billboards/shared";
import { PublishSite } from "../cms/PublishSite";
import { inputCls } from "../resource/fields";
import { useOptions } from "../resource/pickers";
import { useResource } from "../resource/useResource";
import { useSelection } from "../resource/useSelection";
import { DataTable, ErrorNote, PageHeader, Panel, Stat, StatusPill, Tabs } from "../ui";
import { CampaignWorkspace } from "./CampaignWorkspace";

type Tab = "all" | "draft" | "published" | "archived";
type Totals = { activeCodes: number; scans7: number; scans30: number; perCampaign: Map<string, number> };
const startOfToday = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };

export function CampaignsScreen() {
  const { profile } = useAuth();
  const toast = useToast();
  const canWrite = canDo(profile?.role, "campaigns");
  const canRead = canWrite || canDo(profile?.role, "analytics");
  const sel = useSelection();
  const res = useResource("campaigns", { order: [{ column: "created_at", ascending: false }], singular: "Campaign" });
  const products = useOptions("products", "slug", "name", "status");
  const [today] = useState(startOfToday);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const totals = useQuery<Totals>(async () => {
    const b = backend()!;
    const ago = (n: number) => new Date(today.getTime() - n * 86400000).toISOString();
    const [codes, s7, s30] = await Promise.all([
      b.from("campaign_qr_codes").select("id,campaign_id,active"),
      b.from("qr_scans").select("id", { count: "exact", head: true }).gte("at", ago(7)),
      b.from("qr_scans").select("id", { count: "exact", head: true }).gte("at", ago(30)),
    ]);
    const bad = codes.error ?? s7.error ?? s30.error;
    if (bad) return { data: null, error: bad };
    const perCampaign = new Map<string, number>();
    for (const c of codes.data as { campaign_id: string }[]) perCampaign.set(c.campaign_id, (perCampaign.get(c.campaign_id) ?? 0) + 1);
    return { activeCodes: (codes.data as { active: boolean }[]).filter((c) => c.active).length, scans7: s7.count ?? 0, scans30: s30.count ?? 0, perCampaign };
  }, [], { enabled: canRead });

  const rows = useMemo(() => res.rows ?? [], [res.rows]);
  const counts = useMemo(() => ({ all: rows.length, draft: rows.filter((c) => c.status === "draft").length, published: rows.filter((c) => c.status === "published").length, archived: rows.filter((c) => c.status === "archived").length }), [rows]);
  const shown = useMemo(() => { const t = q.trim().toLowerCase(); return rows.filter((c) => (tab === "all" || c.status === tab) && (!t || `${c.name} ${c.slug} ${c.offer}`.toLowerCase().includes(t))); }, [rows, q, tab]);
  const soon = isoDay(new Date(today.getTime() + 14 * 86400000));
  const ending = rows.filter((c) => c.status === "published" && c.ends_on && c.ends_on >= isoDay(today) && c.ends_on <= soon);
  const overdue = rows.filter((c) => c.status === "published" && c.ends_on && c.ends_on < isoDay(today));

  if (!canRead) return <><PageHeader title="Campaigns & QR" /><EmptyState title="Not part of your role." body="Campaigns and QR tracking are run by marketing and administrators." /></>;

  const duplicate = async (src: CampaignsRow) => {
    const taken = new Set(rows.map((c) => c.slug));
    let slug = `${src.slug}-copy`;
    for (let n = 2; taken.has(slug); n++) slug = `${src.slug}-copy-${n}`;
    const { id: _i, created_at: _c, updated_at: _u, ...rest } = src;
    void _i; void _c; void _u;
    const made = await res.create({ ...rest, slug, name: `${src.name} (copy)`, status: "draft" }, { quiet: true });
    if (made) { toast("Campaign duplicated as a draft. QR codes are not copied — each printed code belongs to one campaign.", "ok"); sel.open(made.id); }
  };
  const selected = sel.id ? rows.find((c) => c.id === sel.id) ?? null : null;
  const editing = (sel.isNew && canWrite) || selected;

  return (
    <div>
      <PageHeader title="Campaigns & QR" sub="Landing pages for promotions, and tracked QR codes for everything SPP prints." actions={<><PublishSite compact />{canWrite && !editing && <Button size="sm" className="min-h-11" onClick={sel.openNew}>New campaign</Button>}</>} />
      {editing ? (
        <CampaignWorkspace key={selected?.id ?? "new"} campaign={selected} canWrite={canWrite} saving={res.saving} products={products.options} onBack={sel.close} onCreated={sel.open} actions={{ create: res.create, update: res.update, remove: res.remove, duplicate }} />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Ending within 14 days" value={res.rows ? ending.length : "—"} tone={ending.length ? "yellow" : "neutral"} hint={ending[0] ? `${ending[0].name} · ${formatDate(ending[0].ends_on)}` : undefined} />
            <Stat label="Live campaigns" value={res.rows ? counts.published : "—"} />
            <Stat label="Active QR codes" value={totals.data ? formatNumber(totals.data.activeCodes) : "—"} />
            <Stat label="Scans · 7 days" value={totals.data ? formatNumber(totals.data.scans7) : "—"} />
            <Stat label="Scans · 30 days" value={totals.data ? formatNumber(totals.data.scans30) : "—"} />
          </div>
          {overdue.length > 0 && <p role="status" className="mb-4 border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-fog-50">{overdue.length} published campaign{overdue.length > 1 ? "s are" : " is"} past the end date ({overdue.map((c) => c.name).join(", ")}). Archive {overdue.length > 1 ? "them" : "it"} so an expired offer is not left on the site.</p>}
          <div className="mb-4"><input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search campaigns" placeholder="Search campaigns…" className={clsx(inputCls, "sm:max-w-sm")} /></div>
          <Tabs label="Campaigns by status" value={tab} onChange={setTab} tabs={(["all", "draft", "published", "archived"] as Tab[]).map((t) => ({ value: t, label: t, count: res.rows ? counts[t] : null }))} />
          <ErrorNote message={res.error ?? totals.error} onRetry={() => { void res.reload(); void totals.reload(); }} />
          {sel.id && !selected && res.rows && <ErrorNote message="That campaign no longer exists, or your role cannot see it." />}
          <Panel flush>
            <DataTable caption="Campaigns" rows={res.error ? [] : shown} loading={res.loading} rowKey={(c) => c.id} onRowClick={(c) => !c.id.startsWith("tmp-") && sel.open(c.id)} empty={rows.length ? "Nothing matches that filter." : `No campaigns yet.${canWrite ? " Create the first one with “New campaign”." : ""}`}
              columns={[
                { key: "name", header: "Campaign", cell: (c) => <span className="block max-w-sm"><span className="block truncate text-fog-50">{c.name}</span><span className="block truncate text-xs text-fog-500">{c.offer || c.slug}</span></span> },
                { key: "dates", header: "Runs", hideBelow: "sm", cell: (c) => <span className="t-data whitespace-nowrap text-fog-300">{c.starts_on || c.ends_on ? `${formatDate(c.starts_on)} → ${formatDate(c.ends_on)}` : "No dates"}</span> },
                { key: "codes", header: "QR codes", hideBelow: "md", cell: (c) => <span className="t-data text-fog-300">{totals.data ? totals.data.perCampaign.get(c.id) ?? 0 : "…"}</span> },
                { key: "status", header: "Status", cell: (c) => <StatusPill status={c.status} /> },
              ]} />
          </Panel>
        </>
      )}
    </div>
  );
}

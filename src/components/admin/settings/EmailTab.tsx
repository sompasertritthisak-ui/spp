"use client";
import { useState } from "react";
import { backend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import type { EmailOutboxRow } from "@/lib/backend/db-types";
import { formatDateTime, relativeTime } from "@/lib/format";
import { DataTable, Drawer, ErrorNote, Meta, Panel, StatusPill, Tabs } from "../ui";

const PAGE = 50;
const STATUSES = ["queued", "sent", "failed", "skipped"] as const;
type Status = (typeof STATUSES)[number];
const olderThan = (iso: string, minutes: number) => Date.now() - new Date(iso).getTime() > minutes * 60_000;

/** Read-only view of the transactional email queue (admins only under RLS). */
export function EmailTab() {
  const [status, setStatus] = useState<Status>("queued");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<EmailOutboxRow | null>(null);
  const counts = useQuery<Record<Status, number>>(async () => {
    const rs = await Promise.all(STATUSES.map((s) => backend()!.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", s)));
    const bad = rs.find((r) => r.error);
    return { data: bad ? null : (Object.fromEntries(STATUSES.map((s, i) => [s, rs[i]?.count ?? 0])) as Record<Status, number>), error: bad?.error ?? null };
  }, []);
  const list = useQuery<EmailOutboxRow[]>(() => backend()!.from("email_outbox").select("*").eq("status", status).order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1), [status, page]);
  const total = counts.data?.[status] ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const oldestQueued = status === "queued" ? list.data?.at(-1) : undefined;
  const stuck = oldestQueued && olderThan(oldestQueued.created_at, 30);

  return (
    <div>
      <p className="mb-4 max-w-3xl text-sm leading-relaxed text-fog-400">Confirmation emails are written to this queue by the database and delivered by a background worker. This view is read-only. If messages sit in “queued” for a long time, the worker (Edge Function + email provider key) is not running or not configured — customers are then <strong className="text-fog-200">not</strong> receiving emails.</p>
      <Tabs label="Email status" value={status} onChange={(s) => { setStatus(s); setPage(0); }} tabs={STATUSES.map((s) => ({ value: s, label: s, count: counts.data?.[s] ?? null }))} />
      {stuck && <p role="status" className="mb-4 border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-fog-50">The oldest message on this page has been queued since {relativeTime(oldestQueued.created_at)}. The email worker is probably not running.</p>}
      <ErrorNote message={list.error ?? counts.error} onRetry={() => { void list.reload(); void counts.reload(); }} />
      <Panel flush>
        <DataTable caption="Email outbox" rows={list.error ? [] : list.data} loading={list.loading} rowKey={(r) => r.id} onRowClick={setOpen} empty={`No ${status} emails.`}
          columns={[
            { key: "to", header: "To", cell: (r) => <span className="block max-w-[14rem] truncate text-fog-50">{r.to_email}</span> },
            { key: "subject", header: "Subject", cell: (r) => <span className="block max-w-xs"><span className="block truncate text-fog-200">{r.subject}</span><span className="t-data block text-xs text-fog-500">{r.template}</span></span> },
            { key: "created", header: "Queued", hideBelow: "sm", cell: (r) => <span className="t-data whitespace-nowrap text-fog-400">{formatDateTime(r.created_at)}</span> },
            { key: "sent", header: status === "failed" ? "Error" : "Sent", hideBelow: "md", cell: (r) => status === "failed" ? <span className="block max-w-xs truncate text-xs text-danger">{r.error ?? "—"}</span> : <span className="t-data whitespace-nowrap text-fog-400">{formatDateTime(r.sent_at)}</span> },
          ]} />
        <div className="flex items-center justify-between gap-3 border-t border-ink-700 px-4 py-2.5 text-sm text-fog-400">
          <span className="t-data">{total.toLocaleString("en-US")} {status} · page {page + 1} of {pages}</span>
          <span className="flex gap-2"><button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="t-label min-h-10 border border-ink-600 px-3 hover:text-fog-50 disabled:opacity-30">Newer</button><button type="button" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} className="t-label min-h-10 border border-ink-600 px-3 hover:text-fog-50 disabled:opacity-30">Older</button></span>
        </div>
      </Panel>
      {open && (
        <Drawer open onClose={() => setOpen(null)} title={open.subject} sub={<StatusPill status={open.status} />}>
          <Meta items={[{ label: "To", value: open.to_email }, { label: "Template", value: <span className="t-data">{open.template}</span> }, { label: "Queued", value: formatDateTime(open.created_at) }, { label: "Sent", value: formatDateTime(open.sent_at) }]} />
          {open.error && <div className="mt-5"><p className="t-label mb-1 text-danger">Error</p><p className="break-words border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-fog-50">{open.error}</p></div>}
          <p className="t-label mb-2 mt-6 text-fog-300">Template variables</p>
          <Meta items={Object.entries(open.vars && typeof open.vars === "object" && !Array.isArray(open.vars) ? open.vars : {}).map(([k, v]) => ({ label: k, value: typeof v === "string" || typeof v === "number" ? String(v) : JSON.stringify(v) }))} />
        </Drawer>
      )}
    </div>
  );
}

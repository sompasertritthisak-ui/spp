"use client";
import { backend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import type { BackupSyncRow } from "@/lib/backend/db-types";
import { formatDateTime, formatNumber, relativeTime, titleCase } from "@/lib/format";
import { DataTable, ErrorNote, Panel, StatusPill } from "../ui";

const LABELS: Record<string, string> = { leads: "Leads & contact messages", quotes: "Quotes", quote_items: "Quote lines", orders: "Orders", order_items: "Order lines", billboard_bookings: "Billboard requests", consultations: "Consultations" };
const EPOCH = "1970-01-01T00:00:00+00:00";
const stale = (iso: string | null) => !iso || Date.now() - new Date(iso).getTime() > 90 * 60_000;

/**
 * Read-only status of the two automated backups. Staff can read the watermarks
 * (RLS); only the Edge Function writes them. A manual "back up now" cannot run
 * from the browser without exposing the cron secret, so the honest control is
 * the GitHub Actions "Run workflow" button, linked from the copy.
 */
export function BackupsTab() {
  const q = useQuery<BackupSyncRow[]>(() => backend()!.from("backup_sync").select("*").order("entity"), []);
  const rows = q.data;
  const neverRan = rows && rows.every((r) => !r.last_run_at);
  const lastRun = rows?.reduce<string | null>((m, r) => (r.last_run_at && (!m || r.last_run_at > m) ? r.last_run_at : m), null) ?? null;
  const errors = rows?.filter((r) => r.last_error).length ?? 0;
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-sm leading-relaxed text-fog-400">Two automatic backups run from GitHub Actions. <strong className="text-fog-200">Google Sheets mirror</strong> — every 30 minutes, each lead, quote (with lines), order (with lines), billboard request and consultation changed since the previous run is written to a Google Sheet owned by SPP, one tab per record type, updated in place by reference. <strong className="text-fog-200">Database dump</strong> — nightly encrypted <span className="t-data">pg_dump</span> kept for 30 days (see docs/BACKUP-DR.md). This page is read-only: it shows what the Sheets worker last did.</p>

      <Panel title="Google Sheets mirror" action={<span className="flex items-center gap-2 text-xs text-fog-400">{q.loading && !rows ? <span className="skeleton inline-block h-4 w-24" /> : neverRan ? <StatusPill status="not_configured" /> : errors ? <StatusPill status="attention" /> : stale(lastRun) ? <StatusPill status="attention" /> : <StatusPill status="ok" />}{lastRun && <span>last run {relativeTime(lastRun)}</span>}</span>} flush>
        <ErrorNote message={q.error} onRetry={() => void q.reload()} />
        <DataTable caption="Google Sheets backup status" rows={rows} loading={q.loading} rowKey={(r) => r.entity} empty="The backup log has not been initialised — the 0020 migration seeds one row per record type."
          columns={[
            { key: "entity", header: "Record type", cell: (r) => <span className="text-fog-50">{LABELS[r.entity] ?? titleCase(r.entity)}</span> },
            { key: "synced", header: "Synced up to", cell: (r) => <span className="t-data text-xs text-fog-300">{r.last_synced_at === EPOCH || r.last_synced_at.startsWith("1970") ? "nothing yet" : formatDateTime(r.last_synced_at)}</span> },
            { key: "run", header: "Last run", hideBelow: "sm", cell: (r) => <span className="t-data text-xs text-fog-400">{r.last_run_at ? `${formatDateTime(r.last_run_at)} · ${formatNumber(r.rows_synced)} row${r.rows_synced === 1 ? "" : "s"}` : "never"}</span> },
            { key: "state", header: "State", cell: (r) => r.last_error ? <span className="flex flex-wrap items-center gap-2"><StatusPill status="failed" /><span className="max-w-xs truncate text-xs text-danger" title={r.last_error}>{r.last_error}</span></span> : r.last_run_at ? <StatusPill status={stale(r.last_run_at) ? "attention" : "ok"} /> : <StatusPill status="queued" /> },
          ]} />
        <div className="border-t border-ink-700 px-4 py-3 text-xs leading-relaxed text-fog-500">
          {neverRan
            ? <>Not running yet. Setup takes ten minutes: create the Sheet and a Google service account, share the Sheet with the account, set <span className="t-data">GOOGLE_SA_EMAIL</span>, <span className="t-data">GOOGLE_SA_PRIVATE_KEY</span> and <span className="t-data">SHEETS_BACKUP_ID</span> as function secrets, then set the repository variable <span className="t-data">SHEETS_BACKUP_ENABLED=true</span>. Step-by-step: <span className="text-fog-300">docs/DEPLOY.md → Google Sheets backup</span>.</>
            : <>To run it now rather than waiting for the half-hour: GitHub → <span className="text-fog-300">Actions → Scheduled jobs → Run workflow</span>. A row marked <em>attention</em> has not run for over 90 minutes — check that the workflow is enabled and the secrets are still valid.</>}
        </div>
      </Panel>

      <Panel title="Nightly database dump">
        <p className="text-sm leading-relaxed text-fog-400">Runs at 01:30 Vientiane when the repository variable <span className="t-data text-fog-300">BACKUPS_ENABLED</span> is <span className="t-data text-fog-300">true</span>; the encrypted file is a private workflow artifact for 30 days. Its history is on GitHub → Actions → <span className="text-fog-300">Database backup</span>; restore steps are in docs/BACKUP-DR.md. Uploaded artwork and media are <strong className="text-fog-200">not</strong> in either backup — copy the storage buckets monthly.</p>
      </Panel>
    </div>
  );
}

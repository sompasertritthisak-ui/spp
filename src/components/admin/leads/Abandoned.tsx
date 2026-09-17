"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/Plate";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useQuery } from "@/lib/backend/hooks";
import type { AbandonedActivitiesRow } from "@/lib/backend/db-types";
import { relativeTime, titleCase } from "@/lib/format";
import { db, write } from "../ops/data";
import { ErrorNote, Panel } from "../ui";

/** High-intent sessions that stopped short. Contact is allowed ONLY with recovery consent; nothing here sends anything. */
export function Abandoned({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery<AbandonedActivitiesRow[]>(() => db().from("abandoned_activities").select("*").eq("converted", false).order("last_seen", { ascending: false }).limit(200), []);

  const markContacted = async (row: AbandonedActivitiesRow) => {
    setBusy(row.id);
    const r = await write(db().from("abandoned_activities").update({ contacted_at: new Date().toISOString() }).eq("id", row.id).select("id"));
    setBusy(null);
    if (r.error) return toast(r.error, "danger");
    toast("Marked as contacted.", "ok");
    void q.reload();
  };
  const copy = async (href: string) => {
    const url = /^https?:/.test(href) ? href : `${location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${href.startsWith("/") ? href : `/${href}`}`;
    try { await navigator.clipboard.writeText(url); toast("Resume link copied.", "ok"); } catch { toast("Could not copy — select the link and copy it manually.", "danger"); }
  };

  return (
    <Panel title="High-intent abandoned activity" flush action={<span className="t-label text-[0.625rem] text-fog-500">Manual follow-up only · nothing is emailed automatically</span>}>
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      {q.loading && !q.data && <div className="p-4"><div className="skeleton h-24" /></div>}
      {q.data?.length === 0 && <div className="p-4"><EmptyState title="No abandoned activity." body="When a visitor starts a design, quote, booking or project brief and leaves before sending it, it appears here." /></div>}
      <ul>
        {q.data?.map((a) => (
          <li key={a.id} className="grid gap-3 border-b border-ink-800 p-4 last:border-0 md:grid-cols-[1fr_1.2fr_auto] md:items-center">
            <div className="min-w-0">
              <p className="text-sm font-medium text-fog-50">{titleCase(a.flow)} <span className="text-fog-500">· stopped at</span> {titleCase(a.stage)}</p>
              <p className="t-data mt-1 truncate text-xs text-fog-400">{a.product_slug ? `${titleCase(a.product_slug)} · ` : ""}{a.ref ? `${a.ref} · ` : ""}last seen {relativeTime(a.last_seen)}</p>
            </div>
            <div className="min-w-0 text-sm">
              {a.recovery_consent && a.contact_email ? (
                <p className="flex flex-wrap items-center gap-2"><Badge tone="ok">Consent given</Badge><a href={`mailto:${a.contact_email}`} className="truncate text-fog-50 underline decoration-ink-500 underline-offset-4 hover:decoration-yellow">{a.contact_email}</a></p>
              ) : (
                <p className="flex flex-wrap items-center gap-2"><Badge tone="danger">No consent — do not contact</Badge><span className="text-xs text-fog-500">No contact details were stored.</span></p>
              )}
              {a.contacted_at && <p className="mt-1 text-xs text-fog-500">Contacted {relativeTime(a.contacted_at)}</p>}
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              {a.resume_href && <button type="button" onClick={() => void copy(a.resume_href)} className="t-label min-h-9 border border-ink-600 px-3 text-[0.625rem] text-fog-300 hover:border-yellow hover:text-yellow">Copy resume link</button>}
              {canEdit && a.recovery_consent && !a.contacted_at && <button type="button" disabled={busy === a.id} onClick={() => void markContacted(a)} className="t-label min-h-9 border border-ink-600 px-3 text-[0.625rem] text-fog-300 hover:border-yellow hover:text-yellow disabled:opacity-50">Mark contacted</button>}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

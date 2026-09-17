"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/backend/auth";
import { useQuery } from "@/lib/backend/hooks";
import type { LeadActivitiesRow } from "@/lib/backend/db-types";
import { formatDateTime, titleCase } from "@/lib/format";
import { db, exec } from "../ops/data";
import { SectionTitle } from "../ops/parts";
import { adminInput, ErrorNote } from "../ui";
import { ACTIVITY_KINDS, type ActivityKind } from "./constants";

/** The lead's history. Status and assignment changes are written by a database trigger; staff log the human contact. */
export function LeadTimeline({ leadId, canEdit, staffName, version }: { leadId: string; canEdit: boolean; staffName: (id: string | null) => string; version: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const [kind, setKind] = useState<ActivityKind>("note");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const acts = useQuery<LeadActivitiesRow[]>(() => db().from("lead_activities").select("*").eq("lead_id", leadId).order("at", { ascending: false }).limit(100), [leadId, version]);

  const log = async () => {
    if (!body.trim() || !user) return;
    setBusy(true);
    const r = await exec(db().from("lead_activities").insert({ lead_id: leadId, kind, body: body.trim(), actor: user.id }));
    setBusy(false);
    if (r.error) return toast(r.error, "danger");
    setBody("");
    toast(`${titleCase(kind)} logged.`, "ok");
    void acts.reload();
  };

  return (
    <section aria-label="Timeline">
      <SectionTitle>Timeline</SectionTitle>
      {canEdit && (
        <div className="mb-4 flex flex-col gap-2 border border-ink-700 bg-ink-950 p-3">
          <div role="radiogroup" aria-label="Activity type" className="flex flex-wrap gap-1">
            {ACTIVITY_KINDS.map((k) => <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`t-label min-h-9 border px-3 text-[0.625rem] ${kind === k ? "border-yellow text-yellow" : "border-ink-600 text-fog-400 hover:text-fog-50"}`}>{k}</button>)}
          </div>
          <textarea aria-label={`Log a ${kind}`} value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder={kind === "note" ? "What should the team know?" : `What was said on the ${kind}?`} className={`${adminInput} resize-y py-2`} />
          <div className="flex justify-end"><Button size="sm" variant="outline" loading={busy} disabled={!body.trim()} onClick={() => void log()}>Log {kind}</Button></div>
        </div>
      )}
      <ErrorNote message={acts.error} onRetry={() => void acts.reload()} />
      <ol className="relative ml-1.5 border-l border-ink-700">
        {acts.loading && !acts.data && <li className="skeleton ml-4 h-10" />}
        {acts.data?.map((a) => (
          <li key={a.id} className="relative pb-4 pl-5 last:pb-0">
            <span aria-hidden className={`absolute -left-[0.2rem] top-1.5 h-1.5 w-1.5 ${a.kind === "status" || a.kind === "created" ? "bg-yellow" : "bg-fog-500"}`} />
            <p className="t-label text-[0.625rem] text-fog-500">{a.kind} · {formatDateTime(a.at)} · {a.actor ? staffName(a.actor) : "System"}</p>
            {a.body && <p className="mt-0.5 whitespace-pre-wrap text-sm text-fog-100">{a.body}</p>}
          </li>
        ))}
        {acts.data?.length === 0 && <li className="pl-5 text-sm text-fog-500">No activity yet.</li>}
      </ol>
    </section>
  );
}

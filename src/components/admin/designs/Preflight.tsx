"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/backend/auth";
import type { ArtworkPreflightsRow, PreflightVerdict } from "@/lib/backend/db-types";
import { formatDateTime, titleCase } from "@/lib/format";
import { db, exec, write } from "../ops/data";
import { Labeled, PickField, SectionTitle } from "../ops/parts";
import { adminInput, ErrorNote, StatusPill } from "../ui";

type Check = { id?: string; level?: string; title?: string; detail?: string; side?: string };
const VERDICTS: readonly PreflightVerdict[] = ["ready", "attention", "blocked"];
const asChecks = (j: unknown): Check[] => (Array.isArray(j) ? (j as Check[]).filter((c) => c && typeof c === "object") : []);
const levelTone = (l?: string) => (l === "error" || l === "blocked" || l === "fail" ? "text-danger" : l === "warn" || l === "warning" || l === "attention" ? "text-warn" : "text-ok");

export const ADVISORY = "Automated preflight checks are advisory. Final production approval is subject to SPP review.";

/** Automated result + the staff sign-off that always overrides it. */
export function Preflight({ designId, version, latest, canReview, staffName, onSaved }: { designId: string; version: number; latest: ArtworkPreflightsRow | null; canReview: boolean; staffName: (id: string | null) => string; onSaved: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [verdict, setVerdict] = useState<PreflightVerdict>(latest?.review_verdict ?? latest?.verdict ?? "ready");
  const [note, setNote] = useState(latest?.review_note ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const checks = asChecks(latest?.checks);

  const save = async () => {
    if (!user) return;
    if (verdict !== "ready" && note.trim().length < 3) return setErr("Add a note explaining what needs attention.");
    setBusy(true); setErr(null);
    const review = { reviewed_by: user.id, review_verdict: verdict, review_note: note.trim() };
    // No automated run on record → store the manual review as its own row so the sign-off is never lost.
    const r = latest ? await write(db().from("artwork_preflights").update(review).eq("id", latest.id).select("id")) : await exec(db().from("artwork_preflights").insert({ design_id: designId, design_version: version, verdict, checks: [], ...review }));
    setBusy(false);
    if (r.error) return setErr(r.error);
    toast("Staff review saved.", "ok"); onSaved();
  };

  return (
    <section aria-label="Preflight">
      <SectionTitle>Automated preflight</SectionTitle>
      {latest ? (
        <>
          <p className="flex flex-wrap items-center gap-2 text-sm text-fog-300"><StatusPill status={latest.verdict} /><span className="t-label text-[0.625rem] text-fog-500">on v{latest.design_version} · {formatDateTime(latest.created_at)}</span>{latest.design_version !== version && <span className="t-label border border-warn/50 px-1.5 py-0.5 text-[0.5625rem] text-warn">Design has changed since (now v{version})</span>}</p>
          <ul className="mt-3 flex flex-col">
            {checks.map((c, i) => <li key={c.id ?? i} className="grid grid-cols-[4.5rem_1fr] gap-3 border-b border-ink-800 py-2 text-sm last:border-0"><span className={`t-label text-[0.625rem] ${levelTone(c.level)}`}>{c.level ?? "info"}</span><span><span className="text-fog-50">{c.title ?? "Check"}</span>{c.side && <span className="t-label ml-2 text-[0.5625rem] text-fog-500">{c.side}</span>}{c.detail && <span className="mt-0.5 block text-xs text-fog-400">{c.detail}</span>}</span></li>)}
            {checks.length === 0 && <li className="text-sm text-fog-500">No individual findings were recorded.</li>}
          </ul>
        </>
      ) : <p className="text-sm text-fog-500">No automated preflight has been run on this design. Review it by eye below.</p>}
      <p className="mt-3 border-l-2 border-ink-600 pl-3 text-xs italic text-fog-400">{ADVISORY}</p>

      <SectionTitle>Staff review</SectionTitle>
      {latest?.reviewed_by && <p className="mb-3 text-xs text-fog-400">Last reviewed by {staffName(latest.reviewed_by)} — <span className="text-fog-100">{titleCase(latest.review_verdict ?? "")}</span></p>}
      {canReview ? (
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <div className="sm:col-span-2"><ErrorNote message={err} /></div>
          <PickField label="SPP verdict" value={verdict} options={VERDICTS} onChange={setVerdict} labels={{ ready: "Ready for production", attention: "Needs attention", blocked: "Blocked — cannot print" }} />
          <Labeled label="Review note">{(id) => <textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Resolution, colour, bleed, placement…" className={`${adminInput} resize-y py-2`} />}</Labeled>
          <div className="flex justify-end sm:col-span-2"><Button type="submit" size="sm" variant="outline" loading={busy}>Save review</Button></div>
        </form>
      ) : <p className="text-sm text-fog-500">{latest?.review_note || "No staff review yet."}</p>}
    </section>
  );
}

"use client";
import { clsx } from "clsx";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useQuery } from "@/lib/backend/hooks";
import type { QcResult, QualityChecksRow } from "@/lib/backend/db-types";
import { formatDateTime } from "@/lib/format";
import { db, exec } from "../ops/data";
import { SectionTitle } from "../ops/parts";
import { adminInput, ErrorNote, StatusPill } from "../ui";
import { QC_ITEMS, type QcLine } from "./shared";

const blank = (): QcLine[] => QC_ITEMS.map((i) => ({ key: i.key, label: i.label, ok: null, note: "" }));
const CHOICES: { label: string; value: "pass" | "fail" | "na" }[] = [{ label: "Pass", value: "pass" }, { label: "Fail", value: "fail" }, { label: "N/A", value: "na" }];
const asLines = (j: unknown): QcLine[] => (Array.isArray(j) ? (j as QcLine[]).filter((l) => l && typeof l === "object" && "label" in l) : []);

/** The 8-point check. PASS completes the job (and readies the order when every job has passed); FAIL sends it back to production. */
export function QcPanel({ jobId, canRecord, staffName, onRecorded }: { jobId: string; canRecord: boolean; staffName: (id: string | null) => string; onRecorded: () => void }) {
  const toast = useToast();
  const history = useQuery<QualityChecksRow[]>(() => db().from("quality_checks").select("*").eq("job_id", jobId).order("checked_at", { ascending: false }), [jobId]);
  const [lines, setLines] = useState<QcLine[]>(blank);
  const [state, setState] = useState<Record<string, "pass" | "fail" | "na">>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<QcResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const answered = QC_ITEMS.every((i) => state[i.key]);
  const anyFail = Object.values(state).includes("fail");

  const record = async (result: QcResult) => {
    if (!answered) return setErr("Answer every checklist item (pass, fail or n/a) before recording a result.");
    if (result === "pass" && anyFail) return setErr("A job with a failed item cannot PASS. Record FAIL or NEEDS REVIEW.");
    if (result !== "pass" && !note.trim() && !lines.some((l) => l.note.trim())) return setErr("Say what is wrong — add a note so production knows what to fix.");
    setErr(null); setBusy(result);
    const checklist = lines.map((l) => ({ ...l, ok: state[l.key] === "pass" ? true : state[l.key] === "fail" ? false : null, na: state[l.key] === "na", note: l.note.trim() }));
    const r = await exec(db().rpc("record_qc", { job: jobId, checklist, result, note: note.trim() }));
    setBusy(null);
    if (r.error) return setErr(r.error);
    toast(result === "pass" ? "QC PASS recorded — job done." : result === "fail" ? "QC FAIL recorded — job returned to production." : "Marked NEEDS REVIEW — job stays in QC.", result === "pass" ? "ok" : "neutral");
    setLines(blank()); setState({}); setNote("");
    void history.reload(); onRecorded();
  };

  return (
    <section aria-label="Quality control">
      <SectionTitle>Quality control</SectionTitle>
      {canRecord ? (
        <div className="border border-ink-700 bg-ink-950 p-3">
          <ErrorNote message={err} />
          <ol className="flex flex-col">
            {lines.map((l, n) => (
              <li key={l.key} className="grid gap-2 border-b border-ink-800 py-2.5 last:border-0 sm:grid-cols-[10rem_auto_1fr] sm:items-center">
                <p id={`qc-${l.key}`} className="text-sm text-fog-50"><span className="t-data mr-2 text-[0.625rem] text-fog-500">{String(n + 1).padStart(2, "0")}</span>{l.label}</p>
                <div role="radiogroup" aria-labelledby={`qc-${l.key}`} className="flex gap-1">
                  {CHOICES.map((c) => { const on = state[l.key] === c.value; return <button key={c.value} type="button" role="radio" aria-checked={on} onClick={() => setState((s) => ({ ...s, [l.key]: c.value }))} className={clsx("t-label min-h-9 min-w-14 border px-2 text-[0.625rem]", on ? (c.value === "pass" ? "border-ok bg-ok/10 text-ok" : c.value === "fail" ? "border-danger bg-danger/10 text-danger" : "border-fog-400 text-fog-50") : "border-ink-600 text-fog-500 hover:text-fog-100")}>{on && <span aria-hidden>● </span>}{c.label}</button>; })}
                </div>
                <input aria-label={`Note for ${l.label}`} value={l.note} onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, note: e.target.value } : x)))} placeholder="Note (optional)" maxLength={300} className={`${adminInput} min-h-9`} />
              </li>
            ))}
          </ol>
          <textarea aria-label="Overall QC note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} placeholder="Overall note — required for FAIL or NEEDS REVIEW" className={`${adminInput} mt-3 resize-y py-2`} />
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" loading={busy === "needs_review"} disabled={busy != null} onClick={() => void record("needs_review")}>Needs review</Button>
            <Button size="sm" variant="danger" loading={busy === "fail"} disabled={busy != null} onClick={() => void record("fail")}>Fail</Button>
            <Button size="sm" loading={busy === "pass"} disabled={busy != null || anyFail} onClick={() => void record("pass")}>Pass</Button>
          </div>
        </div>
      ) : <p className="text-sm text-fog-500">QC results are recorded by the production team. History is shown below.</p>}

      <h4 className="t-label mb-2 mt-5 text-[0.625rem] text-fog-500">QC history</h4>
      <ErrorNote message={history.error} onRetry={() => void history.reload()} />
      {history.loading && !history.data && <div className="skeleton h-10" />}
      {history.data?.length === 0 && <p className="text-sm text-fog-500">No checks recorded for this job yet.</p>}
      <ul className="flex flex-col gap-2">
        {history.data?.map((h) => {
          const ls = asLines(h.checklist), failed = ls.filter((l) => l.ok === false);
          return (
            <li key={h.id} className="border border-ink-700 p-3 text-sm">
              <p className="flex flex-wrap items-center gap-2"><StatusPill status={h.result} /><span className="t-label text-[0.625rem] text-fog-500">{formatDateTime(h.checked_at)} · {staffName(h.checked_by)}</span></p>
              {failed.length > 0 && <p className="mt-1.5 text-xs text-danger">Failed: {failed.map((l) => `${l.label}${l.note ? ` (${l.note})` : ""}`).join(", ")}</p>}
              {h.note && <p className="mt-1.5 whitespace-pre-wrap text-fog-100">{h.note}</p>}
              {ls.length > 0 && <details className="mt-1.5 text-xs text-fog-400"><summary className="cursor-pointer">Full checklist</summary><ul className="mt-1.5 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">{ls.map((l) => <li key={l.key}>{l.label}: <span className="text-fog-100">{l.ok === true ? "pass" : l.ok === false ? "fail" : "n/a"}</span>{l.note ? ` — ${l.note}` : ""}</li>)}</ul></details>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

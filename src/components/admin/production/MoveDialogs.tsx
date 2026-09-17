"use client";
import { useState } from "react";
import { Confirm, Labeled } from "../ops/parts";
import { adminInput } from "../ui";
import type { Job } from "./shared";

/** Blocking a job always records why — a bare BLOCKED tells the next shift nothing. */
export function BlockDialog({ job, pending, onConfirm, onClose }: { job: Job | null; pending: boolean; onConfirm: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const bad = reason.trim().length < 3;
  return (
    <Confirm open={Boolean(job)} danger title="Block this job" confirmLabel="Mark blocked" pending={pending} onClose={onClose} onConfirm={() => { setTouched(true); if (!bad) onConfirm(reason.trim()); }} body={<>What is <strong className="text-fog-50">{job?.ref}</strong> waiting on? It shows on the card and on the Command Center.</>}>
      <Labeled label="Blocked reason (required)" error={touched && bad ? "Say what the job is waiting on." : null}>{(id) => <input id={id} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Waiting for navy polo blanks — due Thursday" className={adminInput} />}</Labeled>
    </Confirm>
  );
}

export function DoneDialog({ job, pending, onConfirm, onClose }: { job: Job | null; pending: boolean; onConfirm: () => void; onClose: () => void }) {
  return <Confirm open={Boolean(job)} title="Mark done without a QC pass?" confirmLabel="Mark done anyway" pending={pending} onClose={onClose} onConfirm={onConfirm} body={<>A job normally completes through a <strong className="text-fog-50">QC PASS</strong>, which also readies the order and opens the delivery. Marking {job?.ref} done by hand skips that — the order will not advance on its own. Open the job and record QC instead unless you are sure.</>} />;
}

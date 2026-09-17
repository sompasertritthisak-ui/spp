"use client";
import { useState } from "react";
import { adminInput } from "../ui";
import { Confirm, Labeled } from "../ops/parts";
import type { Lead } from "./constants";

const REASONS = ["Price", "Timing", "Went with a competitor", "No response", "Not a fit", "Duplicate / spam"];

/** A lead can only be closed as lost with a reason — it is what makes the loss analysable later. */
export function LostDialog({ lead, pending, onConfirm, onClose }: { lead: Lead | null; pending: boolean; onConfirm: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const bad = reason.trim().length < 3;
  return (
    <Confirm open={Boolean(lead)} title="Mark lead as lost" danger confirmLabel="Mark as lost" pending={pending} onClose={onClose} onConfirm={() => { setTouched(true); if (!bad) onConfirm(reason.trim()); }}
      body={<>Closing <strong className="text-fog-50">{lead?.name}</strong> ({lead?.ref}) as lost. Record why, so the team can learn from it.</>}>
      <Labeled label="Lost reason (required)" error={touched && bad ? "Give a short reason." : null}>
        {(id) => <input id={id} value={reason} onChange={(e) => setReason(e.target.value)} list="lost-reasons" maxLength={300} className={adminInput} placeholder="e.g. Price — chose a cheaper supplier" />}
      </Labeled>
      <datalist id="lost-reasons">{REASONS.map((r) => <option key={r} value={r} />)}</datalist>
    </Confirm>
  );
}

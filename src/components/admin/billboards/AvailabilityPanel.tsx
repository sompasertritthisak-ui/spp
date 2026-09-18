"use client";
import { clsx } from "clsx";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { BillboardAvailabilityRow } from "@/lib/backend/db-types";
import { formatDate } from "@/lib/format";
import { useConfirm } from "../resource/Confirm";
import { DateField, SelectField, TextField } from "../resource/fields";
import { useResource } from "../resource/useResource";
import { ErrorNote } from "../ui";
import { daysBetween, isoDay, overlaps } from "./shared";

const firstOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); };
const KIND_STYLE: Record<string, string> = { booked: "bg-ok/25 border-ok text-ok", hold: "bg-warn/20 border-warn text-warn", maintenance: "bg-danger/20 border-danger text-danger" };
const MONTHS = 12;

/** 12-month timeline + list of availability blocks. Holds and maintenance are managed here; "booked" blocks only ever come from confirming a booking. */
export function AvailabilityPanel({ billboardId, canWrite }: { billboardId: string; canWrite: boolean }) {
  const res = useResource("billboard_availability", { order: [{ column: "starts_on" }], singular: "Block", filter: { column: "billboard_id", value: billboardId } });
  const [from] = useState(firstOfMonth);
  const [confirm, confirmUi] = useConfirm();
  const [draft, setDraft] = useState<{ kind: "hold" | "maintenance"; starts_on: string | null; ends_on: string | null; note: string }>({ kind: "hold", starts_on: null, ends_on: null, note: "" });
  const [error, setError] = useState<string | null>(null);

  const months = useMemo(() => Array.from({ length: MONTHS }, (_, i) => new Date(from.getFullYear(), from.getMonth() + i, 1)), [from]);
  const end = useMemo(() => new Date(from.getFullYear(), from.getMonth() + MONTHS, 0), [from]);
  const total = daysBetween(isoDay(from), isoDay(end));
  const blocks = useMemo(() => res.rows ?? [], [res.rows]);
  const visible = blocks.filter((b) => overlaps(b.starts_on, b.ends_on, isoDay(from), isoDay(end)));
  const pos = (b: BillboardAvailabilityRow) => { const s = b.starts_on < isoDay(from) ? isoDay(from) : b.starts_on; const e = b.ends_on > isoDay(end) ? isoDay(end) : b.ends_on; return { left: `${((daysBetween(isoDay(from), s) - 1) / total) * 100}%`, width: `${Math.max((daysBetween(s, e) / total) * 100, 0.6)}%` }; };
  const clash = draft.starts_on && draft.ends_on ? blocks.filter((b) => overlaps(b.starts_on, b.ends_on, draft.starts_on!, draft.ends_on!)) : [];

  const add = async () => {
    if (!draft.starts_on || !draft.ends_on) return setError("Choose both a start and an end date.");
    if (draft.ends_on < draft.starts_on) return setError("The end date cannot be before the start date.");
    if (clash.length && !(await confirm({ title: "These dates overlap an existing block", body: <>They overlap {clash.length} existing block{clash.length > 1 ? "s" : ""} ({clash.map((c) => c.kind).join(", ")}). Add the block anyway?</>, confirmLabel: "Add anyway" }))) return;
    setError(null);
    if (await res.create({ billboard_id: billboardId, kind: draft.kind, starts_on: draft.starts_on, ends_on: draft.ends_on, note: draft.note.trim() })) setDraft({ kind: draft.kind, starts_on: null, ends_on: null, note: "" });
  };
  const del = async (b: BillboardAvailabilityRow) => { if (await confirm({ title: `Remove this ${b.kind} block?`, danger: true, confirmLabel: "Remove block", body: <>{formatDate(b.starts_on)} → {formatDate(b.ends_on)} becomes free again on the public availability calendar.</> })) await res.remove(b.id); };

  return (
    <div>
      <ErrorNote message={res.error} onRetry={() => void res.reload()} />
      <div className="thin-scroll overflow-x-auto" role="img" aria-label={`Availability for the next ${MONTHS} months: ${visible.length ? visible.map((b) => `${b.kind} ${formatDate(b.starts_on)} to ${formatDate(b.ends_on)}`).join("; ") : "no blocks — free throughout"}`}>
        <div className="min-w-[44rem]">
          <div className="grid border-b border-ink-700" style={{ gridTemplateColumns: `repeat(${MONTHS}, minmax(0, 1fr))` }}>{months.map((m) => <span key={m.toISOString()} className="t-label border-l border-ink-800 px-1 py-1.5 text-[0.625rem] text-fog-500 first:border-l-0">{m.toLocaleString("en-GB", { month: "short" })} {m.getMonth() === 0 || m === months[0] ? String(m.getFullYear()).slice(2) : ""}</span>)}</div>
          <div className="relative h-14 bg-ink-950">
            <div aria-hidden className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${MONTHS}, minmax(0, 1fr))` }}>{months.map((m) => <span key={m.toISOString()} className="border-l border-ink-800 first:border-l-0" />)}</div>
            {visible.map((b) => <span key={b.id} style={pos(b)} title={`${b.kind}: ${formatDate(b.starts_on)} → ${formatDate(b.ends_on)}${b.note ? ` · ${b.note}` : ""}`} className={clsx("t-label absolute top-2 flex h-10 items-center overflow-hidden border-l-2 px-1.5 text-[0.625rem]", KIND_STYLE[b.kind])}>{b.kind}</span>)}
          </div>
        </div>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fog-500"><span><span className="t-label text-ok">Booked</span> confirmed campaign</span><span><span className="t-label text-warn">Hold</span> pencilled for a client</span><span><span className="t-label text-danger">Maintenance</span> not rentable</span><span>Dates (never names) are public on the site after a publish.</span></p>

      {res.loading && !res.rows && <div className="skeleton mt-4 h-20" />}
      {res.rows && blocks.length === 0 && <p className="mt-4 text-sm text-fog-500">No blocks — this site is free for any dates.</p>}
      <ul className="mt-4 divide-y divide-ink-800 border-y border-ink-800 empty:hidden">
        {blocks.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
            <span className={clsx("t-label w-24 flex-none", KIND_STYLE[b.kind]?.split(" ").at(-1))}>{b.kind}</span>
            <span className="t-data text-fog-100">{formatDate(b.starts_on)} → {formatDate(b.ends_on)}</span>
            <span className="min-w-0 flex-1 truncate text-fog-400">{b.note}</span>
            {b.kind === "booked" ? (b.booking_id ? <Link href={`/admin/billboards/?tab=bookings&booking=${b.booking_id}`} className="t-label text-yellow hover:text-fog-50">Open booking</Link> : <span className="text-xs text-fog-500">From a booking</span>) : canWrite && <button type="button" disabled={b.id.startsWith("tmp-")} onClick={() => void del(b)} className="t-label min-h-10 text-fog-400 hover:text-danger">Remove</button>}
          </li>
        ))}
      </ul>

      {canWrite && (
        <form className="mt-5 grid items-end gap-3 border border-ink-700 bg-ink-950/50 p-4 sm:grid-cols-2 lg:grid-cols-[10rem_1fr_1fr_1.4fr_auto]" onSubmit={(e) => { e.preventDefault(); void add(); }}>
          <SelectField label="Block type" value={draft.kind} onChange={(v) => setDraft({ ...draft, kind: v })} options={[{ value: "hold", label: "Hold" }, { value: "maintenance", label: "Maintenance" }]} />
          <DateField label="From" required value={draft.starts_on} onChange={(v) => { setDraft({ ...draft, starts_on: v }); setError(null); }} />
          <DateField label="To" required value={draft.ends_on} min={draft.starts_on ?? undefined} onChange={(v) => { setDraft({ ...draft, ends_on: v }); setError(null); }} />
          <TextField label="Note" value={draft.note} onChange={(v) => setDraft({ ...draft, note: v })} maxLength={200} placeholder="e.g. held for Beerlao until Friday" />
          <Button type="submit" variant="outline" size="sm" className="min-h-11" loading={res.saving}>Add block</Button>
          <div aria-live="polite" className="sm:col-span-2 lg:col-span-5">{error && <p role="alert" className="text-sm text-danger">{error}</p>}{!error && clash.length > 0 && <p className="text-sm text-warn">These dates overlap {clash.length} existing block{clash.length > 1 ? "s" : ""}.</p>}<p className="mt-1 text-xs text-fog-500">“Booked” blocks cannot be added here: they are created when a booking enquiry is confirmed, so every booked date traces back to a customer.</p></div>
        </form>
      )}
      {confirmUi}
    </div>
  );
}

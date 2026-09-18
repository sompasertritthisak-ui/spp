"use client";
import { clsx } from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { backend } from "@/lib/backend/client";
import type { CampaignQrCodesRow, CampaignsRow } from "@/lib/backend/db-types";
import { formatNumber, relativeTime, titleCase } from "@/lib/format";
import { Modal, useConfirm } from "../resource/Confirm";
import { adminError, messageOf } from "../resource/errors";
import { SelectField, TextField, ToggleField } from "../resource/fields";
import { useOptions } from "../resource/pickers";
import { useResource } from "../resource/useResource";
import { ErrorNote } from "../ui";
import { downloadPng, downloadSvg, MEDIUMS, pointsAtLocalhost, qrSvg, qrUrl, randomCode } from "./qr";

export type ScanStats = Map<string, { count: number; last: string | null }>;
type Draft = { id: string | null; label: string; medium: string; billboard_id: string; destination: string; active: boolean };
const BLANK: Draft = { id: null, label: "", medium: "billboard", billboard_id: "", destination: "", active: true };

function QrImage({ code, className }: { code: string; className?: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => { let alive = true; void qrSvg(code).then((s) => { if (alive) setSvg(s); }); return () => { alive = false; }; }, [code]);
  // The markup comes from the local `qrcode` library (rects and paths only), never from user HTML.
  return svg ? <div role="img" aria-label={`QR code ${code}`} className={clsx("bg-white [&>svg]:block [&>svg]:h-full [&>svg]:w-full", className)} dangerouslySetInnerHTML={{ __html: svg }} /> : <div className={clsx("skeleton", className)} />;
}

export function QrPanel({ campaign, canWrite, stats, onChanged }: { campaign: CampaignsRow; canWrite: boolean; stats: ScanStats; onChanged: () => void }) {
  const toast = useToast();
  const res = useResource("campaign_qr_codes", { order: [{ column: "created_at", ascending: false }], singular: "QR code", filter: { column: "campaign_id", value: campaign.id } });
  const boards = useOptions("billboards", "id", "name", "code");
  const boardOptions = useMemo(() => [{ value: "", label: "— not linked to a site —" }, ...boards.options.map((b) => ({ value: b.value, label: `${b.hint} · ${b.label}` }))], [boards.options]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, confirmUi] = useConfirm();

  const save = async () => {
    if (!draft) return;
    const e: Record<string, string> = {};
    if (draft.label.trim().length < 2) e.label = "Say where this code will be printed, e.g. “Patuxai billboard, face A”.";
    if (draft.destination && !/^\/[^\s]*$/.test(draft.destination)) e.destination = "Use a path on this site starting with /, e.g. /products/custom-t-shirt/ — or leave empty.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const payload = { label: draft.label.trim(), medium: draft.medium, billboard_id: draft.medium === "billboard" && draft.billboard_id ? draft.billboard_id : null, destination: draft.destination.trim(), active: draft.active };
    if (draft.id) { if (await res.update(draft.id, payload)) setDraft(null); return; }
    // Codes are random; on the (very unlikely) collision the unique index refuses and we draw again.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      const taken = await backend()!.from("campaign_qr_codes").select("id", { count: "exact", head: true }).eq("code", code);
      if ((taken.count ?? 0) > 0) continue;
      const r = await backend()!.from("campaign_qr_codes").insert({ ...payload, code, campaign_id: campaign.id }).select("*").single();
      if (r.error?.code === "23505") continue;
      if (r.error) return toast(adminError(r.error), "danger");
      res.setRows((rs) => [r.data as CampaignQrCodesRow, ...(rs ?? [])]);
      toast(`QR code ${code} created.`, "ok");
      onChanged();
      return setDraft(null);
    }
    toast("A unique code could not be generated. Please try again.", "danger");
  };
  const del = async (q: CampaignQrCodesRow) => {
    const n = stats.get(q.id)?.count ?? 0;
    if (await confirm({ title: `Delete QR code ${q.code}?`, danger: true, confirmLabel: "Delete code", body: <>Anything already printed with this code will lead to the home page and stop being counted.{n > 0 && <strong className="mt-2 block text-warn">Its {formatNumber(n)} recorded scan{n === 1 ? "" : "s"} will be deleted too.</strong>} Switch it off instead if you only want to pause it.</> })) { if (await res.remove(q.id)) onChanged(); }
  };
  const dl = async (q: CampaignQrCodesRow, kind: "svg" | "png") => { setBusy(`${q.id}-${kind}`); try { await (kind === "svg" ? downloadSvg(q.code) : downloadPng(q.code)); } catch (e) { toast(`The ${kind.toUpperCase()} could not be generated: ${messageOf(e)}`, "danger"); } setBusy(null); };

  return (
    <div>
      {pointsAtLocalhost && <p role="status" className="mb-4 border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-fog-50"><strong className="t-label mr-2">Do not print these</strong>This build has no NEXT_PUBLIC_SITE_URL, so the codes point at localhost. Generate print files from the live Command Center.</p>}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm leading-relaxed text-fog-400">One code per placement, so you can see which billboard, poster or flyer is working. Codes lead to a tracked redirect: you can change where a printed code goes later without reprinting. They work as soon as they are created — no site publish needed.</p>
        {canWrite && <Button size="sm" className="min-h-11" onClick={() => { setErrors({}); setDraft(BLANK); }}>Generate QR code</Button>}
      </div>
      <ErrorNote message={res.error} onRetry={() => void res.reload()} />
      {res.loading && !res.rows && <div className="skeleton h-40" />}
      {res.rows?.length === 0 && <p className="border border-dashed border-ink-600 px-4 py-10 text-center text-sm text-fog-500">No QR codes for this campaign yet.</p>}
      <ul className="grid gap-3 xl:grid-cols-2">
        {res.rows?.map((q) => {
          const s = stats.get(q.id);
          return (
            <li key={q.id} className={clsx("flex gap-4 border border-ink-700 bg-ink-950 p-3", !q.active && "opacity-70")}>
              <QrImage code={q.code} className="h-28 w-28 flex-none sm:h-32 sm:w-32" />
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-sm text-fog-50">{q.label || "Unlabelled"}</p>
                <p className="t-label mt-0.5 text-[0.625rem] text-fog-500">{q.medium} · <span className="t-data normal-case tracking-normal">{q.code}</span></p>
                <p className="t-data mt-1 break-all text-[0.6875rem] text-fog-500">{qrUrl(q.code)}</p>
                <p className="mt-1 text-xs text-fog-400">→ {q.destination || `campaign page (/campaigns/?c=${campaign.slug})`}</p>
                <p className="mt-2 text-sm"><span className="t-data text-lg text-yellow">{formatNumber(s?.count ?? 0)}</span> <span className="text-fog-400">scan{s?.count === 1 ? "" : "s"}{s?.last ? ` · last ${relativeTime(s.last)}` : ""}</span></p>
                <div className="mt-auto flex flex-wrap items-center gap-x-1 pt-2">
                  <button type="button" disabled={busy !== null} onClick={() => void dl(q, "svg")} className="t-label min-h-10 px-2 text-yellow hover:text-fog-50 disabled:opacity-50">{busy === `${q.id}-svg` ? "…" : "SVG"}</button>
                  <button type="button" disabled={busy !== null} onClick={() => void dl(q, "png")} className="t-label min-h-10 px-2 text-yellow hover:text-fog-50 disabled:opacity-50">{busy === `${q.id}-png` ? "…" : "PNG 2048px"}</button>
                  {canWrite && <>
                    <button type="button" role="switch" aria-checked={q.active} onClick={() => void res.update(q.id, { active: !q.active }, { message: q.active ? "Code paused — scans go to the home page and are not counted." : "Code active again." })} className={clsx("t-label min-h-10 px-2", q.active ? "text-ok" : "text-fog-500")}>{q.active ? "Active" : "Paused"}</button>
                    <button type="button" onClick={() => { setErrors({}); setDraft({ id: q.id, label: q.label, medium: q.medium, billboard_id: q.billboard_id ?? "", destination: q.destination, active: q.active }); }} className="t-label min-h-10 px-2 text-fog-300 hover:text-fog-50">Edit</button>
                    <button type="button" onClick={() => void del(q)} className="t-label min-h-10 px-2 text-fog-300 hover:text-danger">Delete</button>
                  </>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-5 border-t border-ink-700 pt-4 text-xs leading-relaxed text-fog-500">
        <p className="t-label mb-1 text-fog-400">Printing a code that scans</p>
        <p>Use the SVG for anything a printer will scale (billboards, vehicles); the PNG is 2048 px for documents. Keep it black on white and keep the white border — scanners need that quiet zone. Size it at roughly one tenth of the scanning distance: 2–3 cm on a flyer held at arm&apos;s length, about 1 m across for a billboard read from 10 m. Test the printed proof with two different phones before the run.</p>
      </div>

      <Modal open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? "Edit QR code" : "Generate a QR code"} footer={<><Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button><Button loading={res.saving} onClick={() => void save()}>{draft?.id ? "Save" : "Generate"}</Button></>}>
        {draft && (
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <TextField label="Label" required value={draft.label} error={errors.label} onChange={(v) => setDraft({ ...draft, label: v })} placeholder="Patuxai billboard, face A" maxLength={120} />
            <SelectField label="Medium" value={draft.medium} onChange={(v) => setDraft({ ...draft, medium: v })} options={MEDIUMS.map((m) => ({ value: m, label: titleCase(m) }))} />
            {draft.medium === "billboard" && <SelectField label="Billboard site" value={draft.billboard_id} onChange={(v) => setDraft({ ...draft, billboard_id: v })} options={boardOptions} />}
            <TextField label="Destination override" value={draft.destination} error={errors.destination} onChange={(v) => setDraft({ ...draft, destination: v.trim() })} placeholder="/products/custom-t-shirt/" hint="Leave empty to send people to this campaign's page. You can change this after printing." />
            <ToggleField label="Status" value={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} onLabel="Active — scans are counted and redirected" offLabel="Paused — scans go to the home page, uncounted" />
            {!draft.id && <p className="text-sm text-fog-400">A random 8-character code is generated for you. It cannot be changed afterwards, because it will be in print.</p>}
            <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>Save</button>
          </form>
        )}
      </Modal>
      {confirmUi}
    </div>
  );
}

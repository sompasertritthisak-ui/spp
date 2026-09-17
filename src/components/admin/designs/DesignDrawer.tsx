"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useQuery } from "@/lib/backend/hooks";
import type { ArtworkPreflightsRow, DesignAssetsRow, DesignVersionsRow, DesignsRow } from "@/lib/backend/db-types";
import { formatDateTime, titleCase } from "@/lib/format";
import { db, exec, write } from "../ops/data";
import { DesignSides, forgetDesignArt } from "../ops/DesignArt";
import { InternalNotes } from "../ops/Notes";
import { Confirm, Labeled, SectionTitle, SkeletonRows } from "../ops/parts";
import { adminInput, Drawer, ErrorNote, Meta, StatusPill } from "../ui";
import { Preflight } from "./Preflight";

type Use = { kind: "Quote" | "Order"; id: string; ref: string; status: string };
type Bundle = { design: Omit<DesignsRow, "sides">; owner: { full_name: string; email: string } | null; versions: Pick<DesignVersionsRow, "id" | "version" | "created_at" | "note">[]; preflight: ArtworkPreflightsRow | null; assets: DesignAssetsRow[]; uses: Use[] };
const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

async function load(id: string, canSales: boolean): Promise<Bundle | null> {
  const b = db();
  const d = await b.from("designs").select("id,ref,owner_id,name,product_slug,garment,colour,size,preview_path,status,version,share_token,template_slug,created_at,updated_at").eq("id", id).maybeSingle();
  if (!d.data) return null;
  const [owner, versions, pre, assets, qi, oi] = await Promise.all([
    b.from("profiles").select("full_name,email").eq("id", d.data.owner_id).maybeSingle(), b.from("design_versions").select("id,version,created_at,note").eq("design_id", id).order("version", { ascending: false }),
    b.from("artwork_preflights").select("*").eq("design_id", id).order("created_at", { ascending: false }).limit(1), b.from("design_assets").select("*").eq("design_id", id).order("created_at"),
    b.from("quote_items").select("quotes(id,ref,status)").eq("design_id", id).returns<{ quotes: { id: string; ref: string; status: string } | null }[]>(),
    canSales ? b.from("order_items").select("orders(id,ref,status)").eq("design_id", id).returns<{ orders: { id: string; ref: string; status: string } | null }[]>() : null,
  ]);
  const seen = new Set<string>();
  const uses: Use[] = [...(qi.data ?? []).flatMap((r) => (r.quotes ? [{ kind: "Quote" as const, ...r.quotes }] : [])), ...(oi?.data ?? []).flatMap((r) => (r.orders ? [{ kind: "Order" as const, ...r.orders }] : []))].filter((u) => !seen.has(u.id) && seen.add(u.id));
  return { design: d.data as Bundle["design"], owner: owner.data ?? null, versions: (versions.data ?? []) as Bundle["versions"], preflight: ((pre.data ?? [])[0] as ArtworkPreflightsRow | undefined) ?? null, assets: (assets.data ?? []) as DesignAssetsRow[], uses };
}

function Decision({ d, onChanged }: { d: Bundle["design"]; onChanged: () => void }) {
  const toast = useToast();
  const [ask, setAsk] = useState<"approve" | "changes" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const finish = (e: string | null, ok: string) => { setBusy(false); if (e) return setErr(e); setAsk(null); setErr(null); forgetDesignArt(d.id); toast(ok, "ok"); onChanged(); };
  const approve = async () => { setBusy(true); finish((await write(db().from("designs").update({ status: "approved" }).eq("id", d.id).select("id"))).error, `${d.ref} approved for production.`); };
  const changes = async () => { if (note.trim().length < 5) return setErr("Tell the customer what needs to change."); setBusy(true); finish((await exec(db().rpc("request_design_changes", { design: d.id, note: note.trim() }))).error, "Changes requested — the customer has been notified."); };
  return (
    <div className="flex flex-wrap items-center gap-2 border border-ink-700 bg-ink-950 p-3">
      <p className="t-label mr-auto text-[0.625rem] text-fog-500">{d.status === "approved" ? "Approved for production" : d.status === "submitted" ? "Awaiting SPP approval" : `Status: ${titleCase(d.status)}`}</p>
      {(d.status === "submitted" || d.status === "approved") && <Button size="sm" variant="outline" onClick={() => { setErr(null); setAsk("changes"); }}>Request changes</Button>}
      {d.status !== "approved" && d.status !== "archived" && <Button size="sm" onClick={() => { setErr(null); setAsk("approve"); }}>Approve artwork</Button>}
      <Confirm open={ask === "approve"} title="Approve this artwork?" confirmLabel="Approve artwork" pending={busy} onClose={() => setAsk(null)} onConfirm={() => void approve()} body={<>Approving <strong className="text-fog-50">{d.ref}</strong> v{d.version} is SPP&apos;s production sign-off: it unlocks “Release to production” on any order using this design. If the customer edits the design afterwards a new version is created — orders keep the version they were quoted with.</>}><ErrorNote message={err} /></Confirm>
      <Confirm open={ask === "changes"} title="Request changes from the customer" confirmLabel="Send request" pending={busy} onClose={() => setAsk(null)} onConfirm={() => void changes()} body="The design returns to the customer as SAVED so they can edit it. They get a notification, and the reason is posted on their quote thread when the design is on a quote.">
        <ErrorNote message={err} />
        <Labeled label="What needs to change? (the customer reads this)">{(id) => <textarea id={id} rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="e.g. The logo is 72 dpi at print size — please upload a vector or a larger PNG." className={`${adminInput} resize-y py-2`} />}</Labeled>
      </Confirm>
    </div>
  );
}

export function DesignDrawer({ id, canReview, canSales, staffName, onClose, onChanged }: { id: string | null; canReview: boolean; canSales: boolean; staffName: (id: string | null) => string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const q = useQuery<Bundle | null>(() => load(id ?? "", canSales), [id, canSales], { enabled: Boolean(id) });
  const [pick, setPick] = useState<{ id: string; version: number } | null>(null);
  const b = q.data, d = b?.design;
  const shown = d && pick?.id === d.id ? pick.version : null;
  const reload = () => { void q.reload(); onChanged(); };
  const download = async (a: DesignAssetsRow) => {
    const { data } = await db().storage.from("private-artwork").createSignedUrl(a.path, 300, { download: a.file_name });
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener"); else toast("That file could not be signed for download.", "danger");
  };
  return (
    <Drawer open={Boolean(id)} onClose={onClose} title={d?.name ?? "Design"} sub={d && <span className="flex flex-wrap items-center gap-2"><span className="t-data">{d.ref}</span><StatusPill status={d.status} /><span>v{d.version}</span></span>}>
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      {q.loading && !b && <SkeletonRows n={6} />}
      {!q.loading && !q.error && !b && <p className="text-sm text-fog-400">This design could not be found, or your role cannot view it.</p>}
      {b && d && (
        <>
          {canReview && <Decision key={`${d.id}-${d.status}`} d={d} onChanged={reload} />}
          <SectionTitle>Artwork{shown && shown !== d.version ? ` · viewing v${shown}` : ""}</SectionTitle>
          <DesignSides key={`${d.id}-${shown ?? d.version}-${d.updated_at}`} designId={d.id} version={shown} link={false} />
          <div className="mt-4"><Meta items={[
            { label: "Product", value: titleCase(d.product_slug) }, { label: "Garment", value: `${titleCase(d.garment)}${d.size ? ` · size ${d.size}` : ""}` },
            { label: "Colour", value: <span className="inline-flex items-center gap-2"><span aria-hidden className="h-4 w-4 border border-ink-500" style={{ background: d.colour }} /><span className="t-data">{d.colour}</span></span> },
            { label: "Owner", value: b.owner ? <>{b.owner.full_name || "Guest"}{b.owner.email ? <> · <a href={`mailto:${b.owner.email}`} className="underline decoration-ink-500 underline-offset-4">{b.owner.email}</a></> : null}</> : "Guest session" },
            { label: "Template", value: d.template_slug ?? "—" }, { label: "Updated", value: formatDateTime(d.updated_at) },
          ]} /></div>

          <div className="mt-8"><Preflight key={`${b.preflight?.id ?? "none"}-${b.preflight?.review_verdict ?? ""}`} designId={d.id} version={d.version} latest={b.preflight} canReview={canReview} staffName={staffName} onSaved={reload} /></div>

          <SectionTitle>Version history</SectionTitle>
          <ol className="flex flex-col">
            {b.versions.map((v) => { const on = (shown ?? d.version) === v.version; return (
              <li key={v.id} className="flex flex-wrap items-center gap-3 border-b border-ink-800 py-2 text-sm last:border-0">
                <span className="t-data w-10 text-fog-50">v{v.version}</span><span className="t-data text-xs text-fog-400">{formatDateTime(v.created_at)}</span>{v.note && <span className="text-xs text-fog-300">{v.note}</span>}
                {v.version === d.version && <span className="t-label text-[0.5625rem] text-fog-500">Latest</span>}
                <button type="button" aria-pressed={on} onClick={() => setPick({ id: d.id, version: v.version })} className={`t-label ml-auto min-h-9 border px-2.5 text-[0.625rem] ${on ? "border-yellow text-yellow" : "border-ink-600 text-fog-300 hover:border-yellow hover:text-yellow"}`}>{on ? "Showing" : "Preview"}</button>
              </li>); })}
            {b.versions.length === 0 && <li className="text-sm text-fog-500">No version history.</li>}
          </ol>

          <SectionTitle>Original uploads <span className="text-fog-500">· staff only, links expire in 5 minutes</span></SectionTitle>
          <ul>
            {b.assets.map((a) => <li key={a.id} className="flex flex-wrap items-center gap-3 border-b border-ink-800 py-2 text-sm last:border-0"><span className="min-w-0 truncate text-fog-50">{a.file_name}</span><span className="t-data text-xs text-fog-500">{a.mime.replace("image/", "").replace("application/", "")} · {kb(a.bytes)}{a.width && a.height ? ` · ${a.width}×${a.height}px` : ""}</span><button type="button" onClick={() => void download(a)} className="t-label ml-auto min-h-9 border border-ink-600 px-2.5 text-[0.625rem] text-fog-300 hover:border-yellow hover:text-yellow">Download</button></li>)}
            {b.assets.length === 0 && <li className="text-sm text-fog-500">This design uses no uploaded files — text, shapes and library graphics only.</li>}
          </ul>

          <SectionTitle>Used on</SectionTitle>
          <ul>
            {b.uses.map((u) => <li key={u.id} className="border-b border-ink-800 last:border-0"><Link href={`/admin/${u.kind === "Quote" ? "quotes" : "orders"}/?id=${u.id}`} className="flex min-h-11 items-center gap-3 py-2 text-sm hover:bg-ink-850"><span className="t-label w-16 text-[0.625rem] text-fog-500">{u.kind}</span><span className="t-data text-fog-50">{u.ref}</span><StatusPill status={u.status} /></Link></li>)}
            {b.uses.length === 0 && <li className="text-sm text-fog-500">Not attached to a quote{canSales ? " or order" : ""} yet.</li>}
          </ul>
          <div className="mt-8"><InternalNotes entity="design" entityId={d.id} /></div>
        </>
      )}
    </Drawer>
  );
}

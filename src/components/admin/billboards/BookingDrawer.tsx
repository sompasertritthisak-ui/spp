"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { backend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import type { BillboardBookingsRow, BillboardsRow, BookingStatus, DesignAssetsRow } from "@/lib/backend/db-types";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatBytes } from "../media/lib";
import { InternalNotes } from "../ops/Notes";
import { useConfirm } from "../resource/Confirm";
import { adminError } from "../resource/errors";
import { NumberField, ToggleField } from "../resource/fields";
import type { Values } from "../resource/types";
import { Drawer, Meta, StatusPill } from "../ui";
import { contactOf, daysBetween, type Clash } from "./shared";

type Update = (id: string, patch: Values, o?: { quiet?: boolean; message?: string }) => Promise<BillboardBookingsRow | null>;

export function BookingDrawer({ booking: k, site, clash, canWrite, update, onConfirmed, onClose }: { booking: BillboardBookingsRow; site: BillboardsRow | null; clash: Clash; canWrite: boolean; update: Update; onConfirmed: () => void; onClose: () => void }) {
  const toast = useToast();
  const c = contactOf(k);
  const [quoted, setQuoted] = useState<number | null>(k.quoted_usd == null ? null : Number(k.quoted_usd));
  const [busy, setBusy] = useState(false);
  const [rpcError, setRpcError] = useState<string | null>(null);
  const [confirm, confirmUi] = useConfirm();
  const asset = useQuery<DesignAssetsRow | null>(() => (k.design_asset_id ? backend()!.from("design_assets").select("*").eq("id", k.design_asset_id).maybeSingle() : Promise.resolve(null)), [k.design_asset_id]);

  const openArtwork = async () => {
    if (!asset.data) return;
    const path = asset.data.path.replace(/^private-artwork\//, "");
    const r = await backend()!.storage.from("private-artwork").createSignedUrl(path, 300);
    if (r.error || !r.data?.signedUrl) return toast("Your role cannot open this artwork yet. An administrator needs to apply database migrations 0012–0013, or a designer can open it from Designs & Artwork.", "danger");
    window.open(r.data.signedUrl, "_blank", "noopener,noreferrer");
  };
  const move = async (to: BookingStatus, ask: { title: string; body: string; confirmLabel: string; danger?: boolean }, message: string) => {
    if (!(await confirm(ask))) return;
    const wasConfirmed = k.status === "confirmed";
    const r = await update(k.id, { status: to }, { message });
    // A status change does not free the dates: the "booked" block must go too.
    if (r && wasConfirmed && to === "cancelled") {
      const d = await backend()!.from("billboard_availability").delete().eq("booking_id", k.id);
      toast(d.error ? `Cancelled, but the booked dates could not be released: ${adminError(d.error)}` : "The booked dates were released on the availability calendar.", d.error ? "danger" : "ok");
      onConfirmed();
    }
  };
  const confirmBooking = async () => {
    const hard = clash.blocks.length;
    if (!(await confirm({ title: `Confirm ${k.ref}?`, confirmLabel: "Confirm booking", body: `This blocks ${formatDate(k.starts_on)} → ${formatDate(k.ends_on)} on ${site?.code ?? "the site"}, marks the booking confirmed and notifies the customer by email and in their account. Only confirm once price and artwork terms are agreed.${hard ? " NOTE: these dates clash with an existing commitment — the database will refuse." : ""}` }))) return;
    setBusy(true);
    setRpcError(null);
    const r = await backend()!.rpc("confirm_booking", { booking: k.id });
    setBusy(false);
    if (r.error) return setRpcError(r.error.code === "22023" ? r.error.message : adminError(r.error));
    toast(`${k.ref} confirmed. The dates are now blocked.`, "ok");
    onConfirmed();
  };
  const open = k.status === "requested" || k.status === "in_review";

  return (
    <Drawer open onClose={onClose} title={k.ref} sub={<span className="flex flex-wrap items-center gap-2"><StatusPill status={k.status} /><span>received {formatDateTime(k.created_at)}</span></span>}
      footer={canWrite ? (
        <>
          {open && <Button variant="danger" size="sm" className="mr-auto" onClick={() => void move("declined", { title: "Decline this enquiry?", body: "The enquiry is closed as declined. Tell the customer why — no automatic email is sent.", confirmLabel: "Decline", danger: true }, "Enquiry declined.")}>Decline</Button>}
          {(open || k.status === "confirmed") && <Button variant="ghost" size="sm" onClick={() => void move("cancelled", { title: "Cancel this booking?", body: k.status === "confirmed" ? "The booking is cancelled AND its booked dates are released on the availability calendar." : "The enquiry is closed as cancelled.", confirmLabel: "Cancel booking", danger: true }, "Booking cancelled.")}>Cancel</Button>}
          {k.status === "requested" && <Button variant="outline" size="sm" onClick={() => void update(k.id, { status: "in_review" }, { message: "Marked as in review." })}>Start review</Button>}
          {open && <Button size="sm" loading={busy} onClick={() => void confirmBooking()}>Confirm booking</Button>}
          {k.status === "confirmed" && <Button size="sm" onClick={() => void move("completed", { title: "Mark this campaign completed?", body: "Use this once the campaign period has ended and the artwork has come down.", confirmLabel: "Mark completed" }, "Campaign completed.")}>Complete</Button>}
        </>
      ) : <span className="text-sm text-fog-500">Read-only for your role.</span>}>
      <div aria-live="assertive">{rpcError && <p role="alert" className="mb-4 border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-fog-50"><strong className="t-label mr-2">Not confirmed</strong>{rpcError}</p>}</div>
      {(clash.blocks.length > 0 || clash.competing.length > 0) && (
        <div role="status" className="mb-5 border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-fog-50">
          {clash.blocks.length > 0 && <p><strong className="t-label mr-2 text-danger">Date clash</strong>{clash.blocks.map((b) => `${b.kind} ${formatDate(b.starts_on)} → ${formatDate(b.ends_on)}`).join("; ")}. It cannot be confirmed until the dates change or the block is removed.</p>}
          {clash.competing.length > 0 && <p className={clash.blocks.length ? "mt-2" : ""}><strong className="t-label mr-2 text-warn">Competing enquiry</strong>{clash.competing.map((o) => o.ref).join(", ")} ask{clash.competing.length === 1 ? "s" : ""} for overlapping dates on this site. Whichever is confirmed first takes them.</p>}
        </div>
      )}
      <Meta items={[
        { label: "Site", value: site ? <Link href={`/admin/billboards/?id=${site.id}`} className="text-yellow hover:text-fog-50">{site.code} · {site.name}</Link> : "—" },
        { label: "Period", value: <span className="t-data">{formatDate(k.starts_on)} → {formatDate(k.ends_on)} · {daysBetween(k.starts_on, k.ends_on)} days</span> },
        { label: "Contact", value: <>{c.name ?? "—"}{c.company && ` · ${c.company}`}</> },
        { label: "Email", value: c.email ? <a href={`mailto:${c.email}`} className="text-sky hover:text-fog-50">{c.email}</a> : "—" },
        { label: "Phone", value: c.phone ? <a href={`tel:${c.phone}`} className="text-sky hover:text-fog-50">{c.phone}</a> : "—" },
        { label: "Lead", value: k.lead_id ? <Link href={`/admin/leads/?id=${k.lead_id}`} className="text-yellow hover:text-fog-50">Open the lead</Link> : "No lead linked" },
        { label: "Customer notes", value: k.notes ? <span className="whitespace-pre-wrap">{k.notes}</span> : "—" },
      ]} />

      <h3 className="t-label mb-2 mt-6 text-fog-300">Artwork</h3>
      {!k.design_asset_id ? <p className="text-sm text-fog-500">No artwork was uploaded with this enquiry.</p> : asset.loading ? <div className="skeleton h-12" /> : asset.data ? (
        <div className="flex flex-wrap items-center gap-3 border border-ink-700 bg-ink-950 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm text-fog-50">{asset.data.file_name}</p><p className="t-data text-xs text-fog-500">{asset.data.mime} · {formatBytes(asset.data.bytes)}{asset.data.width && asset.data.height ? ` · ${asset.data.width}×${asset.data.height}px` : ""}</p></div><Button variant="outline" size="sm" onClick={() => void openArtwork()}>Open artwork</Button></div>
      ) : <p className="text-sm text-fog-400">Artwork is attached, but your role cannot read it yet (needs database migration 0012). Designers and administrators can open it from Designs &amp; Artwork.</p>}
      <p className="mt-2 text-xs text-fog-500">The link is private and expires after five minutes.</p>

      <h3 className="t-label mb-3 mt-6 text-fog-300">Scope & price</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <ToggleField label="Design" disabled={!canWrite} value={k.needs_design} onChange={(v) => void update(k.id, { needs_design: v }, { quiet: true })} onLabel="Needs SPP to design the artwork" offLabel="Customer supplies artwork" />
        <ToggleField label="Print & install" disabled={!canWrite} value={k.needs_print_install} onChange={(v) => void update(k.id, { needs_print_install: v }, { quiet: true })} onLabel="SPP prints and installs" offLabel="Space only" />
        <div className="flex items-end gap-2 sm:col-span-2"><NumberField className="flex-1" label="Quoted total" suffix="USD" min={0} step={10} disabled={!canWrite} value={quoted} onChange={setQuoted} hint={site?.price_from_usd_month != null ? `Site “from” price: $${Number(site.price_from_usd_month)} / month` : undefined} />{canWrite && <Button variant="outline" size="sm" className="mb-[1.625rem] min-h-11" disabled={quoted === (k.quoted_usd == null ? null : Number(k.quoted_usd)) || (quoted !== null && quoted < 0)} onClick={() => void update(k.id, { quoted_usd: quoted }, { message: "Quoted price saved." })}>Save price</Button>}</div>
      </div>

      <div className="mt-6"><InternalNotes entity="booking" entityId={k.id} /></div>
      {confirmUi}
    </Drawer>
  );
}

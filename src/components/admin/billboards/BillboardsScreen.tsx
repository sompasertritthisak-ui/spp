"use client";
import { clsx } from "clsx";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { canDo, useAuth } from "@/lib/backend/auth";
import { backend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import type { BillboardAvailabilityRow, BillboardsRow, BillboardStatus, BookingStatus } from "@/lib/backend/db-types";
import { formatDate, formatUsd, relativeTime, titleCase } from "@/lib/format";
import { PublishSite } from "../cms/PublishSite";
import { adminError } from "../resource/errors";
import { inputCls } from "../resource/fields";
import { useResource } from "../resource/useResource";
import { useParam, useSelection } from "../resource/useSelection";
import { DataTable, ErrorNote, PageHeader, Panel, Stat, StatusPill, Tabs } from "../ui";
import { BookingDrawer } from "./BookingDrawer";
import { clashesFor, contactOf, OPEN_BOOKING, SITE_STATUSES } from "./shared";
import { SiteEditor } from "./SiteEditor";

const BOOKING_TABS: BookingStatus[] = ["requested", "in_review", "confirmed", "declined", "cancelled", "completed"];

export function BillboardsScreen() {
  const { profile } = useAuth();
  const toast = useToast();
  const canWrite = canDo(profile?.role, "billboards");
  const sel = useSelection();
  const bookingSel = useSelection("booking", "_");
  const [tabParam, setTab] = useParam<"sites" | "bookings">("tab", "sites", ["id", "new", "booking"]);
  const tab = bookingSel.id ? "bookings" : tabParam;
  const sites = useResource("billboards", { order: [{ column: "code" }], singular: "Site" });
  const bookings = useResource("billboard_bookings", { order: [{ column: "created_at", ascending: false }], singular: "Booking" });
  const blocks = useQuery<BillboardAvailabilityRow[]>(() => backend()!.from("billboard_availability").select("*"), [], { enabled: canWrite });
  const [q, setQ] = useState("");
  const [province, setProvince] = useState("all");
  const [status, setStatus] = useState("all");
  const [bTab, setBTab] = useState<BookingStatus>("requested");

  const siteRows = useMemo(() => sites.rows ?? [], [sites.rows]);
  const bookingRows = useMemo(() => bookings.rows ?? [], [bookings.rows]);
  const siteById = useMemo(() => new Map(siteRows.map((s) => [s.id, s])), [siteRows]);
  const clashMap = useMemo(() => new Map(bookingRows.filter((k) => OPEN_BOOKING.includes(k.status)).map((k) => [k.id, clashesFor(k, blocks.data ?? [], bookingRows)])), [bookingRows, blocks.data]);
  const provinces = useMemo(() => [...new Set(siteRows.map((s) => s.province))].sort(), [siteRows]);
  const shownSites = useMemo(() => { const t = q.trim().toLowerCase(); return siteRows.filter((s) => (province === "all" || s.province === province) && (status === "all" || s.status === status) && (!t || `${s.code} ${s.name} ${s.district} ${s.address}`.toLowerCase().includes(t))); }, [siteRows, q, province, status]);
  const count = (s: BookingStatus) => bookingRows.filter((k) => k.status === s).length;
  const clashing = [...clashMap.values()].filter((c) => c.blocks.length || c.competing.length).length;

  if (!canWrite) return <><PageHeader title="Billboards" /><EmptyState title="Not part of your role." body="Billboard sites and booking enquiries are handled by sales, marketing and administrators." /></>;

  const setSiteStatus = (s: BillboardsRow, to: BillboardStatus) => void sites.update(s.id, { status: to }, { message: `${s.code} is now ${to}. The public map changes at the next publish.` });
  const duplicate = async (src: BillboardsRow) => {
    const taken = new Set(siteRows.map((s) => s.code));
    let code = `${src.code}-COPY`;
    for (let n = 2; taken.has(code); n++) code = `${src.code}-COPY${n}`;
    const { id: _i, created_at: _c, updated_at: _u, ...rest } = src;
    void _i; void _c; void _u;
    const made = await sites.create({ ...rest, code, name: `${src.name} (copy)`, publish: "draft", verified: false }, { quiet: true });
    if (!made) return;
    const media = await backend()!.from("billboard_media").select("media_id,sort").eq("billboard_id", src.id);
    const ins = media.data?.length ? await backend()!.from("billboard_media").insert(media.data.map((m) => ({ ...m, billboard_id: made.id }))) : null;
    const bad = media.error ?? ins?.error;
    toast(bad ? `Copied, but the images were not: ${adminError(bad)}` : "Site duplicated as an unverified draft — give it its own code.", bad ? "danger" : "ok");
    sel.open(made.id);
  };

  const site = sel.id ? siteById.get(sel.id) ?? null : null;
  const editing = tab === "sites" && (sel.isNew || site);
  const booking = bookingSel.id ? bookingRows.find((k) => k.id === bookingSel.id) ?? null : null;
  const select = clsx(inputCls, "w-auto pr-8");

  return (
    <div>
      <PageHeader title="Billboards" sub="The outdoor network: sites, availability and booking enquiries." actions={<><PublishSite compact />{tab === "sites" && !editing && <Button size="sm" className="min-h-11" onClick={sel.openNew}>Add billboard</Button>}</>} />
      {!editing && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="New enquiries" value={bookings.rows ? count("requested") : "—"} tone={count("requested") ? "yellow" : "neutral"} />
          <Stat label="In review" value={bookings.rows ? count("in_review") : "—"} />
          <Stat label="Possible clashes" value={bookings.rows && blocks.data ? clashing : "—"} tone={clashing ? "danger" : "ok"} hint="Open enquiries with overlapping dates" />
          <Stat label="Unverified sites" value={sites.rows ? siteRows.filter((s) => !s.verified && s.publish === "published").length : "—"} hint="Published, not yet checked on site" />
          <Stat label="In maintenance" value={sites.rows ? siteRows.filter((s) => s.status === "maintenance").length : "—"} />
        </div>
      )}
      {!editing && <Tabs label="Billboards" value={tab} onChange={setTab} tabs={[{ value: "sites", label: "Sites", count: sites.rows ? siteRows.length : null }, { value: "bookings", label: "Bookings", count: bookings.rows ? count("requested") + count("in_review") : null }]} />}

      {tab === "sites" && (editing ? (
        <SiteEditor site={site} canWrite={canWrite} saving={sites.saving} bookings={bookingRows} onBack={sel.close} onCreated={sel.open} actions={{ create: sites.create, update: sites.update, remove: sites.remove, duplicate }} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search sites" placeholder="Search code, name or district…" className={clsx(inputCls, "min-w-0 flex-1 basis-full sm:basis-64")} />
            <select aria-label="Province" value={province} onChange={(e) => setProvince(e.target.value)} className={select}><option value="all">All provinces</option>{provinces.map((p) => <option key={p} value={p}>{p}</option>)}</select>
            <select aria-label="Rental status" value={status} onChange={(e) => setStatus(e.target.value)} className={select}><option value="all">All statuses</option>{SITE_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select>
          </div>
          <ErrorNote message={sites.error} onRetry={() => void sites.reload()} />
          {sel.id && !site && sites.rows && <ErrorNote message="That site no longer exists, or your role cannot see it." />}
          <Panel flush>
            <DataTable caption="Billboard sites" rows={sites.error ? [] : shownSites} loading={sites.loading} rowKey={(s) => s.id} onRowClick={(s) => !s.id.startsWith("tmp-") && sel.open(s.id)} empty={siteRows.length ? "Nothing matches those filters." : "No sites yet. Add the first billboard."}
              columns={[
                { key: "code", header: "Site", cell: (s) => <span className="block max-w-xs"><span className="t-data block text-fog-50">{s.code}</span><span className="block truncate text-xs text-fog-400">{s.name}</span></span> },
                { key: "where", header: "Location", hideBelow: "md", cell: (s) => <span className="text-fog-300">{s.province}{s.district && ` · ${s.district}`}</span> },
                { key: "size", header: "Size", hideBelow: "lg", cell: (s) => <span className="t-data text-fog-300">{Number(s.width_m)}×{Number(s.height_m)} m · {s.faces === 2 ? "2 faces" : "1 face"}{s.lit ? " · lit" : ""}</span> },
                { key: "price", header: "From / mo", hideBelow: "sm", cell: (s) => <span className="t-data text-fog-300">{s.price_from_usd_month == null ? "—" : formatUsd(Number(s.price_from_usd_month))}</span> },
                { key: "flags", header: "Listing", cell: (s) => <span className="flex flex-wrap items-center gap-1.5"><StatusPill status={s.publish} />{!s.verified && <span className="t-label text-[0.625rem] text-warn">Unverified</span>}</span> },
                { key: "status", header: "Rental status", cell: (s) => <select aria-label={`Rental status of ${s.code}`} value={s.status} disabled={s.id.startsWith("tmp-")} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setSiteStatus(s, e.target.value as BillboardStatus)} className={clsx(inputCls, "t-label min-h-10 w-auto pr-7 text-[0.6875rem]", s.status === "available" ? "text-ok" : s.status === "reserved" || s.status === "maintenance" ? "text-warn" : "text-danger")}>{SITE_STATUSES.map((x) => <option key={x} value={x}>{x}</option>)}</select> },
              ]} />
          </Panel>
        </>
      ))}

      {tab === "bookings" && (
        <>
          <Tabs label="Bookings by status" value={bTab} onChange={setBTab} tabs={BOOKING_TABS.map((s) => ({ value: s, label: s.replace("_", " "), count: bookings.rows ? count(s) : null }))} />
          <ErrorNote message={bookings.error ?? blocks.error} onRetry={() => { void bookings.reload(); void blocks.reload(); }} />
          {bookingSel.id && !booking && bookings.rows && <ErrorNote message="That booking no longer exists, or your role cannot see it." />}
          <Panel flush>
            <DataTable caption="Booking enquiries" rows={bookings.error ? [] : bookingRows.filter((k) => k.status === bTab)} loading={bookings.loading} rowKey={(k) => k.id} onRowClick={(k) => bookingSel.open(k.id)} empty={`No ${bTab.replace("_", " ")} bookings.`}
              columns={[
                { key: "ref", header: "Enquiry", cell: (k) => <span><span className="t-data block text-fog-50">{k.ref}</span><span className="block text-xs text-fog-500">{relativeTime(k.created_at)}</span></span> },
                { key: "site", header: "Site", cell: (k) => { const s = siteById.get(k.billboard_id); return <span className="block max-w-[14rem] truncate text-fog-300">{s ? `${s.code} · ${s.name}` : "—"}</span>; } },
                { key: "dates", header: "Period", hideBelow: "sm", cell: (k) => <span className="t-data whitespace-nowrap text-fog-300">{formatDate(k.starts_on)} → {formatDate(k.ends_on)}</span> },
                { key: "who", header: "Contact", hideBelow: "md", cell: (k) => <span className="block max-w-[12rem] truncate text-fog-300">{contactOf(k).name}{contactOf(k).company && ` · ${contactOf(k).company}`}</span> },
                { key: "clash", header: "Dates", cell: (k) => { const c = clashMap.get(k.id); return c?.blocks.length ? <span className="t-label text-danger">Clash</span> : c?.competing.length ? <span className="t-label text-warn">Competing enquiry</span> : OPEN_BOOKING.includes(k.status) ? <span className="t-label text-ok">Free</span> : <span className="text-fog-500">—</span>; } },
              ]} />
          </Panel>
          {booking && <BookingDrawer key={booking.id} booking={booking} site={siteById.get(booking.billboard_id) ?? null} clash={clashMap.get(booking.id) ?? { blocks: [], competing: [] }} canWrite={canWrite} update={bookings.update} onClose={bookingSel.close} onConfirmed={() => { void bookings.reload(); void blocks.reload(); void sites.reload(); }} />}
        </>
      )}
    </div>
  );
}

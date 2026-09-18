"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { backend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import type { BillboardBookingsRow, BillboardsRow } from "@/lib/backend/db-types";
import { formatDate, formatUsd, titleCase } from "@/lib/format";
import { MediaListField } from "../media/MediaField";
import { DISCARD, useConfirm } from "../resource/Confirm";
import { adminError } from "../resource/errors";
import { AreaField, DateField, FormSection, NumberField, SelectField, TextField, ToggleField } from "../resource/fields";
import { PUBLISH_OPTIONS } from "../resource/status";
import type { Values } from "../resource/types";
import { ErrorNote, Panel, StatusPill, Tabs } from "../ui";
import { AvailabilityPanel } from "./AvailabilityPanel";
import { contactOf, SITE_STATUSES, siteRow, siteSchema, toSiteForm, type SiteForm } from "./shared";

export type SiteActions = { create: (v: Values, o?: { quiet?: boolean }) => Promise<BillboardsRow | null>; update: (id: string, v: Values, o?: { quiet?: boolean; message?: string }) => Promise<BillboardsRow | null>; remove: (id: string) => Promise<boolean>; duplicate: (b: BillboardsRow) => Promise<void> };
type Shared = { canWrite: boolean; saving: boolean; actions: SiteActions; bookings: BillboardBookingsRow[]; onBack: () => void; onCreated: (id: string) => void };
type Tab = "details" | "images" | "availability" | "history";

export function SiteEditor({ site, ...rest }: Shared & { site: BillboardsRow | null }) {
  const images = useQuery<string[]>(async () => { if (!site) return []; const r = await backend()!.from("billboard_media").select("media_id,sort").eq("billboard_id", site.id).order("sort"); if (r.error) throw new Error(adminError(r.error)); return r.data.map((x) => x.media_id as string); }, [site?.id]);
  if (images.error) return <ErrorNote message={images.error} onRetry={() => void images.reload()} />;
  if (!images.data) return <div className="skeleton h-96" />;
  return <SiteForm key={site?.id ?? "new"} site={site} stored={images.data} reloadImages={() => void images.reload()} {...rest} />;
}

function SiteForm({ site, stored, reloadImages, canWrite, saving, actions, bookings, onBack, onCreated }: Shared & { site: BillboardsRow | null; stored: string[]; reloadImages: () => void }) {
  const toast = useToast();
  const initial = useMemo(() => toSiteForm(site, stored), [site, stored]);
  const [f, setF] = useState<SiteForm>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>("details");
  const [busy, setBusy] = useState(false);
  const [confirm, confirmUi] = useConfirm();
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const ro = !canWrite;
  const set = <K extends keyof SiteForm>(k: K, v: SiteForm[K]) => { setF((p) => ({ ...p, [k]: v })); if (errors[k]) setErrors((e) => { const n = { ...e }; delete n[k]; return n; }); };
  const back = async () => { if (!dirty || (await confirm(DISCARD))) onBack(); };
  const history = bookings.filter((k) => k.billboard_id === site?.id);

  const save = async () => {
    const r = siteSchema.safeParse(f);
    const e: Record<string, string> = {};
    if (!r.success) for (const i of r.error.issues) e[String(i.path[0])] ??= i.message;
    setErrors(e);
    if (Object.keys(e).length) { setTab("details"); toast("Some fields need attention before saving.", "danger"); return; }
    setBusy(true);
    const saved = site ? await actions.update(site.id, siteRow(f), { quiet: true }) : await actions.create(siteRow(f), { quiet: true });
    if (!saved) return setBusy(false);
    const b = backend()!;
    const removed = stored.filter((x) => !f.images.includes(x));
    const d = removed.length ? await b.from("billboard_media").delete().eq("billboard_id", saved.id).in("media_id", removed) : { error: null };
    const u = !d.error && f.images.length ? await b.from("billboard_media").upsert(f.images.map((id, i) => ({ billboard_id: saved.id, media_id: id, sort: i })), { onConflict: "billboard_id,media_id" }) : d;
    setBusy(false);
    if (u.error) { toast(`The site was saved, but its images were not: ${adminError(u.error)}`, "danger"); if (!site) onCreated(saved.id); return; }
    toast(site ? "Site saved. It reaches the public map at the next publish." : "Site created as a draft.", "ok");
    if (site) reloadImages(); else onCreated(saved.id);
  };
  const archive = async () => {
    if (!site) return;
    const to = site.publish === "archived" ? "draft" : "archived";
    if (to === "archived" && !(await confirm({ title: "Archive this site?", body: "It leaves the public map at the next publish. Bookings and history are kept.", confirmLabel: "Archive" }))) return;
    const r = await actions.update(site.id, { publish: to }, { message: to === "archived" ? "Site archived." : "Restored as a draft." });
    if (r) setF((p) => ({ ...p, publish: r.publish }));
  };
  const del = async () => {
    if (!site || !(await confirm({ title: "Delete this site?", danger: true, confirmLabel: "Delete permanently", body: <>“{site.code} · {site.name}” with its images and availability blocks will be permanently deleted. A site that has booking enquiries cannot be deleted — archive it instead.</> }))) return;
    if (await actions.remove(site.id)) onBack();
  };
  const osm = f.lat !== null && f.lng !== null && !errors.lat && !errors.lng ? `https://www.openstreetmap.org/?mlat=${f.lat}&mlon=${f.lng}#map=16/${f.lat}/${f.lng}` : null;

  return (
    <div>
      <div className="sticky top-16 z-10 -mx-4 mb-5 flex flex-wrap items-center gap-2 border-b border-ink-700 bg-ink-950/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
        <Button variant="ghost" size="sm" onClick={() => void back()}>← Sites</Button>
        <div className="mr-auto min-w-0"><h2 className="t-heading truncate text-fog-50">{site ? `${site.code} · ${site.name}` : "New billboard site"}</h2><p className="flex flex-wrap items-center gap-2 text-xs">{site && <><StatusPill status={site.status} /><StatusPill status={site.publish} /></>}{dirty && <span className="t-label text-warn">Unsaved changes</span>}{ro && <span className="t-label text-fog-500">Read-only for your role</span>}</p></div>
        {canWrite && <>{site && <Button variant="danger" size="sm" onClick={() => void del()}>Delete</Button>}{site && <Button variant="ghost" size="sm" onClick={() => void archive()}>{site.publish === "archived" ? "Restore" : "Archive"}</Button>}{site && <Button variant="ghost" size="sm" disabled={dirty} title={dirty ? "Save first, then duplicate" : undefined} onClick={() => void actions.duplicate(site)}>Duplicate</Button>}<Button size="sm" loading={busy || saving} disabled={!dirty} onClick={() => void save()}>{site ? "Save changes" : "Create site"}</Button></>}
      </div>
      <Tabs label="Site sections" value={tab} onChange={setTab} tabs={[{ value: "details", label: "Details", count: Object.keys(errors).length || null }, { value: "images", label: "Images", count: f.images.length }, { value: "availability", label: "Availability" }, { value: "history", label: "Campaign history", count: site ? history.length : null }]} />
      <Panel>
        {tab === "details" && (
          <form noValidate className="flex flex-col gap-6" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <FormSection title="Identity & location">
              <TextField label="Code" required disabled={ro} value={f.code} onChange={(v) => set("code", v)} error={errors.code} placeholder="SPP-BB-014" hint="Unique. Customers quote it when they enquire." />
              <TextField label="Name" required disabled={ro} value={f.name} onChange={(v) => set("name", v)} error={errors.name} />
              <TextField label="Province" required disabled={ro} value={f.province} onChange={(v) => set("province", v)} error={errors.province} />
              <TextField label="District" disabled={ro} value={f.district} onChange={(v) => set("district", v)} />
              <TextField className="sm:col-span-2" label="Address / landmark" disabled={ro} value={f.address} onChange={(v) => set("address", v)} />
              <NumberField label="Latitude" required disabled={ro} value={f.lat} onChange={(v) => set("lat", v)} error={errors.lat} step={0.000001} hint="13 – 23" />
              <NumberField label="Longitude" required disabled={ro} value={f.lng} onChange={(v) => set("lng", v)} error={errors.lng} step={0.000001} hint="99 – 108.5" />
              {osm && <p className="text-sm sm:col-span-2"><a href={osm} target="_blank" rel="noopener noreferrer" className="t-label text-sky hover:text-fog-50">Check this point on OpenStreetMap ↗</a></p>}
            </FormSection>
            <FormSection title="The structure">
              <NumberField label="Width" required suffix="m" min={0} step={0.1} disabled={ro} value={f.width_m} onChange={(v) => set("width_m", v)} error={errors.width_m} />
              <NumberField label="Height" required suffix="m" min={0} step={0.1} disabled={ro} value={f.height_m} onChange={(v) => set("height_m", v)} error={errors.height_m} />
              <SelectField label="Orientation" disabled={ro} value={f.orientation} onChange={(v) => set("orientation", v)} options={[{ value: "landscape", label: "Landscape" }, { value: "portrait", label: "Portrait" }]} />
              <SelectField label="Faces" disabled={ro} value={String(f.faces) as "1" | "2"} onChange={(v) => set("faces", v === "2" ? 2 : 1)} options={[{ value: "1", label: "Single-sided" }, { value: "2", label: "Double-sided" }]} />
              <TextField label="Facing" disabled={ro} value={f.facing} onChange={(v) => set("facing", v)} placeholder="Towards inbound traffic from the airport" />
              <ToggleField label="Illumination" disabled={ro} value={f.lit} onChange={(v) => set("lit", v)} onLabel="Lit at night" offLabel="Unlit" />
              <TextField className="sm:col-span-2" label="Visibility" disabled={ro} value={f.visibility} onChange={(v) => set("visibility", v)} placeholder="Clear sightline for 300 m on a straight approach" />
              <TextField className="sm:col-span-2" label="Traffic" disabled={ro} value={f.traffic} onChange={(v) => set("traffic", v)} hint="Leave empty unless you have a measured or officially published figure, and say where it comes from. Never estimate." />
              <AreaField className="sm:col-span-2" label="Installation notes" rows={2} disabled={ro} value={f.installation} onChange={(v) => set("installation", v)} />
              <AreaField className="sm:col-span-2" label="Description" rows={4} disabled={ro} value={f.description} onChange={(v) => set("description", v)} />
            </FormSection>
            <FormSection title="Commercial">
              <SelectField label="Rental status" disabled={ro} value={f.status} onChange={(v) => set("status", v)} options={SITE_STATUSES.map((s) => ({ value: s, label: titleCase(s) }))} hint="“Unavailable” stops online requests for this site." />
              <DateField label="Available from" disabled={ro} value={f.available_from} onChange={(v) => set("available_from", v)} />
              <SelectField label="Pricing mode" disabled={ro} value={f.pricing_mode} onChange={(v) => set("pricing_mode", v)} options={[{ value: "fixed", label: "Fixed — the monthly price is the price" }, { value: "estimated", label: "Estimated — “from” price, confirmed by quote" }, { value: "quote", label: "Quote required — no figure shown" }]} />
              <NumberField label="Price from" suffix="USD / mo" min={0} step={10} disabled={ro} value={f.price_from_usd_month} onChange={(v) => set("price_from_usd_month", v)} error={errors.price_from_usd_month} hint="Leave empty to show no figure." />
              <NumberField label="Minimum booking" required suffix="months" min={1} step={1} disabled={ro} value={f.min_months} onChange={(v) => set("min_months", v)} error={errors.min_months} />
            </FormSection>
            <FormSection title="Verification & publishing" note="Saving updates the database at once; the public map changes after the next “Publish site”. This table has no scheduled publishing.">
              <ToggleField label="Verified on site" disabled={ro} value={f.verified} onChange={(v) => set("verified", v)} onLabel="Verified by SPP on location" offLabel="Unverified — shown as “pending on-site confirmation”" />
              <SelectField label="Publish status" disabled={ro} value={f.publish === "scheduled" ? "draft" : f.publish} onChange={(v) => set("publish", v)} options={PUBLISH_OPTIONS} />
            </FormSection>
            <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>Save</button>
          </form>
        )}
        {tab === "images" && <MediaListField label="Site photographs" disabled={ro} category="billboards" value={f.images} onChange={(v) => set("images", v)} hint="Real photographs of this structure only. The first image is the cover. Remember to press Save." />}
        {tab === "availability" && (site ? <AvailabilityPanel billboardId={site.id} canWrite={canWrite} /> : <p className="text-sm text-fog-400">Create the site first — availability is attached to a saved site.</p>)}
        {tab === "history" && (!site || history.length === 0 ? <p className="text-sm text-fog-500">No booking enquiries for this site yet.</p> : (
          <ul className="divide-y divide-ink-800">{history.map((k) => <li key={k.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm"><Link href={`/admin/billboards/?tab=bookings&booking=${k.id}`} className="t-data text-yellow hover:text-fog-50">{k.ref}</Link><span className="t-data text-fog-200">{formatDate(k.starts_on)} → {formatDate(k.ends_on)}</span><span className="min-w-0 flex-1 truncate text-fog-400">{contactOf(k).name}{contactOf(k).company && ` · ${contactOf(k).company}`}</span><span className="t-data text-fog-400">{k.quoted_usd == null ? "not quoted" : formatUsd(Number(k.quoted_usd))}</span><StatusPill status={k.status} /></li>)}</ul>
        ))}
      </Panel>
      {confirmUi}
    </div>
  );
}

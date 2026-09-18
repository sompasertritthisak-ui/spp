"use client";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { backend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import type { CampaignQrCodesRow, CampaignsRow, PublishStatus } from "@/lib/backend/db-types";
import { MediaField } from "../media/MediaField";
import { DISCARD, useConfirm } from "../resource/Confirm";
import { AreaField, DateField, FormSection, SelectField, TextField } from "../resource/fields";
import { MultiPick, SlugField, type PickOption } from "../resource/pickers";
import { PUBLISH_OPTIONS, SLUG_RE, slugify } from "../resource/status";
import type { Values } from "../resource/types";
import { ErrorNote, Panel, StatusPill, Tabs } from "../ui";
import { AnalyticsPanel, type Scan } from "./AnalyticsPanel";
import { campaignUrl } from "./qr";
import { QrPanel, type ScanStats } from "./QrPanel";

export type CampaignActions = { create: (v: Values) => Promise<CampaignsRow | null>; update: (id: string, v: Values, o?: { quiet?: boolean; message?: string }) => Promise<CampaignsRow | null>; remove: (id: string) => Promise<boolean>; duplicate: (c: CampaignsRow) => Promise<void> };
type Form = { name: string; slug: string; summary: string; body: string; offer: string; cta_label: string; cta_href: string; product_slugs: string[]; starts_on: string | null; ends_on: string | null; hero_media_id: string | null; status: PublishStatus };
type Tab = "details" | "qr" | "analytics";
type CodeLite = Pick<CampaignQrCodesRow, "id" | "label" | "medium" | "code">;

const schema = z.object({
  name: z.string().trim().min(2, "Give the campaign a name.").max(160),
  slug: z.string().regex(SLUG_RE, "Lowercase letters, numbers and single hyphens only."),
  cta_label: z.string().trim().min(2, "Give the button a label.").max(40),
  cta_href: z.string().trim().regex(/^(\/[^\s]*|https:\/\/\S+)$/, "Use a site path starting with / or a full https:// address."),
  summary: z.string().max(400), offer: z.string().max(200), body: z.string().max(8000),
});
const startOfToday = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };

export function CampaignWorkspace({ campaign, canWrite, saving, actions, products, onBack, onCreated }: { campaign: CampaignsRow | null; canWrite: boolean; saving: boolean; actions: CampaignActions; products: PickOption[]; onBack: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const initial = useMemo<Form>(() => ({ name: campaign?.name ?? "", slug: campaign?.slug ?? "", summary: campaign?.summary ?? "", body: campaign?.body ?? "", offer: campaign?.offer ?? "", cta_label: campaign?.cta_label ?? "Request a quote", cta_href: campaign?.cta_href ?? "/request-quote/", product_slugs: campaign?.product_slugs ?? [], starts_on: campaign?.starts_on ?? null, ends_on: campaign?.ends_on ?? null, hero_media_id: campaign?.hero_media_id ?? null, status: campaign?.status ?? "draft" }), [campaign]);
  const [f, setF] = useState<Form>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = useState(campaign !== null);
  const [tab, setTab] = useState<Tab>("details");
  const [today] = useState(startOfToday);
  const [confirm, confirmUi] = useConfirm();
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const ro = !canWrite;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF((p) => ({ ...p, [k]: v })); if (errors[k]) setErrors((e) => { const n = { ...e }; delete n[k]; return n; }); };

  // Scan data for both the QR cards and the analytics tab: per-code totals + the last 90 days in detail.
  const data = useQuery<{ codes: CodeLite[]; stats: ScanStats; scans: Scan[] }>(async () => {
    const b = backend()!;
    const blank = { codes: [] as CodeLite[], stats: new Map() as ScanStats, scans: [] as Scan[] };
    if (!campaign) return blank;
    const codes = await b.from("campaign_qr_codes").select("id,label,medium,code").eq("campaign_id", campaign.id);
    if (codes.error) return { data: null, error: codes.error };
    const list = codes.data as CodeLite[];
    if (!list.length) return blank;
    const since = new Date(today.getTime() - 90 * 86400000).toISOString();
    const [recent, ...perCode] = await Promise.all([
      b.from("qr_scans").select("qr_id,at,session_id,ua_family").in("qr_id", list.map((c) => c.id)).gte("at", since).order("at", { ascending: false }).limit(10000),
      ...list.map((c) => b.from("qr_scans").select("at", { count: "exact" }).eq("qr_id", c.id).order("at", { ascending: false }).limit(1)),
    ]);
    if (recent.error) return { data: null, error: recent.error };
    const stats: ScanStats = new Map(list.map((c, i) => [c.id, { count: perCode[i]?.count ?? 0, last: (perCode[i]?.data?.[0] as { at: string } | undefined)?.at ?? null }]));
    return { codes: list, stats, scans: recent.data as Scan[] };
  }, [campaign?.id]);

  const back = async () => { if (!dirty || (await confirm(DISCARD))) onBack(); };
  const save = async () => {
    const r = schema.safeParse(f);
    const e: Record<string, string> = {};
    if (!r.success) for (const i of r.error.issues) e[String(i.path[0])] ??= i.message;
    if (f.starts_on && f.ends_on && f.ends_on < f.starts_on) e.ends_on = "The end date cannot be before the start date.";
    setErrors(e);
    if (Object.keys(e).length) { setTab("details"); return; }
    const payload = { ...f, name: f.name.trim(), summary: f.summary.trim(), offer: f.offer.trim(), cta_label: f.cta_label.trim(), cta_href: f.cta_href.trim() };
    if (campaign) await actions.update(campaign.id, payload);
    else { const made = await actions.create(payload); if (made) onCreated(made.id); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(campaignUrl(f.slug)); toast("Landing URL copied.", "ok"); } catch { toast("Copy is blocked by this browser — select the URL and copy it by hand.", "danger"); } };
  const archive = async () => {
    if (!campaign) return;
    const to = campaign.status === "archived" ? "draft" : "archived";
    if (to === "archived" && !(await confirm({ title: "Archive this campaign?", body: "Its landing page disappears at the next publish. QR codes keep redirecting, so pause them too if the campaign is over.", confirmLabel: "Archive" }))) return;
    const r = await actions.update(campaign.id, { status: to }, { message: to === "archived" ? "Campaign archived." : "Restored as a draft." });
    if (r) setF((p) => ({ ...p, status: r.status }));
  };
  const del = async () => {
    if (!campaign || !(await confirm({ title: "Delete this campaign?", danger: true, confirmLabel: "Delete permanently", body: <>“{campaign.name}”, all of its QR codes and their scan history will be permanently deleted. Printed codes will stop working. Archive it instead to keep the record.</> }))) return;
    if (await actions.remove(campaign.id)) onBack();
  };

  return (
    <div>
      <div className="sticky top-16 z-10 -mx-4 mb-5 flex flex-wrap items-center gap-2 border-b border-ink-700 bg-ink-950/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
        <Button variant="ghost" size="sm" onClick={() => void back()}>← Campaigns</Button>
        <div className="mr-auto min-w-0"><h2 className="t-heading truncate text-fog-50">{campaign?.name ?? "New campaign"}</h2><p className="flex flex-wrap items-center gap-2 text-xs">{campaign && <StatusPill status={campaign.status} />}{dirty && <span className="t-label text-warn">Unsaved changes</span>}{ro && <span className="t-label text-fog-500">Read-only for your role</span>}</p></div>
        {canWrite && <>{campaign && <Button variant="danger" size="sm" onClick={() => void del()}>Delete</Button>}{campaign && <Button variant="ghost" size="sm" onClick={() => void archive()}>{campaign.status === "archived" ? "Restore" : "Archive"}</Button>}{campaign && <Button variant="ghost" size="sm" disabled={dirty} title={dirty ? "Save first, then duplicate" : undefined} onClick={() => void actions.duplicate(campaign)}>Duplicate</Button>}<Button size="sm" loading={saving} disabled={!dirty} onClick={() => void save()}>{campaign ? "Save changes" : "Create campaign"}</Button></>}
      </div>
      <Tabs label="Campaign sections" value={tab} onChange={setTab} tabs={[{ value: "details", label: "Details", count: Object.keys(errors).length || null }, { value: "qr", label: "QR codes", count: data.data?.codes.length ?? null }, { value: "analytics", label: "Analytics" }]} />
      <Panel>
        {tab === "details" && (
          <form noValidate className="flex flex-col gap-6" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <FormSection title="Campaign">
              <TextField label="Name" required disabled={ro} value={f.name} error={errors.name} onChange={(v) => { set("name", v); if (!slugTouched) setF((p) => ({ ...p, slug: slugify(v) })); }} />
              <TextField label="Offer" disabled={ro} value={f.offer} error={errors.offer} onChange={(v) => set("offer", v)} placeholder="15% off team orders of 50+" hint="One line. Only promise what SPP will honour." />
              <SlugField className="sm:col-span-2" label="Slug" required disabled={ro} value={f.slug} error={errors.slug} onChange={(v) => { setSlugTouched(true); set("slug", v); }} source={f.name} table="campaigns" excludeId={campaign?.id} hint="Changing it breaks links already shared (QR codes keep working)." />
              <div className="sm:col-span-2">
                <p className="t-label mb-1.5 text-fog-400">Landing URL</p>
                <div className="flex gap-2"><input readOnly aria-label="Landing URL" value={campaignUrl(f.slug || "…")} onFocus={(e) => e.currentTarget.select()} className="t-data min-h-11 min-w-0 flex-1 border border-ink-600 bg-ink-950 px-3 text-xs text-fog-300" /><Button variant="outline" size="sm" className="min-h-11" disabled={!SLUG_RE.test(f.slug)} onClick={() => void copy()}>Copy</Button></div>
                <p className="mt-1.5 text-xs text-fog-500">Live once the campaign is Published and the site has been published. Until then the page shows “campaign not found”.</p>
              </div>
              <AreaField className="sm:col-span-2" label="Summary" rows={2} maxLength={400} disabled={ro} value={f.summary} error={errors.summary} onChange={(v) => set("summary", v)} />
              <AreaField className="sm:col-span-2" label="Body" rows={8} maxLength={8000} disabled={ro} value={f.body} error={errors.body} onChange={(v) => set("body", v)} hint="Plain text. Blank line = new paragraph." />
              <MediaField className="sm:col-span-2" label="Hero image" disabled={ro} category="campaigns" value={f.hero_media_id} onChange={(v) => set("hero_media_id", v)} />
            </FormSection>
            <FormSection title="Call to action & products">
              <TextField label="Button label" required disabled={ro} value={f.cta_label} error={errors.cta_label} onChange={(v) => set("cta_label", v)} />
              <TextField label="Button link" required disabled={ro} value={f.cta_href} error={errors.cta_href} onChange={(v) => set("cta_href", v)} hint="e.g. /request-quote/ or /spp-studio/" />
              <MultiPick className="sm:col-span-2" label="Products in this campaign" disabled={ro} max={12} options={products} value={f.product_slugs} onChange={(v) => set("product_slugs", v)} emptyText="No products chosen." />
            </FormSection>
            <FormSection title="Schedule & publishing" note="Dates are shown on the landing page; they do not switch the campaign on or off. Status does — at the next “Publish site”.">
              <DateField label="Starts" disabled={ro} value={f.starts_on} onChange={(v) => set("starts_on", v)} />
              <DateField label="Ends" disabled={ro} value={f.ends_on} min={f.starts_on ?? undefined} error={errors.ends_on} onChange={(v) => set("ends_on", v)} />
              <SelectField label="Status" disabled={ro} value={f.status === "scheduled" ? "draft" : f.status} onChange={(v) => set("status", v)} options={PUBLISH_OPTIONS} />
            </FormSection>
            <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>Save</button>
          </form>
        )}
        {tab !== "details" && !campaign && <p className="text-sm text-fog-400">Create the campaign first — QR codes and analytics belong to a saved campaign.</p>}
        {tab !== "details" && campaign && <ErrorNote message={data.error} onRetry={() => void data.reload()} />}
        {tab === "qr" && campaign && <QrPanel campaign={campaign} canWrite={canWrite} stats={data.data?.stats ?? new Map()} onChanged={() => void data.reload()} />}
        {tab === "analytics" && campaign && (data.data ? <AnalyticsPanel scans={data.data.scans} codes={data.data.codes} stats={data.data.stats} today={today} /> : !data.error && <div className="skeleton h-64" />)}
      </Panel>
      {confirmUi}
    </div>
  );
}

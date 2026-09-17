"use client";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { SiteSettings } from "@/content/types";
import { useAuth } from "@/lib/backend/auth";
import { backend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { useConfirm } from "../resource/Confirm";
import { adminError } from "../resource/errors";
import { AreaField, FormSection, NumberField, TagsField, TextField } from "../resource/fields";
import { RowsField } from "../resource/rows";
import { ErrorNote, Panel } from "../ui";

const PLATFORMS = ["facebook", "instagram", "tiktok", "linkedin", "youtube", "line"] as const;
const e164 = z.union([z.literal(""), z.string().regex(/^\+[1-9]\d{7,14}$/, "Use international format with no spaces, e.g. +8562055512345 — or leave empty to hide this channel.")]);

const schema = z.object({
  companyName: z.string().trim().min(2, "Enter the company name.").max(80),
  legalName: z.string().trim().max(160),
  tagline: z.string().trim().max(160),
  description: z.string().trim().max(600),
  foundedYear: z.number({ error: "Enter a year." }).int().min(1950, "That year looks too early.").max(new Date().getFullYear(), "That year is in the future."),
  address: z.object({
    line1: z.string().trim().max(200), city: z.string().trim().max(80), country: z.string().trim().max(80),
    lat: z.number({ error: "Enter a latitude." }).min(13, "Latitude for Laos is between 13 and 23.").max(23, "Latitude for Laos is between 13 and 23."),
    lng: z.number({ error: "Enter a longitude." }).min(99, "Longitude for Laos is between 99 and 108.5.").max(108.5, "Longitude for Laos is between 99 and 108.5."),
  }),
  phone: e164, whatsapp: e164,
  email: z.union([z.literal(""), z.email("That email address does not look right.")]),
  hours: z.array(z.object({ days: z.string().trim().min(1, "Each row needs the days."), time: z.string().trim().min(1, "Each row needs the hours.") })).max(7),
  social: z.array(z.object({ platform: z.enum(PLATFORMS), url: z.string().trim().regex(/^https:\/\/\S+$/, "Each social link must be a full https:// address."), handle: z.string().trim().max(80) })).max(8),
  seo: z.object({
    titleTemplate: z.string().trim().max(80).refine((s) => s.includes("%s"), "The template must contain %s — that is where each page's own title goes."),
    defaultTitle: z.string().trim().min(3, "Enter a default title.").max(80),
    defaultDescription: z.string().trim().min(20, "Write a sentence or two.").max(200),
    keywords: z.array(z.string()).max(20),
  }),
});

const EMPTY: SiteSettings = { companyName: "", legalName: "", tagline: "", description: "", foundedYear: new Date().getFullYear(), address: { line1: "", city: "Vientiane", country: "Laos", lat: 17.9757, lng: 102.6331 }, phone: "", whatsapp: "", email: "", hours: [], social: [], seo: { titleTemplate: "%s — SPP", defaultTitle: "", defaultDescription: "", keywords: [] } };
const merge = (v: unknown): SiteSettings => { const s = (v && typeof v === "object" ? v : {}) as Partial<SiteSettings>; return { ...EMPTY, ...s, address: { ...EMPTY.address, ...s.address }, seo: { ...EMPTY.seo, ...s.seo }, hours: s.hours ?? [], social: s.social ?? [] }; };

export function CompanyTab({ onDirty }: { onDirty: (d: boolean) => void }) {
  const q = useQuery<{ value: unknown } | null>(() => backend()!.from("settings").select("value").eq("key", "site").maybeSingle(), []);
  if (q.loading) return <div className="skeleton h-96" />;
  if (q.error) return <ErrorNote message={q.error} onRetry={() => void q.reload()} />;
  return <CompanyForm key={JSON.stringify(q.data?.value ?? null)} stored={q.data?.value ?? null} onSaved={() => void q.reload()} onDirty={onDirty} />;
}

function CompanyForm({ stored, onSaved, onDirty }: { stored: unknown; onSaved: () => void; onDirty: (d: boolean) => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const initial = useMemo(() => merge(stored), [stored]);
  const [v, setV] = useState<SiteSettings>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirm, confirmUi] = useConfirm();
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  useEffect(() => { if (!dirty) return; const warn = (e: BeforeUnloadEvent) => e.preventDefault(); window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);

  const set = <K extends keyof SiteSettings>(k: K, val: SiteSettings[K]) => setV((p) => ({ ...p, [k]: val }));
  const err = (path: string) => errors[path] ?? null;
  const firstUnder = (prefix: string) => Object.entries(errors).find(([k]) => k.startsWith(prefix))?.[1] ?? null;

  const save = async () => {
    const r = schema.safeParse(v);
    if (!r.success) { const e: Record<string, string> = {}; for (const i of r.error.issues) e[i.path.join(".")] ??= i.message; setErrors(e); toast("Some fields need attention.", "danger"); return; }
    setErrors({});
    setSaving(true);
    // keep keys this form does not know about
    const value = { ...(stored && typeof stored === "object" ? stored : {}), ...r.data };
    const res = await backend()!.from("settings").upsert({ key: "site", value, is_public: true, updated_by: user?.id ?? null });
    setSaving(false);
    if (res.error) return toast(adminError(res.error), "danger");
    toast("Company details saved. They reach the public site at the next publish.", "ok");
    onSaved();
  };
  const reset = async () => { if (await confirm({ title: "Discard your edits?", body: "The form returns to the last saved values.", confirmLabel: "Discard", danger: true })) { setV(initial); setErrors({}); } };
  const tidy = (k: "phone" | "whatsapp") => set(k, v[k].replace(/[\s()-]/g, ""));

  return (
    <Panel title="Company & contact" action={<span className="flex items-center gap-2">{dirty && <span className="t-label hidden text-warn sm:inline">Unsaved</span>}<Button variant="ghost" size="sm" disabled={!dirty} onClick={() => void reset()}>Reset</Button><Button size="sm" loading={saving} disabled={!dirty} onClick={() => void save()}>Save</Button></span>}>
      {stored === null && <p className="mb-5 border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-fog-50">No company settings are stored yet, so the public site is using its built-in defaults. Fill this in and save to take control of them.</p>}
      <form noValidate onSubmit={(e) => { e.preventDefault(); void save(); }} className="flex flex-col gap-6">
        <FormSection title="Identity">
          <TextField label="Company name" required value={v.companyName} onChange={(x) => set("companyName", x)} error={err("companyName")} />
          <TextField label="Legal name" value={v.legalName} onChange={(x) => set("legalName", x)} error={err("legalName")} />
          <TextField label="Tagline" className="sm:col-span-2" value={v.tagline} onChange={(x) => set("tagline", x)} error={err("tagline")} />
          <AreaField label="Description" className="sm:col-span-2" rows={3} maxLength={600} value={v.description} onChange={(x) => set("description", x)} error={err("description")} />
          <NumberField label="Founded" step={1} value={v.foundedYear} onChange={(x) => set("foundedYear", x ?? 0)} error={err("foundedYear")} />
        </FormSection>
        <FormSection title="Address" note="Latitude and longitude place the pin on the contact page map.">
          <TextField label="Street address" className="sm:col-span-2" value={v.address.line1} onChange={(x) => set("address", { ...v.address, line1: x })} />
          <TextField label="City" value={v.address.city} onChange={(x) => set("address", { ...v.address, city: x })} />
          <TextField label="Country" value={v.address.country} onChange={(x) => set("address", { ...v.address, country: x })} />
          <NumberField label="Latitude" value={v.address.lat} onChange={(x) => set("address", { ...v.address, lat: x ?? 0 })} error={err("address.lat")} />
          <NumberField label="Longitude" value={v.address.lng} onChange={(x) => set("address", { ...v.address, lng: x ?? 0 })} error={err("address.lng")} />
        </FormSection>
        <FormSection title="Contact channels" note="An empty phone or WhatsApp number hides that channel everywhere on the site — never enter a placeholder.">
          <div onBlur={() => tidy("phone")}><TextField label="Phone" type="tel" inputMode="tel" placeholder="+85620…" value={v.phone} onChange={(x) => set("phone", x)} error={err("phone")} /></div>
          <div onBlur={() => tidy("whatsapp")}><TextField label="WhatsApp" type="tel" inputMode="tel" placeholder="+85620…" value={v.whatsapp} onChange={(x) => set("whatsapp", x)} error={err("whatsapp")} /></div>
          <TextField label="Email" type="email" inputMode="email" value={v.email} onChange={(x) => set("email", x)} error={err("email")} />
          <RowsField className="sm:col-span-2" label="Opening hours" addLabel="Add hours" max={7} value={v.hours} onChange={(x) => set("hours", x)} blank={{ days: "", time: "" }} error={firstUnder("hours")} columns={[{ key: "days", label: "Days", placeholder: "Mon – Fri" }, { key: "time", label: "Hours", placeholder: "08:30 – 17:30" }]} />
          <RowsField className="sm:col-span-2" label="Social profiles" addLabel="Add profile" max={8} value={v.social} onChange={(x) => set("social", x as SiteSettings["social"])} blank={{ platform: "facebook", url: "", handle: "" }} error={firstUnder("social")}
            columns={[{ key: "platform", label: "Platform", options: PLATFORMS.map((p) => ({ value: p, label: p[0]!.toUpperCase() + p.slice(1) })) }, { key: "url", label: "URL", placeholder: "https://…", grow: 2 }, { key: "handle", label: "Handle", placeholder: "@spp" }]} />
        </FormSection>
        <FormSection title="SEO defaults" note="Used by any page that does not set its own title or description.">
          <TextField label="Title template" value={v.seo.titleTemplate} onChange={(x) => set("seo", { ...v.seo, titleTemplate: x })} error={err("seo.titleTemplate")} hint="%s is replaced by the page title." />
          <TextField label="Default title" value={v.seo.defaultTitle} onChange={(x) => set("seo", { ...v.seo, defaultTitle: x })} error={err("seo.defaultTitle")} />
          <AreaField label="Default description" className="sm:col-span-2" rows={3} maxLength={200} value={v.seo.defaultDescription} onChange={(x) => set("seo", { ...v.seo, defaultDescription: x })} error={err("seo.defaultDescription")} />
          <TagsField label="Keywords" className="sm:col-span-2" max={20} value={v.seo.keywords} onChange={(x) => set("seo", { ...v.seo, keywords: x })} hint="A handful of real search phrases. More is not better." />
        </FormSection>
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>Save</button>
      </form>
      {confirmUi}
    </Panel>
  );
}

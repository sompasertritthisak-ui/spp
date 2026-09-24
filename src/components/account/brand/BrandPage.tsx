"use client";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { ErrorNote } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { FormError, Input, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import type { BrandProfilesRow } from "@/lib/backend/db-types";
import { requireBackend, toBackendError } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { usePortal } from "../PortalShell";
import { Block, PortalHeader, RowsSkeleton } from "../ui";
import { AssetLibrary } from "./AssetLibrary";
import { FontList, HEX, MAX_SWATCHES, PaletteEditor, type Swatch } from "./PaletteEditor";

const schema = z.object({
  brand_name: z.string().trim().max(160, "That brand name is too long."),
  colours: z.array(z.object({ name: z.string().trim().max(40), hex: z.string().regex(HEX, "Each colour needs a 6-digit hex value such as #1A73E8.") })).max(MAX_SWATCHES),
  fonts: z.array(z.string().trim().min(1).max(80)).max(12),
  guidelines: z.string().trim().max(4000, "Please keep the notes under 4,000 characters."),
});

const readSwatches = (raw: unknown): Swatch[] =>
  Array.isArray(raw) ? raw.flatMap((c) => (c && typeof c === "object" && typeof (c as Swatch).hex === "string" ? [{ name: typeof (c as Swatch).name === "string" ? (c as Swatch).name : "", hex: (c as Swatch).hex }] : [])) : [];

type Brand = Pick<BrandProfilesRow, "brand_name" | "colours" | "fonts" | "guidelines" | "updated_at">;

export function BrandPage() {
  const { uid } = usePortal();
  const q = useQuery<Brand | null>(() => requireBackend().from("brand_profiles").select("brand_name,colours,fonts,guidelines,updated_at").eq("owner_id", uid).maybeSingle(), [uid]);
  return (
    <>
      <PortalHeader title="My Brand" sub="Keep your colours, fonts, logos and guidelines in one place, so every job SPP makes for you starts from the same brand." />
      <ErrorNote message={q.error} onRetry={q.reload} />

      <div className="mb-10 flex items-start gap-4 border border-ink-700 border-l-2 border-l-gold bg-ink-900 p-5">
        <span aria-hidden className="reg mt-1 text-gold" />
        <div className="text-fog-300">
          <p><span className="t-label mr-2 text-fog-50">Brand consistency</span>SPP Studio compares the colours in a design with the palette saved here and points out anything off-brand.</p>
          <p className="mt-2 text-sm text-fog-500">Those hints are advisory only. They never block a design, and SPP still reviews every job before production.</p>
        </div>
      </div>

      <Block title="Brand profile">
        {/* keyed on the stored version so the form re-seeds after a save or retry, never while typing */}
        {q.loading && !q.data ? <RowsSkeleton rows={4} /> : q.error ? null : <BrandForm key={q.data?.updated_at ?? "new"} uid={uid} brand={q.data} onSaved={q.reload} />}
      </Block>

      <AssetLibrary />
    </>
  );
}

function BrandForm({ uid, brand, onSaved }: { uid: string; brand: Brand | null; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(brand?.brand_name ?? "");
  const [colours, setColours] = useState<Swatch[]>(() => readSwatches(brand?.colours));
  const [fonts, setFonts] = useState<string[]>(brand?.fonts ?? []);
  const [guidelines, setGuidelines] = useState(brand?.guidelines ?? "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const edit = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true); setError(null); };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ brand_name: name, colours, fonts, guidelines });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Please check the form.");
    setSaving(true);
    const v = parsed.data;
    const { error: err } = await requireBackend().from("brand_profiles").upsert({ owner_id: uid, brand_name: v.brand_name, colours: v.colours.map((c) => ({ name: c.name, hex: c.hex.toLowerCase() })), fonts: v.fonts, guidelines: v.guidelines }, { onConflict: "owner_id" });
    setSaving(false);
    if (err) return setError(toBackendError(err).message);
    setDirty(false);
    toast("Brand saved.", "ok");
    onSaved();
  };

  return (
    <form onSubmit={save} noValidate className="flex max-w-3xl flex-col gap-8">
      <Input label="Brand name" name="organization" autoComplete="organization" maxLength={160} value={name} onChange={(e) => edit(setName)(e.target.value)} />
      <PaletteEditor value={colours} onChange={edit(setColours)} />
      <FontList value={fonts} onChange={edit(setFonts)} />
      <Textarea label="Guidelines notes" rows={5} maxLength={4000} value={guidelines} onChange={(e) => edit(setGuidelines)(e.target.value)} hint="Anything SPP should always respect: clear space around the logo, colours never to combine, tone of voice." />
      <FormError message={error} />
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" loading={saving} disabled={!dirty}>Save brand</Button>
        <p className="text-sm text-fog-500" aria-live="polite">{dirty ? "Unsaved changes." : brand ? "All changes saved." : "Nothing saved yet."}</p>
      </div>
    </form>
  );
}

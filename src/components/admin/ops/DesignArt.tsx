"use client";
import Link from "next/link";
import { clsx } from "clsx";
import { DesignThumb } from "@/components/studio/DesignThumb";
import { toBackendError } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import type { DesignStatus } from "@/lib/backend/db-types";
import type { GarmentKey } from "@/content/types";
import { GARMENTS } from "@/lib/garments";
import { normaliseSides, usedSides, type Layer, type Sides } from "@/lib/studio/schema";
import { titleCase } from "@/lib/format";
import { StatusPill } from "../ui";
import { db } from "./data";

export type DesignArt = { id: string; ref: string; name: string; garment: GarmentKey; colour: string; status: DesignStatus; version: number; shownVersion: number; sides: Sides; urls: Record<string, string> };

const TTL = 4 * 60 * 1000; // signed URLs last 5 minutes; refetch a little earlier
const cache = new Map<string, { at: number; p: Promise<DesignArt | null> }>();
const garmentOf = (g: string): GarmentKey => (g in GARMENTS ? (g as GarmentKey) : "tee");

/** Signs private-artwork paths for the image layers of a design. Staff read access comes from the storage policy. */
export async function signAssets(sides: Sides): Promise<Record<string, string>> {
  const ids = [...new Set(Object.values(sides).flat().flatMap((l) => (l.type === "image" && l.assetId ? [l.assetId] : [])))];
  if (!ids.length) return {};
  const { data: assets } = await db().from("design_assets").select("id,path").in("id", ids);
  const rows = (assets ?? []) as { id: string; path: string }[];
  if (!rows.length) return {};
  const { data: signed } = await db().storage.from("private-artwork").createSignedUrls(rows.map((a) => a.path), 300);
  const out: Record<string, string> = {};
  rows.forEach((a, i) => { const u = signed?.[i]?.signedUrl; if (u) out[a.id] = u; });
  return out;
}

async function load(id: string, version: number | null): Promise<DesignArt | null> {
  const d = await db().from("designs").select("id,ref,name,garment,colour,status,version,sides").eq("id", id).maybeSingle();
  if (d.error) throw toBackendError(d.error);
  if (!d.data) return null;
  let raw: unknown = d.data.sides, colour: string = d.data.colour, shown: number = d.data.version;
  if (version != null && version !== d.data.version) {
    const v = await db().from("design_versions").select("colour,sides,version").eq("design_id", id).eq("version", version).maybeSingle();
    if (v.data) { raw = v.data.sides; colour = v.data.colour; shown = v.data.version; }
  }
  const sides = normaliseSides(raw);
  return { id: d.data.id, ref: d.data.ref, name: d.data.name, garment: garmentOf(d.data.garment), colour, status: d.data.status, version: d.data.version, shownVersion: shown, sides, urls: await signAssets(sides) };
}

export function loadDesignArt(id: string, version: number | null = null) {
  const key = `${id}:${version ?? "latest"}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.p;
  const p = load(id, version);
  cache.set(key, { at: Date.now(), p });
  p.catch(() => cache.delete(key));
  return p;
}
export const forgetDesignArt = (id: string) => { for (const k of cache.keys()) if (k.startsWith(`${id}:`)) cache.delete(k); };

export function useDesignArt(id: string | null | undefined, version: number | null = null) {
  return useQuery<DesignArt | null>(() => (id ? loadDesignArt(id, version) : Promise.resolve(null)), [id, version], { enabled: Boolean(id) });
}

export const imageUrlFor = (urls: Record<string, string>) => (l: Extract<Layer, { type: "image" }>) => (l.assetId ? urls[l.assetId] : undefined);

/** Small single-side thumbnail for lists, cards and line items. */
export function DesignMini({ designId, version = null, className }: { designId: string | null | undefined; version?: number | null; className?: string }) {
  const art = useDesignArt(designId, version);
  const box = clsx("flex h-16 w-14 flex-none items-center justify-center border border-ink-700 bg-ink-950", className);
  if (!designId) return <div className={box}><span className="t-label text-[0.5rem] text-fog-500">No art</span></div>;
  if (art.loading) return <div className={clsx(box, "skeleton")} />;
  if (!art.data) return <div className={box}><span className="t-label px-1 text-center text-[0.5rem] text-fog-500">Art n/a</span></div>;
  const side = usedSides(art.data.sides)[0] ?? "front";
  return <div className={box}><DesignThumb garment={art.data.garment} side={side} colour={art.data.colour} layers={art.data.sides[side] ?? []} imageUrl={imageUrlFor(art.data.urls)} className="h-full w-full" title={`${art.data.ref} ${side}`} /></div>;
}

/** Every used side of a design, labelled, with a link to the artwork review screen. */
export function DesignSides({ designId, version = null, link = true }: { designId: string; version?: number | null; link?: boolean }) {
  const art = useDesignArt(designId, version);
  if (art.loading) return <div className="skeleton h-40 w-full" />;
  if (art.error) return <p className="text-sm text-danger">{art.error}</p>;
  if (!art.data) return <p className="text-sm text-fog-500">This design is no longer available.</p>;
  const a = art.data;
  const sides = usedSides(a.sides);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        {link ? <Link href={`/admin/designs/?id=${a.id}`} className="t-data text-fog-50 underline decoration-ink-500 underline-offset-4 hover:decoration-yellow">{a.ref}</Link> : <span className="t-data text-fog-50">{a.ref}</span>}
        <span className="t-label text-[0.625rem] text-fog-500">v{a.shownVersion}{a.shownVersion !== a.version ? ` · latest v${a.version}` : ""}</span>
        <StatusPill status={a.status} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {(sides.length ? sides : ["front"]).map((s) => (
          <figure key={s} className="border border-ink-700 bg-ink-950 p-2">
            <DesignThumb garment={a.garment} side={s} colour={a.colour} layers={a.sides[s] ?? []} imageUrl={imageUrlFor(a.urls)} className="aspect-[25/28] w-full" title={`${a.ref} — ${s}`} />
            <figcaption className="t-label mt-1.5 text-center text-[0.625rem] text-fog-400">{titleCase(s)}</figcaption>
          </figure>
        ))}
      </div>
      {sides.length === 0 && <p className="mt-2 text-xs text-fog-500">No artwork has been placed on this design yet.</p>}
    </div>
  );
}

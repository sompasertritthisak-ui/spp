"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DesignThumb } from "@/components/studio/DesignThumb";
import { useQuery } from "@/lib/backend/hooks";
import type { ArtworkPreflightsRow, PreflightVerdict } from "@/lib/backend/db-types";
import { art, hydrateArt } from "@/lib/studio/persistence";
import { normaliseSides, usedSides, type DesignDoc, type ImageLayer } from "@/lib/studio/schema";
import { formatDateTime, titleCase } from "@/lib/format";
import { ADVISORY } from "../designs/Preflight";
import { StatusPill } from "../ui";
import { db } from "./data";
import { imageUrlFor, useDesignArt } from "./DesignArt";

// WebGL viewer is heavy and browser-only: fetched only when a staff member asks for 3D.
const Garment3D = dynamic(() => import("@/components/studio/Garment3D"), { ssr: false, loading: () => <div className="skeleton h-full w-full" /> });

type Pre = Pick<ArtworkPreflightsRow, "id" | "design_version" | "verdict" | "review_verdict" | "review_note" | "created_at">;

/** A design's latest automated preflight, so the verdict is visible where sales and production look. */
function useLatestPreflight(designId: string) {
  return useQuery<Pre | null>(async () => {
    const r = await db().from("artwork_preflights").select("id,design_version,verdict,review_verdict,review_note,created_at").eq("design_id", designId).order("created_at", { ascending: false }).limit(1);
    return { data: ((r.data ?? [])[0] as Pre | undefined) ?? null, error: r.error };
  }, [designId]);
}

/**
 * Loads the artwork bitmaps into the Studio registry for the 3D bake. Staff read
 * `private-artwork` under the storage policy; anything it refuses simply stays a
 * placeholder and the caption says where the files are.
 */
function useHydrated(doc: DesignDoc | null, on: boolean) {
  const [state, setState] = useState<{ key: string; ready: boolean; missing: number }>({ key: "", ready: false, missing: 0 });
  const key = doc ? `${doc.garment}:${doc.colour}:${Object.keys(doc.sides).join(",")}` : "";
  useEffect(() => {
    if (!on || !doc) return;
    let live = true;
    void hydrateArt(doc).then(() => {
      if (!live) return;
      const images = Object.values(doc.sides).flat().filter((l): l is ImageLayer => l.type === "image");
      setState({ key, ready: true, missing: images.filter((l) => !art.bitmap(l)).length });
    });
    return () => { live = false; };
  }, [on, doc, key]);
  return state.key === key && state.ready ? state : null;
}

const verdictTone = (v: PreflightVerdict | null | undefined) => v ?? "not_run";

/**
 * Mockup of a designed line for the Command Center: every used side as a flat
 * garment render, a 3D toggle using the same viewer customers see in Studio, and
 * the automated preflight verdict beside it.
 */
export function DesignPreview({ designId, version = null, heading }: { designId: string; version?: number | null; heading?: string }) {
  const a = useDesignArt(designId, version);
  const pre = useLatestPreflight(designId);
  const [view, setView] = useState<"flat" | "3d">("flat");
  const d = a.data;
  // Sides are deep-copied: hydrateArt annotates image layers with an in-memory art key.
  const doc = useMemo<DesignDoc | null>(() => (d ? { productSlug: d.productSlug || "design", garment: d.garment, colour: d.colour, sides: normaliseSides(JSON.parse(JSON.stringify(d.sides))) } : null), [d]);
  const hydrated = useHydrated(doc, view === "3d");

  if (a.loading && !d) return <div className="skeleton h-48 w-full" />;
  if (a.error) return <p className="text-sm text-danger">{a.error}</p>;
  if (!d || !doc) return <p className="text-sm text-fog-500">This design is no longer available, or your role cannot view it.</p>;

  const sides = usedSides(d.sides);
  const imageLayers = Object.values(d.sides).flat().filter((l) => l.type === "image");
  const unsigned = imageLayers.filter((l) => l.type === "image" && (!l.assetId || !d.urls[l.assetId])).length;
  const p = pre.data;
  const verdict = p ? (p.review_verdict ?? p.verdict) : null;

  return (
    <figure className="border border-ink-700 bg-ink-950">
      <figcaption className="flex flex-wrap items-center gap-2 border-b border-ink-700 px-3 py-2 text-sm">
        {heading && <span className="text-fog-50">{heading}</span>}
        <Link href={`/admin/designs/?id=${d.id}`} className="t-data text-fog-50 underline decoration-ink-500 underline-offset-4 hover:decoration-yellow">{d.ref}</Link>
        <span className="t-label text-[0.625rem] text-fog-500">v{d.shownVersion}{d.shownVersion !== d.version ? ` · latest v${d.version}` : ""} · {titleCase(d.garment)} · <span className="inline-block h-2.5 w-2.5 -mb-px border border-ink-500 align-middle" style={{ background: d.colour }} /> {d.colour}</span>
        <StatusPill status={d.status} />
        <span className="ml-auto inline-flex border border-ink-600" role="tablist" aria-label="Mockup view">
          {(["flat", "3d"] as const).map((v) => <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`t-label min-h-9 px-3 text-[0.625rem] transition-colors ${view === v ? "bg-yellow text-ink-950" : "text-fog-300 hover:text-fog-50"}`}>{v === "flat" ? "Mockup" : "3D"}</button>)}
        </span>
      </figcaption>

      {view === "flat" ? (
        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
          {(sides.length ? sides : ["front"]).map((s) => (
            <div key={s} className="border border-ink-800 bg-ink-900 p-2">
              <DesignThumb garment={d.garment} side={s} colour={d.colour} layers={d.sides[s] ?? []} imageUrl={imageUrlFor(d.urls)} className="aspect-[25/28] w-full" title={`${d.ref} — ${s}`} />
              <p className="t-label mt-1.5 text-center text-[0.625rem] text-fog-400">{titleCase(s)}</p>
            </div>
          ))}
          {sides.length === 0 && <p className="col-span-full text-xs text-fog-500">No artwork has been placed on this design yet.</p>}
        </div>
      ) : (
        <div className="relative aspect-[4/3] w-full bg-[radial-gradient(ellipse_at_center,_var(--color-ink-800),_var(--color-ink-950))]">
          {hydrated ? <Garment3D doc={doc} /> : <div className="flex h-full items-center justify-center"><span className="t-label text-[0.625rem] text-fog-500" aria-live="polite">Preparing artwork…</span></div>}
          <p className="t-label pointer-events-none absolute bottom-2 left-3 text-[0.5625rem] text-fog-500">Drag to rotate · same viewer as SPP Studio</p>
        </div>
      )}

      {((view === "flat" && unsigned > 0) || (view === "3d" && hydrated && hydrated.missing > 0)) && (
        <p className="border-t border-ink-800 px-3 py-2 text-xs text-fog-400">{view === "flat" ? unsigned : hydrated?.missing} uploaded image{(view === "flat" ? unsigned : hydrated?.missing ?? 0) === 1 ? "" : "s"} shown as placeholders — the artwork files are available in the design record.</p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-ink-700 px-3 py-2 text-xs text-fog-400">
        <span className="t-label text-[0.625rem] text-fog-500">Preflight</span>
        <StatusPill status={verdictTone(verdict)} />
        {p ? <span>{p.review_verdict ? "SPP review" : "automated"} on v{p.design_version} · {formatDateTime(p.created_at)}{p.design_version !== d.shownVersion ? ` · design shown is v${d.shownVersion}` : ""}{p.review_note ? ` — ${p.review_note}` : ""}</span> : pre.loading ? <span className="skeleton inline-block h-3 w-24" /> : <span>{pre.error ? "not visible to your role" : "not run yet"}</span>}
        <span className="basis-full italic text-fog-500">{ADVISORY}</span>
      </div>
    </figure>
  );
}

/** Every distinct design used by a set of line items, in line order. */
export function DesignPreviews({ items }: { items: { design_id: string | null; design_version: number | null; product_name: string; qty: number }[] }) {
  const seen = new Set<string>();
  const used = items.filter((i) => { if (!i.design_id) return false; const k = `${i.design_id}:${i.design_version ?? ""}`; if (seen.has(k)) return false; seen.add(k); return true; });
  if (!used.length) return <p className="text-sm text-fog-500">No line on this record carries a Studio design. Artwork supplied another way is attached to the lead or thread.</p>;
  return <div className="flex flex-col gap-3">{used.map((i) => <DesignPreview key={`${i.design_id}:${i.design_version ?? ""}`} designId={i.design_id!} version={i.design_version} heading={`${i.product_name} × ${i.qty}`} />)}</div>;
}

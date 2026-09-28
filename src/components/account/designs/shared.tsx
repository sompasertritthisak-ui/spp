"use client";
import { clsx } from "clsx";
import { useMemo } from "react";
import { DesignThumb } from "@/components/studio/DesignThumb";
import type { GarmentKey } from "@/content/types";
import type { DesignsRow } from "@/lib/backend/db-types";
import { requireBackend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { GARMENT_BOX, GARMENTS } from "@/lib/garments";
import { useT } from "@/lib/i18n";
import { normaliseSides, usedSides, type ImageLayer, type Layer, type Sides } from "@/lib/studio/schema";
import { useSignedUrls } from "../storage";
import { PreviewWatermark } from "./Watermark";

export const DESIGN_COLS = "id,ref,name,product_slug,garment,colour,size,sides,status,version,share_token,template_slug,updated_at";
export type DesignLite = Pick<DesignsRow, "id" | "ref" | "name" | "product_slug" | "garment" | "colour" | "size" | "sides" | "status" | "version" | "share_token" | "template_slug" | "updated_at">;

export const toGarment = (g: string): GarmentKey => (g in GARMENTS ? (g as GarmentKey) : "tee");

/** The side a thumbnail should show: the front when it carries art, otherwise the first side that does. */
export function thumbSide(raw: unknown): { sides: Sides; side: string; layers: Layer[] } {
  const sides = normaliseSides(raw);
  const used = usedSides(sides);
  const side = used.includes("front") || !used.length ? "front" : used[0]!;
  return { sides, side, layers: sides[side] ?? [] };
}

type ImageResolver = (l: ImageLayer) => string | undefined;

/** Resolves image layers → design_assets → short-lived signed URLs. One query for a whole list. */
export function useDesignImages(designs: Pick<DesignsRow, "sides">[] | null | undefined): ImageResolver {
  const ids = useMemo(() => {
    const out = new Set<string>();
    for (const d of designs ?? []) for (const l of thumbSide(d.sides).layers) if (l.type === "image" && l.assetId) out.add(l.assetId);
    return [...out].sort();
  }, [designs]);
  const assets = useQuery<{ id: string; path: string }[]>(() => requireBackend().from("design_assets").select("id,path").in("id", ids), [ids.join(",")], { enabled: ids.length > 0 });
  const paths = useMemo(() => assets.data?.map((a) => a.path) ?? [], [assets.data]);
  const url = useSignedUrls(paths);
  return useMemo(() => {
    const byId = new Map(assets.data?.map((a) => [a.id, a.path]));
    return (l: ImageLayer) => (l.assetId ? url(byId.get(l.assetId)) : undefined);
  }, [assets.data, url]);
}

/**
 * The one way My SPP shows a design — cards, the overview strip, quote and order
 * lines all come through here, so every preview carries the SPP PREVIEW mark.
 */
export function DesignPreview({ design, imageUrl, className }: { design: Pick<DesignsRow, "garment" | "colour" | "sides" | "name" | "ref">; imageUrl?: ImageResolver; className?: string }) {
  const t = useT();
  const thumb = thumbSide(design.sides);
  return (
    <div className={clsx("relative isolate overflow-hidden", className)} style={{ aspectRatio: `${GARMENT_BOX.w} / ${GARMENT_BOX.h}` }}>
      <DesignThumb garment={toGarment(design.garment)} side={thumb.side} colour={design.colour} layers={thumb.layers} imageUrl={imageUrl} className="block h-full w-full" title={t("des.previewOf", { name: design.name })} />
      <PreviewWatermark designRef={design.ref} />
    </div>
  );
}

/** Designs referenced by quote / order lines. RLS returns only the customer's own; a deleted design simply is not in the map. */
export function useDesignsById(ids: (string | null)[]) {
  const key = useMemo(() => [...new Set(ids.filter((x): x is string => Boolean(x)))].sort(), [ids]);
  const q = useQuery<DesignLite[]>(() => requireBackend().from("designs").select(DESIGN_COLS).in("id", key), [key.join(",")], { enabled: key.length > 0 });
  const imageUrl = useDesignImages(q.data);
  const byId = useMemo(() => new Map(q.data?.map((d) => [d.id, d])), [q.data]);
  return { byId, imageUrl };
}

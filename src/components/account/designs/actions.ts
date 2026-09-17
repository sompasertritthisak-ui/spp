"use client";
import { BackendError, requireBackend, toBackendError } from "@/lib/backend/client";
import { ARTWORK_BUCKET, objectName } from "../storage";
import { removePrivate } from "../uploads";
import type { DesignLite } from "./shared";

type RawLayer = Record<string, unknown>;
const isLayer = (l: unknown): l is RawLayer => Boolean(l) && typeof l === "object" && !Array.isArray(l);

function assetIds(sides: unknown): string[] {
  if (!sides || typeof sides !== "object") return [];
  const out = new Set<string>();
  for (const layers of Object.values(sides as Record<string, unknown>))
    if (Array.isArray(layers)) for (const l of layers) if (isLayer(l) && l.type === "image" && typeof l.assetId === "string") out.add(l.assetId);
  return [...out];
}

const remap = (sides: unknown, map: Map<string, string>) =>
  Object.fromEntries(Object.entries((sides ?? {}) as Record<string, unknown>).map(([k, layers]) => [k, Array.isArray(layers) ? layers.map((l) => (isLayer(l) && typeof l.assetId === "string" && map.has(l.assetId) ? { ...l, assetId: map.get(l.assetId) } : l)) : layers]));

/**
 * Inserts a copy. The database assigns the new ref and resets status/version.
 * Uploaded artwork is copied too, so the duplicate survives if the original is
 * deleted; if a file cannot be copied the layer keeps pointing at the original.
 */
export async function duplicateDesign(uid: string, d: DesignLite): Promise<{ id: string; ref: string }> {
  const b = requireBackend();
  const ids = assetIds(d.sides);
  const map = new Map<string, string>();
  const newAssetIds: string[] = [];
  if (ids.length) {
    const { data: assets } = await b.from("design_assets").select("id,path,file_name,mime,bytes,width,height").in("id", ids).eq("owner_id", uid);
    for (const a of assets ?? []) {
      const ext = String(a.path).split(".").pop() ?? "bin";
      const to = `${uid}/${crypto.randomUUID()}.${ext}`;
      const { error: copyErr } = await b.storage.from(ARTWORK_BUCKET).copy(objectName(a.path), to);
      if (copyErr) continue;
      const { data: row, error: rowErr } = await b.from("design_assets").insert({ owner_id: uid, path: to, file_name: a.file_name, mime: a.mime, bytes: a.bytes, width: a.width, height: a.height }).select("id").single();
      if (rowErr || !row) { void removePrivate([to]); continue; }
      map.set(a.id, row.id);
      newAssetIds.push(row.id);
    }
  }
  const { data, error } = await b.from("designs")
    .insert({ ref: "", owner_id: uid, name: `${d.name} (copy)`.slice(0, 120), product_slug: d.product_slug, garment: d.garment, colour: d.colour, size: d.size, sides: remap(d.sides, map), status: "draft", template_slug: d.template_slug })
    .select("id,ref").single();
  if (error || !data) throw error ? toBackendError(error) : new BackendError("We could not duplicate that design. Please try again.");
  if (newAssetIds.length) await b.from("design_assets").update({ design_id: data.id }).in("id", newAssetIds).eq("owner_id", uid);
  return data as { id: string; ref: string };
}

/** Deletes the design row (versions, assets and preflights cascade) and then its private files. */
export async function deleteDesign(uid: string, id: string) {
  const b = requireBackend();
  const [{ data: assets }, { data: design }] = await Promise.all([
    b.from("design_assets").select("path").eq("design_id", id).eq("owner_id", uid),
    b.from("designs").select("preview_path").eq("id", id).maybeSingle(),
  ]);
  const { error } = await b.from("designs").delete().eq("id", id).eq("owner_id", uid);
  if (error) throw toBackendError(error);
  await removePrivate((assets ?? []).map((a) => objectName(String(a.path))));
  const preview = design?.preview_path ? String(design.preview_path).replace(/^\/?design-previews\//, "") : null;
  if (preview) await b.storage.from("design-previews").remove([preview]).then(() => {}, () => {});
}

export async function renameDesign(uid: string, id: string, name: string) {
  const { error } = await requireBackend().from("designs").update({ name }).eq("id", id).eq("owner_id", uid);
  if (error) throw toBackendError(error);
}

/** → the share token, or null when sharing was switched off. */
export async function setSharing(id: string, shared: boolean): Promise<string | null> {
  const { data, error } = await requireBackend().rpc("set_design_sharing", { design: id, shared });
  if (error) throw toBackendError(error);
  return (data as string | null) ?? null;
}

/** Designs SPP is quoting or producing must stay intact for traceability. */
export const lockedBySpp = (status: DesignLite["status"]) => status === "submitted" || status === "approved";

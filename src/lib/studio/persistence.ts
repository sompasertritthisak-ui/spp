"use client";
import { backend, BackendError, requireBackend, toBackendError } from "@/lib/backend/client";
import { designDocSchema, normaliseSides, type DesignDoc, type ImageLayer, type Layer } from "./schema";
import type { Check, Verdict } from "./preflight";
import type { Remote } from "./store";
import { loadArtwork, type LoadedArt } from "./uploads";

/* ── In-browser artwork registry ───────────────────────────────────────────
   Bitmaps and original files never enter React state or the design JSON;
   image layers carry only an `artKey` into this map. */
const registry = new Map<string, LoadedArt>();
export const art = {
  get: (l: ImageLayer) => (l.artKey ? registry.get(l.artKey) : undefined),
  set: (key: string, a: LoadedArt) => void registry.set(key, a),
  bitmap: (l: ImageLayer) => (l.artKey ? registry.get(l.artKey)?.bitmap : undefined),
  url: (l: ImageLayer) => (l.artKey ? registry.get(l.artKey)?.previewUrl : undefined),
};

/* ── IndexedDB: lets a guest close the tab and resume with their uploads intact ── */
const DB = "spp-studio", STORE = "art";
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbPut(key: string, file: File) {
  try { const d = await idb(); await new Promise<void>((res, rej) => { const t = d.transaction(STORE, "readwrite"); t.objectStore(STORE).put(file, key); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); } catch { /* private mode: resume simply won't include uploads */ }
}
async function idbGet(key: string): Promise<File | undefined> {
  try { const d = await idb(); return await new Promise((res, rej) => { const q = d.transaction(STORE).objectStore(STORE).get(key); q.onsuccess = () => res(q.result as File | undefined); q.onerror = () => rej(q.error); }); } catch { return undefined; }
}

export async function registerArt(key: string, a: LoadedArt) {
  art.set(key, a);
  await idbPut(key, a.file);
}

/* ── Local draft ─────────────────────────────────────────────────────────── */
const DRAFT = "spp.studio.draft.v1";
export type Draft = { doc: DesignDoc; name: string; side: string; remote: Remote | null; templateSlug: string | null; at: number };

export function saveDraft(d: Omit<Draft, "at">) {
  try { localStorage.setItem(DRAFT, JSON.stringify({ ...d, at: Date.now() })); } catch { /* storage full or blocked */ }
}
export function clearDraft() { try { localStorage.removeItem(DRAFT); } catch { /* ignore */ } }

export async function loadDraft(): Promise<Draft | null> {
  try {
    const raw = localStorage.getItem(DRAFT);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    const doc = designDocSchema.safeParse({ ...d.doc, sides: normaliseSidesKeepIds(d.doc?.sides) });
    if (!doc.success) return null;
    await hydrateArt(doc.data);
    return { ...d, doc: doc.data };
  } catch { return null; }
}

const normaliseSidesKeepIds = (raw: unknown) => normaliseSides(raw);

/** Re-open uploaded artwork for every image layer: from IndexedDB, else from private storage. */
export async function hydrateArt(doc: DesignDoc) {
  const images = Object.values(doc.sides).flat().filter((l): l is ImageLayer => l.type === "image");
  await Promise.all(images.map(async (l) => {
    if (l.artKey && registry.has(l.artKey)) return;
    const key = l.artKey ?? l.assetId;
    if (!key) return;
    l.artKey = key;
    const local = await idbGet(key);
    if (local) { try { registry.set(key, await loadArtwork(local)); return; } catch { /* fall through to remote */ } }
    const b = backend();
    if (!b || !l.assetId) return;
    const { data: row } = await b.from("design_assets").select("path,file_name,mime").eq("id", l.assetId).maybeSingle();
    if (!row) return;
    const { data: blob } = await b.storage.from("private-artwork").download(row.path as string);
    if (!blob) return;
    try { registry.set(key, await loadArtwork(new File([blob], row.file_name as string, { type: row.mime as string }))); } catch { /* leave as placeholder */ }
  }));
}

/* ── Cloud save ──────────────────────────────────────────────────────────── */
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };

export type SaveInput = { doc: DesignDoc; name: string; remote: Remote | null; templateSlug: string | null; userId: string; preflight: { verdict: Verdict; checks: Check[] } };
export type SaveResult = { remote: Remote; doc: DesignDoc };

export async function saveDesign(i: SaveInput): Promise<SaveResult> {
  const b = requireBackend();

  // 1 · upload any artwork that is not yet in private storage
  const uploaded = new Map<string, string>(); // artKey → assetId
  const sides: Record<string, Layer[]> = {};
  for (const [side, layers] of Object.entries(i.doc.sides)) {
    sides[side] = [];
    for (const l of layers) {
      if (l.type !== "image" || l.assetId) { sides[side]!.push(l); continue; }
      const a = art.get(l);
      if (!a || !l.artKey) throw new BackendError(`“${l.name}” needs to be uploaded again before saving.`, "invalid");
      let assetId = uploaded.get(l.artKey);
      if (!assetId) {
        // unguessable, owner-scoped path: storage policy requires the first folder to be the uploader's uid
        const path = `${i.userId}/${crypto.randomUUID()}.${EXT[a.meta.mime] ?? "bin"}`;
        const up = await b.storage.from("private-artwork").upload(path, a.file, { contentType: a.meta.mime, upsert: false });
        if (up.error) throw toBackendError(up.error);
        const ins = await b.from("design_assets").insert({ owner_id: i.userId, design_id: i.remote?.id ?? null, path, file_name: a.name, mime: a.meta.mime, bytes: a.meta.bytes, width: a.meta.naturalW, height: a.meta.naturalH }).select("id").single();
        if (ins.error) throw toBackendError(ins.error);
        assetId = ins.data.id as string;
        uploaded.set(l.artKey, assetId);
      }
      sides[side]!.push({ ...l, assetId });
    }
  }
  const doc: DesignDoc = { ...i.doc, sides };
  const row = { name: i.name || "Untitled design", product_slug: doc.productSlug, garment: doc.garment, colour: doc.colour, size: doc.size ?? null, sides: doc.sides, template_slug: i.templateSlug, status: "saved" as const };

  // 2 · insert (server assigns SPP-DESIGN-… ref) or update (server bumps the version + snapshots history)
  const q = i.remote
    ? b.from("designs").update(row).eq("id", i.remote.id).select("id,ref,version,status").single()
    : b.from("designs").insert({ ...row, owner_id: i.userId, ref: "pending" }).select("id,ref,version,status").single();
  const { data, error } = await q;
  if (error) throw toBackendError(error);
  const remote = data as Remote;

  // 3 · link fresh assets to the design, and record the automated preflight for SPP's reviewers
  if (uploaded.size) await b.from("design_assets").update({ design_id: remote.id }).in("id", [...uploaded.values()]);
  await b.from("artwork_preflights").insert({ design_id: remote.id, design_version: remote.version, verdict: i.preflight.verdict, checks: i.preflight.checks });
  return { remote, doc };
}

export async function loadDesign(id: string): Promise<{ doc: DesignDoc; name: string; remote: Remote; templateSlug: string | null }> {
  const { data, error } = await requireBackend().from("designs").select("id,ref,version,status,name,product_slug,garment,colour,size,sides,template_slug").eq("id", id).maybeSingle();
  if (error) throw toBackendError(error);
  if (!data) throw new BackendError("We could not find that design on your account.", "not_found");
  const doc = designDocSchema.parse({ productSlug: data.product_slug, garment: data.garment, colour: data.colour, size: data.size ?? undefined, sides: normaliseSides(data.sides) });
  await hydrateArt(doc);
  return { doc, name: data.name as string, templateSlug: (data.template_slug as string | null) ?? null, remote: { id: data.id as string, ref: data.ref as string, version: data.version as number, status: data.status as string } };
}

export async function loadShared(token: string): Promise<{ doc: DesignDoc; name: string; ref: string } | null> {
  const { data, error } = await requireBackend().rpc("get_shared_design", { token });
  if (error) throw toBackendError(error);
  if (!data) return null;
  const d = data as { ref: string; name: string; productSlug: string; garment: string; colour: string; sides: unknown };
  const doc = designDocSchema.parse({ productSlug: d.productSlug, garment: d.garment, colour: d.colour, sides: normaliseSides(d.sides) });
  return { doc, name: d.name, ref: d.ref };
}

export async function loadBrandPalette(userId: string): Promise<{ name: string; hex: string }[]> {
  const b = backend();
  if (!b) return [];
  const { data } = await b.from("brand_profiles").select("colours").eq("owner_id", userId).maybeSingle();
  const list = (data?.colours ?? []) as { name?: string; hex?: string }[];
  return list.filter((c) => /^#[0-9a-f]{6}$/i.test(c.hex ?? "")).map((c) => ({ name: c.name ?? "", hex: c.hex! }));
}

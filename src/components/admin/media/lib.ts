import { backend } from "@/lib/backend/client";
import type { MediaInsert, MediaRow } from "@/lib/backend/db-types";
import { env } from "@/lib/env";
import { adminError } from "../resource/errors";

/* Mirrors the `public-media` bucket in supabase/migrations/0005_storage.sql.
   The bucket re-validates; these checks exist to fail fast with a clear message. */
export const BUCKET = "public-media";
export const MAX_BYTES = 10 * 1024 * 1024;
export const ALLOWED: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/avif": "avif", "image/svg+xml": "svg", "video/mp4": "mp4", "application/pdf": "pdf",
};
export const ACCEPT_ALL = Object.keys(ALLOWED).join(",");
export const ACCEPT_IMAGES = Object.keys(ALLOWED).filter((m) => m.startsWith("image/")).join(",");
export const MEDIA_CATEGORIES = ["general", "products", "portfolio", "billboards", "journal", "team", "campaigns", "pages", "brand"] as const;

export const mediaUrl = (path: string) => `${env.supabaseUrl}/storage/v1/object/public/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
export const isImage = (m: Pick<MediaRow, "mime">) => m.mime.startsWith("image/");
export const formatBytes = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`);

export function validateFile(file: File): string | null {
  if (!ALLOWED[file.type]) return `${file.name}: this file type is not accepted. Use PNG, JPEG, WebP, AVIF, SVG, MP4 or PDF.`;
  if (file.size > MAX_BYTES) return `${file.name}: ${formatBytes(file.size)} is over the 10 MB limit.`;
  if (file.size === 0) return `${file.name}: the file is empty.`;
  return null;
}

/** SVG can carry script. Strip everything active before it reaches a public bucket. */
async function sanitiseSvg(file: File): Promise<{ file: File; width: number | null; height: number | null }> {
  const { default: DOMPurify } = await import("dompurify");
  // Internal references (#gradient, #clip) are fine; anything that could fetch a remote resource is not.
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    for (const a of ["href", "xlink:href"]) if (node.hasAttribute(a) && !(node.getAttribute(a) ?? "").startsWith("#")) node.removeAttribute(a);
  });
  let clean: string;
  try { clean = DOMPurify.sanitize(await file.text(), { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ["foreignObject", "script", "a", "style"] }); }
  finally { DOMPurify.removeHook("afterSanitizeAttributes"); }
  const doc = new DOMParser().parseFromString(clean, "image/svg+xml");
  const svg = doc.documentElement;
  if (!clean.trim() || svg.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) throw new Error(`${file.name}: this SVG could not be made safe to publish. Export it again as a plain SVG, or upload a PNG.`);
  const vb = svg.getAttribute("viewBox")?.split(/[\s,]+/).map(Number);
  const num = (v: string | null) => { const n = v ? parseFloat(v) : NaN; return Number.isFinite(n) && n > 0 ? Math.round(n) : null; };
  return { file: new File([clean], file.name, { type: "image/svg+xml" }), width: num(svg.getAttribute("width")) ?? (vb?.[2] ? Math.round(vb[2]) : null), height: num(svg.getAttribute("height")) ?? (vb?.[3] ? Math.round(vb[3]) : null) };
}

function readImageSize(file: File): Promise<{ width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth || null, height: img.naturalHeight || null }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ width: null, height: null }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

/** Validates, sanitises (SVG), uploads to `<yyyy>/<mm>/<uuid>.<ext>` and records the `media` row. */
export async function uploadMedia(input: File, meta: { category: string; userId: string | null; alt?: string; tags?: string[] }): Promise<MediaRow> {
  const b = backend();
  if (!b) throw new Error("The back-end is not connected.");
  const invalid = validateFile(input);
  if (invalid) throw new Error(invalid);

  let file = input;
  let size: { width: number | null; height: number | null } = { width: null, height: null };
  if (input.type === "image/svg+xml") { const s = await sanitiseSvg(input); file = s.file; size = s; }
  else if (input.type.startsWith("image/")) size = await readImageSize(input);

  const now = new Date();
  const path = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${ALLOWED[file.type]}`;
  const up = await b.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (up.error) throw new Error(/mime|type/i.test(up.error.message) ? `${input.name}: the storage bucket rejected this file type.` : /size|large/i.test(up.error.message) ? `${input.name}: the file is larger than the bucket allows.` : /policy|security|authoriz/i.test(up.error.message) ? "You do not have permission to upload media." : `${input.name}: the upload failed. Please try again.`);

  const row: MediaInsert = { bucket: BUCKET, path, file_name: input.name.slice(0, 200), mime: file.type, bytes: file.size, width: size.width, height: size.height, alt: meta.alt ?? "", category: meta.category, tags: meta.tags ?? [], uploaded_by: meta.userId };
  const ins = await b.from("media").insert(row).select("*").single();
  if (ins.error) {
    await b.storage.from(BUCKET).remove([path]); // do not leave an orphaned object behind
    throw new Error(adminError(ins.error));
  }
  return ins.data as MediaRow;
}

"use client";
import { BackendError, requireBackend, toBackendError } from "@/lib/backend/client";
import { ARTWORK_BUCKET } from "./storage";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export type ArtworkMime = "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml" | "application/pdf";
const EXT: Record<ArtworkMime, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg", "application/pdf": "pdf" };
export const ALL_ARTWORK = Object.keys(EXT) as ArtworkMime[];
export const acceptAttr = (allow: ArtworkMime[]) => allow.flatMap((m) => [m, `.${EXT[m]}`, ...(m === "image/jpeg" ? [".jpeg"] : [])]).join(",");

const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/** Identify a file by its first bytes — the browser-reported type and the extension are both user-controlled. */
function sniff(head: Uint8Array): ArtworkMime | null {
  if (starts(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts(head, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts(head, [0x52, 0x49, 0x46, 0x46]) && starts(head, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (starts(head, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  // TextDecoder strips a UTF-8 byte-order mark by default
  const text = new TextDecoder("utf-8", { fatal: false }).decode(head).trimStart();
  if (/^(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(text)) return "image/svg+xml";
  return null;
}

async function sanitiseSvg(file: File): Promise<Blob> {
  const { default: DOMPurify } = await import("dompurify");
  const clean = DOMPurify.sanitize(await file.text(), { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ["script", "foreignObject"] });
  if (!/<svg[\s>]/i.test(clean)) throw new BackendError("That SVG could not be read safely. Export it again as a plain SVG, or upload a PDF or PNG.", "invalid");
  return new Blob([clean], { type: "image/svg+xml" });
}

async function dimensions(blob: Blob, mime: ArtworkMime): Promise<{ width: number | null; height: number | null }> {
  if (mime === "application/pdf" || mime === "image/svg+xml") return { width: null, height: null };
  try {
    const bmp = await createImageBitmap(blob);
    const d = { width: bmp.width, height: bmp.height };
    bmp.close();
    return d;
  } catch {
    return { width: null, height: null };
  }
}

const safeName = (name: string, fallback: string) =>
  [...name].map((ch) => (ch.charCodeAt(0) < 32 || ch === "/" || ch === "\\" ? " " : ch)).join("").trim().slice(0, 180) || fallback;

export type PreparedUpload = { blob: Blob; mime: ArtworkMime; ext: string; fileName: string; bytes: number; width: number | null; height: number | null };

/** Validates size, real type (magic bytes) and declared type; sanitises SVG. Throws a customer-safe BackendError. */
export async function prepareUpload(file: File, allow: ArtworkMime[] = ALL_ARTWORK): Promise<PreparedUpload> {
  if (file.size === 0) throw new BackendError("That file is empty.", "invalid");
  if (file.size > MAX_UPLOAD_BYTES) throw new BackendError("That file is larger than 25 MB. Please compress it, or ask SPP for another way to send it.", "invalid");
  const mime = sniff(new Uint8Array(await file.slice(0, 1024).arrayBuffer()));
  if (!mime || !allow.includes(mime)) throw new BackendError(`That file type is not accepted here. Use ${allow.map((m) => EXT[m].toUpperCase()).join(", ")}.`, "invalid");
  if (file.type && file.type !== mime && !(mime === "image/jpeg" && file.type === "image/jpg")) throw new BackendError("That file's contents do not match its type. Please export it again and retry.", "invalid");
  const blob = mime === "image/svg+xml" ? await sanitiseSvg(file) : file.slice(0, file.size, mime);
  return { blob, mime, ext: EXT[mime], fileName: safeName(file.name, `upload.${EXT[mime]}`), bytes: blob.size, ...(await dimensions(blob, mime)) };
}

/** Uploads to private-artwork/<uid>/<uuid>.<ext> and returns the object name to store in the row. */
export async function uploadPrivate(uid: string, up: PreparedUpload): Promise<string> {
  const path = `${uid}/${crypto.randomUUID()}.${up.ext}`;
  const { error } = await requireBackend().storage.from(ARTWORK_BUCKET).upload(path, up.blob, { contentType: up.mime, upsert: false, cacheControl: "3600" });
  if (error) throw /size|large/i.test(error.message) ? new BackendError("That file is larger than 25 MB.", "invalid") : toBackendError(error);
  return path;
}

/** Best-effort clean-up of an object whose database row could not be written (or was just deleted). */
export const removePrivate = (paths: string[]) =>
  paths.length ? requireBackend().storage.from(ARTWORK_BUCKET).remove(paths).then(() => {}, () => {}) : Promise.resolve();

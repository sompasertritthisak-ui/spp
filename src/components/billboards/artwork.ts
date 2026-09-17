/**
 * Client-side artwork intake for the visualiser. Nothing here touches the
 * network: the file is validated, (for SVG) sanitised, and rasterised to a
 * canvas in the visitor's browser. The ORIGINAL file is kept so it can be
 * uploaded untouched if — and only if — they submit a request.
 */
export const MAX_BYTES = 25 * 1024 * 1024;
export const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg";
export type ArtworkMime = "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";

export type Artwork = {
  file: File;
  mime: ArtworkMime;
  ext: "png" | "jpg" | "webp" | "svg";
  /** intrinsic pixel size (for SVG: its declared size / viewBox) */
  width: number;
  height: number;
  isVector: boolean;
  /** drawable, already-safe raster of the artwork */
  raster: HTMLCanvasElement;
};

export class ArtworkError extends Error {}

const EXT: Record<ArtworkMime, Artwork["ext"]> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };

/** The browser's MIME is a claim; the first bytes are evidence. Both must agree. */
function sniff(head: Uint8Array, text: string): ArtworkMime | null {
  const at = (i: number) => head[i] ?? -1;
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47 && at(4) === 0x0d && at(5) === 0x0a && at(6) === 0x1a && at(7) === 0x0a) return "image/png";
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";
  if (at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 && at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50) return "image/webp";
  const t = text.replace(/^﻿/, "").replace(/<\?xml[\s\S]*?\?>/i, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<!DOCTYPE[\s\S]*?>/i, "").trimStart();
  if (/^<svg[\s>]/i.test(t)) return "image/svg+xml";
  return null;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ArtworkError("We could not read that image. It may be damaged — try exporting it again."));
    img.src = url;
  });
}

/** SVG profile only; scripts, foreignObject, event handlers and every non-local reference are removed. */
async function sanitiseSvg(source: string): Promise<{ markup: string; width: number; height: number }> {
  const { default: createDOMPurify } = await import("dompurify");
  const purify = createDOMPurify(window);
  const embedded = /^data:image\/(png|jpe?g|webp|gif);base64,/i;
  purify.addHook("afterSanitizeAttributes", (node) => {
    for (const attr of ["href", "xlink:href", "src"]) {
      const v = node.getAttribute(attr)?.trim();
      if (v == null) continue;
      // local fragment references (gradients, <use>) and embedded bitmaps stay; anything that points elsewhere goes
      const ok = v.startsWith("#") || (node.nodeName.toLowerCase() === "image" && embedded.test(v));
      if (!ok) node.removeAttribute(attr);
    }
    const style = node.getAttribute("style");
    if (style && /url\s*\(\s*['"]?\s*(?!#)/i.test(style)) node.removeAttribute("style");
  });
  purify.addHook("uponSanitizeElement", (node) => {
    // design tools export class-based styling; keep it, minus anything that could reach outside the file
    if (node.nodeName.toLowerCase() === "style" && node.textContent) node.textContent = node.textContent.replace(/@import[^;]*;?/gi, "").replace(/url\s*\(\s*['"]?\s*(?!#)[^)]*\)/gi, "none");
  });
  const clean = purify.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["script", "foreignObject", "a", "iframe"],
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
  const doc = new DOMParser().parseFromString(clean, "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) throw new ArtworkError("That SVG could not be read safely. Export it again as a plain SVG, or send a PNG.");
  const vb = (svg.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
  const num = (v: string | null) => (v && /^[\d.]+(px)?$/.test(v.trim()) ? parseFloat(v) : NaN);
  let width = num(svg.getAttribute("width")), height = num(svg.getAttribute("height"));
  if (!(width > 0 && height > 0)) { width = vb[2] ?? NaN; height = vb[3] ?? NaN; }
  if (!(width > 0 && height > 0)) throw new ArtworkError("That SVG has no size or viewBox, so its proportions are unknown.");
  if (!svg.getAttribute("viewBox")) svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  // an <img> needs explicit dimensions to rasterise an SVG predictably across browsers
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return { markup: new XMLSerializer().serializeToString(svg), width, height };
}

const RASTER_MAX = 2400; // longest edge of the working raster — plenty for an on-screen preview

function toCanvas(img: HTMLImageElement, w: number, h: number): HTMLCanvasElement {
  const k = Math.min(1, RASTER_MAX / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const ctx = c.getContext("2d");
  if (!ctx) throw new ArtworkError("Your browser could not prepare the preview.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

export async function readArtwork(file: File): Promise<Artwork> {
  if (file.size === 0) throw new ArtworkError("That file is empty.");
  if (file.size > MAX_BYTES) throw new ArtworkError(`That file is ${(file.size / 1048576).toFixed(1)} MB. The limit is 25 MB — send larger production files to SPP directly.`);
  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const found = sniff(head, new TextDecoder("utf-8", { fatal: false }).decode(head));
  if (!found) throw new ArtworkError("Please upload a PNG, JPG, WebP or SVG file.");
  // Some systems report SVG as text/xml or leave the type blank; anything else must match its contents.
  const claimed = file.type.toLowerCase();
  const lenient = found === "image/svg+xml" && (claimed === "" || claimed === "text/xml" || claimed === "application/xml");
  if (claimed !== found && !lenient) throw new ArtworkError("That file's contents do not match its type. Please export it again as PNG, JPG, WebP or SVG.");

  if (found === "image/svg+xml") {
    const { markup, width, height } = await sanitiseSvg(await file.text());
    const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
    try {
      const img = await loadImage(url);
      // vectors are rasterised generously so the preview stays sharp when close
      const k = RASTER_MAX / Math.max(width, height);
      return { file, mime: found, ext: "svg", width, height, isVector: true, raster: toCanvas(img, width * k, height * k) };
    } finally { URL.revokeObjectURL(url); }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    if (!img.naturalWidth || !img.naturalHeight) throw new ArtworkError("We could not read that image's dimensions.");
    return { file, mime: found, ext: EXT[found], width: img.naturalWidth, height: img.naturalHeight, isVector: false, raster: toCanvas(img, img.naturalWidth, img.naturalHeight) };
  } finally { URL.revokeObjectURL(url); }
}

export type PreflightNote = { id: string; level: "ok" | "advice"; title: string; detail: string };

/** Advisory checks only — SPP's prepress review is the authority. */
export function preflight(art: Artwork, widthM: number, heightM: number): PreflightNote[] {
  const notes: PreflightNote[] = [];
  const face = widthM / heightM, mine = art.width / art.height;
  const drift = Math.abs(mine - face) / face;
  notes.push(drift > 0.05
    ? { id: "aspect", level: "advice", title: "Proportions differ from the face", detail: `Your artwork is ${mine.toFixed(2)}:1; this face is ${face.toFixed(2)}:1 (${widthM} × ${heightM} m). It will need cropping or re-laying out — a ${Math.round(drift * 100)}% difference.` }
    : { id: "aspect", level: "ok", title: "Proportions match the face", detail: `${mine.toFixed(2)}:1 against a ${face.toFixed(2)}:1 face.` });
  if (art.isVector) notes.push({ id: "res", level: "ok", title: "Vector artwork", detail: "SVG scales to any size. Embedded photos, if any, will be checked by SPP." });
  else {
    const pxPerCm = Math.min(art.width / (widthM * 100), art.height / (heightM * 100));
    notes.push(pxPerCm < 10
      ? { id: "res", level: "advice", title: "Resolution is low for this size", detail: `About ${pxPerCm.toFixed(1)} px per cm at full size. Large format usually wants 10 px/cm or more (${Math.round(widthM * 1000)} px wide here). Fine for a preview — send the full-resolution file for print.` }
      : { id: "res", level: "ok", title: "Resolution looks sufficient", detail: `About ${pxPerCm.toFixed(1)} px per cm at full size.` });
  }
  return notes;
}

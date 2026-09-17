import DOMPurify from "dompurify";

/**
 * Uploaded artwork is untrusted input. Nothing is believed from the file name
 * or the browser-reported type: the bytes decide. SVGs are sanitised and then
 * only ever drawn through an <img> (which cannot run script). The editor works
 * on a downscaled bitmap; the untouched original is kept solely for the
 * private upload to SPP.
 */
export const MAX_BYTES = 25 * 1024 * 1024;
export const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg";
export type ArtMime = "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";

export type ArtMeta = {
  mime: ArtMime;
  bytes: number;
  naturalW: number;
  naturalH: number;
  vector: boolean;
  /** pixels-per-inch recorded in the file, when present */
  dpi: number | null;
  colourSpace: "RGB" | "CMYK" | "Grey" | "unknown";
  hasAlpha: boolean;
  /** raster with no transparency and a near-uniform border → will print as a box */
  solidBackground: boolean;
};

export type LoadedArt = { file: File; name: string; meta: ArtMeta; bitmap: HTMLImageElement | HTMLCanvasElement; previewUrl: string };

export class UploadError extends Error {}

function sniff(b: Uint8Array, head: string): ArtMime | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(head)) return "image/svg+xml";
  return null;
}

function pngInfo(v: DataView) {
  let dpi: number | null = null, alpha = false, grey = false;
  const colourType = v.getUint8(25);
  alpha = colourType === 4 || colourType === 6;
  grey = colourType === 0 || colourType === 4;
  for (let o = 8; o + 12 <= v.byteLength; ) {
    const len = v.getUint32(o), type = String.fromCharCode(v.getUint8(o + 4), v.getUint8(o + 5), v.getUint8(o + 6), v.getUint8(o + 7));
    if (type === "pHYs" && v.getUint8(o + 16) === 1) dpi = Math.round(v.getUint32(o + 8) * 0.0254);
    if (type === "tRNS") alpha = true;
    if (type === "IDAT" || type === "IEND") break;
    o += 12 + len;
  }
  return { dpi, alpha, space: (grey ? "Grey" : "RGB") as ArtMeta["colourSpace"] };
}

function jpegInfo(v: DataView) {
  let dpi: number | null = null, space: ArtMeta["colourSpace"] = "unknown";
  for (let o = 2; o + 4 < v.byteLength; ) {
    if (v.getUint8(o) !== 0xff) break;
    const m = v.getUint8(o + 1), len = v.getUint16(o + 2);
    if (m === 0xe0 && len >= 14 && v.getUint32(o + 4) === 0x4a464946) {
      const unit = v.getUint8(o + 11), x = v.getUint16(o + 12);
      if (unit === 1) dpi = x; else if (unit === 2) dpi = Math.round(x * 2.54);
    }
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) {
      const n = v.getUint8(o + 9);
      space = n === 4 ? "CMYK" : n === 1 ? "Grey" : "RGB";
      break;
    }
    o += 2 + len;
  }
  return { dpi, space };
}

export function sanitiseSvg(source: string): string {
  const clean = DOMPurify.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["script", "foreignObject", "iframe", "object", "embed", "a", "use", "image", "style", "animate", "set", "animateTransform", "animateMotion"],
    FORBID_ATTR: ["href", "xlink:href", "style"],
    ALLOW_DATA_ATTR: false,
  });
  if (!/<svg[\s>]/i.test(clean)) throw new UploadError("That SVG could not be read safely. Try exporting it again as a plain SVG, or upload a PNG.");
  return clean;
}

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => res(img);
    img.onerror = () => rej(new UploadError("We could not open that image. The file may be damaged."));
    img.src = url;
  });

/** Looks at the image border: no alpha + a near-uniform edge means a solid background box. */
function inspectPixels(img: HTMLImageElement) {
  const s = 64, c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { hasAlpha: false, solidBackground: false };
  ctx.drawImage(img, 0, 0, s, s);
  const d = ctx.getImageData(0, 0, s, s).data;
  let transparent = 0, n = 0, r = 0, g = 0, b = 0, varSum = 0;
  const edge: number[][] = [];
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const i = (y * s + x) * 4;
    if (d[i + 3]! < 250) transparent++;
    if (x === 0 || y === 0 || x === s - 1 || y === s - 1) { edge.push([d[i]!, d[i + 1]!, d[i + 2]!]); r += d[i]!; g += d[i + 1]!; b += d[i + 2]!; n++; }
  }
  r /= n; g /= n; b /= n;
  for (const [er, eg, eb] of edge) varSum += Math.abs(er! - r) + Math.abs(eg! - g) + Math.abs(eb! - b);
  const hasAlpha = transparent > s * s * 0.01;
  return { hasAlpha, solidBackground: !hasAlpha && varSum / n < 18 };
}

export async function loadArtwork(file: File): Promise<LoadedArt> {
  if (file.size === 0) throw new UploadError("That file is empty.");
  if (file.size > MAX_BYTES) throw new UploadError(`That file is ${(file.size / 1048576).toFixed(1)} MB. The limit is 25 MB — for larger artwork, send it to SPP with your quote request.`);
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const head = new TextDecoder().decode(bytes.subarray(0, 2048));
  const mime = sniff(bytes, head);
  if (!mime) throw new UploadError("Please upload a PNG, JPG, WebP or SVG. For AI, PDF or EPS files, attach them to your quote request and our team will place them.");

  let blob: Blob = file, dpi: number | null = null, space: ArtMeta["colourSpace"] = "RGB", fileAlpha = false;
  if (mime === "image/svg+xml") blob = new Blob([sanitiseSvg(new TextDecoder().decode(bytes))], { type: mime });
  else if (mime === "image/png") ({ dpi, alpha: fileAlpha, space } = pngInfo(new DataView(buf)));
  else if (mime === "image/jpeg") ({ dpi, space } = jpegInfo(new DataView(buf)));

  const url = URL.createObjectURL(blob);
  const img = await loadImage(url);
  const vector = mime === "image/svg+xml";
  const naturalW = img.naturalWidth || 1000, naturalH = img.naturalHeight || 1000;
  if (naturalW > 30000 || naturalH > 30000) throw new UploadError("That image is larger than 30,000 px on one side. Please send it to SPP directly.");
  const px = vector ? { hasAlpha: true, solidBackground: false } : inspectPixels(img);

  // Editor bitmap: cap at 2000px so exports can never carry production resolution.
  let bitmap: HTMLImageElement | HTMLCanvasElement = img;
  const longest = Math.max(naturalW, naturalH);
  if (vector || longest > 2000) {
    const k = vector ? 1600 / longest : 2000 / longest;
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(naturalW * k));
    c.height = Math.max(1, Math.round(naturalH * k));
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    bitmap = c;
  }
  // Keep the (sanitised, for SVG) file as the thing that gets uploaded.
  const safeFile = vector ? new File([blob], file.name.replace(/[^\w.\- ]+/g, "_"), { type: mime }) : file;
  return { file: safeFile, name: file.name.slice(0, 120), bitmap, previewUrl: url, meta: { mime, bytes: file.size, naturalW, naturalH, vector, dpi, colourSpace: vector ? "RGB" : space, hasAlpha: px.hasAlpha || (fileAlpha && px.hasAlpha), solidBackground: px.solidBackground } };
}

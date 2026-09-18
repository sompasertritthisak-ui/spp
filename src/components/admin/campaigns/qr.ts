import QRCode from "qrcode";
import { env } from "@/lib/env";

/* QR payload: the tracked redirect page. track_qr_scan() counts the scan and
   answers with the destination, so a printed code can be re-pointed later. */
export const qrUrl = (code: string) => `${env.siteUrl}${env.basePath}/q/?c=${code}`;
export const campaignUrl = (slug: string) => `${env.siteUrl}${env.basePath}/campaigns/?c=${slug}`;
export const pointsAtLocalhost = /\/\/(localhost|127\.0\.0\.1)/.test(env.siteUrl);

// A–Z 0–9 without the look-alikes (0/O, 1/I/L) — codes get read aloud and retyped.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function randomCode(length = 8): string {
  const out: string[] = [];
  const limit = 256 - (256 % ALPHABET.length); // rejection sampling keeps the distribution uniform
  while (out.length < length) for (const b of crypto.getRandomValues(new Uint8Array(length * 2))) if (b < limit && out.length < length) out.push(ALPHABET[b % ALPHABET.length]!);
  return out.join("");
}

// Level Q survives a scuffed or partly covered print; margin 4 = the quiet zone the spec requires.
const OPTS = { errorCorrectionLevel: "Q", margin: 4, color: { dark: "#000000", light: "#ffffff" } } as const;
export const qrSvg = (code: string) => QRCode.toString(qrUrl(code), { ...OPTS, type: "svg" });
export const qrPngDataUrl = (code: string, width = 2048) => QRCode.toDataURL(qrUrl(code), { ...OPTS, width, type: "image/png" });

export function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const downloadSvg = async (code: string) => download(`spp-qr-${code}.svg`, new Blob([await qrSvg(code)], { type: "image/svg+xml" }));
export const downloadPng = async (code: string) => download(`spp-qr-${code}.png`, await (await fetch(await qrPngDataUrl(code))).blob());

export const MEDIUMS = ["billboard", "poster", "flyer", "vehicle", "packaging", "other"] as const;

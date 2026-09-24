"use client";
import { clsx } from "clsx";
import { Download, Moon, Sun, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { track } from "@/lib/backend/analytics";
import { formatDate } from "@/lib/format";
import { ACCEPT, ArtworkError, preflight, readArtwork, type Artwork } from "./artwork";
import { composeFace, distanceRange, drawScene, watermark } from "./scene";

export type VisualiserSite = { code: string; name: string; widthM: number; heightM: number; faces: 1 | 2; lit: boolean };

const ASPECT = 10 / 16;
const seg = (on: boolean) => clsx("t-label flex min-h-11 items-center gap-2 border px-3.5 text-[0.625rem] transition-colors duration-150", on ? "border-gold bg-gold text-ink-950" : "border-ink-600 text-fog-300 hover:border-gold/50 hover:text-fog-50");

/**
 * Real-world artwork visualiser. Everything happens in the browser: the file
 * is checked, drawn onto the structure in true perspective, and can be
 * exported as a watermarked PNG. Nothing is uploaded from here.
 */
export function Visualiser({ site, artwork, onArtwork }: { site: VisualiserSite; artwork: Artwork | null; onArtwork: (a: Artwork | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const [night, setNight] = useState(false);
  const [t, setT] = useState(0.18);
  const [mode, setMode] = useState<"fit" | "fill">("fit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [mono, setMono] = useState("ui-monospace, Menlo, monospace");
  const [width, setWidth] = useState(0);

  const [dMin, dMax] = useMemo(() => distanceRange(site.widthM, site.heightM), [site.widthM, site.heightM]);
  const distance = dMin * Math.pow(dMax / dMin, t); // log scale: the interesting changes happen close in
  const ready = width > 0; // canvas work waits for the browser; the server render stays a plain box
  const face = useMemo(() => (ready ? composeFace(artwork, site.widthM, site.heightM, mode, mono) : null), [artwork, site.widthM, site.heightM, mode, mono, ready]);
  const notes = useMemo(() => (artwork ? preflight(artwork, site.widthM, site.heightM) : []), [artwork, site.widthM, site.heightM]);
  const scene = useMemo(() => ({ widthM: site.widthM, heightM: site.heightM, faces: site.faces, lit: site.lit, night, distance, monoFont: mono }), [site, night, distance, mono]);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e?.contentRect.width ?? 0)));
    ro.observe(el);
    // the self-hosted mono face is exposed as a CSS variable by next/font; wait for it so canvas text matches the page
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-jetbrains").trim();
    if (family) void document.fonts.ready.then(() => setMono(`${family}, ui-monospace, monospace`));
    return () => ro.disconnect();
  }, []);

  const [share, setShare] = useState(0);
  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !face || !width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = width, H = Math.round(width * ASPECT);
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    setShare(drawScene(ctx, W, H, { ...scene, face }).faceShare);
  }, [scene, face, width]);

  const take = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      onArtwork(await readArtwork(file));
      track("artwork_uploaded", { ref: site.code, source: "billboard-visualiser" });
    } catch (e) {
      setError(e instanceof ArtworkError ? e.message : "We could not open that file. Please try a PNG, JPG, WebP or SVG.");
    } finally { setBusy(false); }
  }, [onArtwork, site.code]);

  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files[0]); };

  const download = () => {
    if (!face) return;
    const W = 1600, H = 1000;
    const out = document.createElement("canvas");
    out.width = W; out.height = H;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    drawScene(ctx, W, H, { ...scene, face });
    watermark(ctx, W, H, `SPP PREVIEW · ${site.code} · ${formatDate(new Date().toISOString())} · ILLUSTRATION ONLY — NOT A PROOF`, mono);
    out.toBlob((blob) => {
      if (!blob) return setError("Your browser could not create the preview image.");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${site.code}-preview.png`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      track("mockup_downloaded", { ref: site.code, source: "billboard-visualiser" });
    }, "image/png");
  };

  const letterCm = Math.max(5, Math.round(distance / 3.6 / 5) * 5);

  return (
    <div className="grid gap-px border border-gold/40 bg-gold/40 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="bg-ink-950">
        <div ref={frame} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop} className="relative">
          <canvas ref={canvas} role="img" aria-label={`Illustration of the ${site.widthM} by ${site.heightM} metre billboard ${site.code}${artwork ? " with your artwork applied" : ""}, seen from ${Math.round(distance)} metres by ${night ? "night" : "day"}.`} className="block w-full" style={{ aspectRatio: "16 / 10" }} />
          {!width && <div aria-hidden className="skeleton absolute inset-0" />}
          {over && <div aria-hidden className="t-label pointer-events-none absolute inset-3 flex items-center justify-center border border-dashed border-gold bg-ink-950/80 text-gold">Drop artwork to place it on the face</div>}
          {night && !site.lit && <p className="t-label absolute left-4 top-4 max-w-[80%] border border-ink-600 bg-ink-950/90 px-3 py-2 text-[0.625rem] leading-relaxed text-fog-100">This site is not illuminated — artwork is not visible after dark.</p>}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-gold/25 p-4 sm:p-5">
          <div role="group" aria-label="Time of day" className="flex">
            <button type="button" aria-pressed={!night} onClick={() => setNight(false)} className={seg(!night)}><Sun aria-hidden size={14} strokeWidth={1.5} />Day</button>
            <button type="button" aria-pressed={night} onClick={() => setNight(true)} className={clsx(seg(night), "-ml-px")}><Moon aria-hidden size={14} strokeWidth={1.5} />Night</button>
          </div>
          <label className="flex min-w-[14rem] flex-1 flex-col gap-2">
            <span className="t-label flex justify-between text-[0.625rem] text-fog-400"><span>Pedestrian</span><span className="t-data text-gold">{Math.round(distance)} m away</span><span>Driver</span></span>
            <input type="range" min={0} max={1} step={0.005} value={t} onChange={(e) => setT(Number(e.target.value))} aria-label="Viewing distance" aria-valuetext={`${Math.round(distance)} metres`} className="h-11 w-full accent-gold" />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-6 bg-ink-900 p-5 sm:p-6">
        <div>
          <p className="t-label mb-3 text-fog-400">Your artwork</p>
          {artwork ? (
            <div className="flex items-start justify-between gap-3 border border-gold/40 p-3">
              <div className="min-w-0"><p className="truncate text-sm text-fog-50">{artwork.file.name}</p><p className="t-data mt-1 text-xs text-fog-400">{artwork.isVector ? "Vector" : `${artwork.width} × ${artwork.height} px`} · {(artwork.file.size / 1048576).toFixed(1)} MB</p></div>
              <button type="button" onClick={() => { onArtwork(null); setError(null); }} aria-label="Remove artwork" className="-m-1 flex h-11 w-11 flex-none items-center justify-center text-fog-400 hover:text-danger"><Trash2 aria-hidden size={16} strokeWidth={1.5} /></button>
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-fog-400">PNG, JPG, WebP or SVG, up to 25 MB. The file stays on your device — nothing is sent to SPP unless you submit a request.</p>
          )}
          <input id={inputId} type="file" accept={ACCEPT} className="peer sr-only" disabled={busy} onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ""; }} />
          <label htmlFor={inputId} className={clsx("t-label mt-3 flex min-h-11 w-full items-center justify-center gap-2.5 border px-4 text-xs transition-colors duration-150 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold", artwork ? "border-gold/60 text-fog-50 hover:border-gold hover:text-gold" : "border-gold bg-gold text-ink-950 hover:bg-fog-50", busy && "pointer-events-none opacity-50")}>
            <Upload aria-hidden size={15} strokeWidth={1.5} />{busy ? "Reading…" : artwork ? "Replace artwork" : "Upload artwork"}
          </label>
          <div className="mt-3" aria-live="polite"><FormError message={error} /></div>
          {artwork && (
            <div role="group" aria-label="How the artwork fills the face" className="mt-3 flex">
              <button type="button" aria-pressed={mode === "fit"} onClick={() => setMode("fit")} className={clsx(seg(mode === "fit"), "flex-1 justify-center")}>Fit whole</button>
              <button type="button" aria-pressed={mode === "fill"} onClick={() => setMode("fill")} className={clsx(seg(mode === "fill"), "-ml-px flex-1 justify-center")}>Fill &amp; crop</button>
            </div>
          )}
        </div>

        {notes.length > 0 && (
          <div aria-live="polite">
            <p className="t-label mb-3 text-fog-400">Preflight</p>
            <ul className="flex flex-col gap-3">
              {notes.map((n) => (
                <li key={n.id} className={clsx("border-l pl-3", n.level === "ok" ? "border-ok/60" : "border-warn/70")}>
                  <p className="text-sm font-medium text-fog-50"><span className={clsx("t-label mr-2 text-[0.5625rem]", n.level === "ok" ? "text-ok" : "text-warn")}>{n.level === "ok" ? "OK" : "Advisory"}</span>{n.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-fog-400">{n.detail}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-fog-500">Automated preflight checks are advisory. Final production approval is subject to SPP review.</p>
          </div>
        )}

        <div>
          <p className="t-label mb-3 text-fog-400">Reading it from {Math.round(distance)} m</p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
            <dt className="text-fog-400">Face fills</dt><dd className="t-data text-right text-gold">{Math.round(share * 100)}% of the view</dd>
            <dt className="text-fog-400">Lettering to be readable</dt><dd className="t-data text-right text-gold">≈ {letterCm} cm tall +</dd>
            <dt className="text-fog-400">Drive-by at 50 km/h</dt><dd className="t-data text-right text-gold">≈ {Math.max(1, Math.round(distance / 13.9))} s to read</dd>
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-fog-500">Rule-of-thumb guidance (about 1 cm of letter height per 3.6 m). Few words, large type, strong contrast.</p>
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <Button variant="outline" onClick={download} disabled={!face}><span className="inline-flex items-center gap-2.5"><Download aria-hidden size={15} strokeWidth={1.5} />Download preview</span></Button>
          <p className="text-xs leading-relaxed text-fog-500">Exports a watermarked PNG. The structure is an illustration built to this face&rsquo;s real size — not a photograph of the site.</p>
        </div>
      </div>
    </div>
  );
}

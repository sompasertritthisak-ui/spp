"use client";
import { clsx } from "clsx";
import { useId, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/backend/auth";
import type { MediaRow } from "@/lib/backend/db-types";
import { titleCase } from "@/lib/format";
import { messageOf } from "../resource/errors";
import { inputCls } from "../resource/fields";
import { ACCEPT_ALL, ACCEPT_IMAGES, MEDIA_CATEGORIES, uploadMedia } from "./lib";

/** Drop zone + file input. Uploads one file at a time so a failure is attributable. */
export function Uploader({ onUploaded, imagesOnly = false, defaultCategory = "general", compact = false }: { onUploaded: (rows: MediaRow[]) => void; imagesOnly?: boolean; defaultCategory?: string; compact?: boolean }) {
  const { user } = useAuth();
  const toast = useToast();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState(defaultCategory);
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const run = async (files: File[]) => {
    if (!files.length || progress) return;
    setErrors([]);
    setProgress({ done: 0, total: files.length });
    const ok: MediaRow[] = [];
    const bad: string[] = [];
    for (const [i, f] of files.entries()) {
      try {
        if (imagesOnly && !f.type.startsWith("image/")) throw new Error(`${f.name}: choose an image file here.`);
        ok.push(await uploadMedia(f, { category, userId: user?.id ?? null }));
      } catch (e) { bad.push(messageOf(e)); }
      setProgress({ done: i + 1, total: files.length });
    }
    setProgress(null);
    setErrors(bad);
    if (ok.length) { toast(`${ok.length} file${ok.length > 1 ? "s" : ""} uploaded. Add alt text so they are accessible.`, "ok"); onUploaded(ok); }
    if (bad.length && !ok.length) toast("Upload failed — see the details above the library.", "danger");
    if (input.current) input.current.value = "";
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void run(Array.from(e.dataTransfer.files)); }}
        className={clsx("flex flex-wrap items-center gap-3 border border-dashed px-4 transition-colors", compact ? "py-3" : "py-5", over ? "border-yellow bg-yellow/5" : "border-ink-600")}
      >
        <input ref={input} id={id} type="file" multiple accept={imagesOnly ? ACCEPT_IMAGES : ACCEPT_ALL} className="sr-only" onChange={(e) => void run(Array.from(e.target.files ?? []))} />
        <label htmlFor={id} className={clsx("t-label flex min-h-11 cursor-pointer items-center border border-ink-500 px-4 text-fog-50 hover:border-yellow hover:text-yellow focus-within:border-yellow", progress && "pointer-events-none opacity-50")}>{progress ? `Uploading ${progress.done}/${progress.total}…` : "Choose files"}</label>
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-fog-500">…or drop them here. {imagesOnly ? "PNG, JPEG, WebP, AVIF or SVG" : "PNG, JPEG, WebP, AVIF, SVG, MP4 or PDF"}, up to 10 MB each. SVGs are sanitised: scripts, embedded styles and remote links are removed.</p>
        <label className="flex items-center gap-2 text-xs text-fog-400"><span className="t-label">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={clsx(inputCls, "min-h-10 w-auto pr-8")}>{MEDIA_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select>
        </label>
      </div>
      <div aria-live="polite">{errors.length > 0 && <ul className="mt-2 border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-fog-50">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}</div>
    </div>
  );
}

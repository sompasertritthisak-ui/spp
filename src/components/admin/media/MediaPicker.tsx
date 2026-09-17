"use client";
import { clsx } from "clsx";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { backend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import type { MediaRow } from "@/lib/backend/db-types";
import { titleCase } from "@/lib/format";
import { Modal } from "../resource/Confirm";
import { inputCls } from "../resource/fields";
import { isImage, mediaUrl, MEDIA_CATEGORIES } from "./lib";
import { Uploader } from "./Uploader";

export function MediaThumb({ media, className }: { media: Pick<MediaRow, "path" | "mime" | "alt" | "file_name">; className?: string }) {
  if (isImage(media))
    // eslint-disable-next-line @next/next/no-img-element -- static export: no image optimiser; this is the staff library
    return <img src={mediaUrl(media.path)} alt={media.alt} loading="lazy" decoding="async" className={clsx("bg-ink-950 object-contain", className)} />;
  return <span className={clsx("t-label flex items-center justify-center bg-ink-950 text-fog-400", className)}>{media.mime === "video/mp4" ? "MP4 video" : media.mime === "application/pdf" ? "PDF" : "File"}</span>;
}

/** Library dialog used by every editor. `multiple` returns several rows in the order they were ticked. */
export function MediaPicker({ open, onClose, onPick, multiple = false, imagesOnly = true, category }: { open: boolean; onClose: () => void; onPick: (rows: MediaRow[]) => void; multiple?: boolean; imagesOnly?: boolean; category?: string }) {
  return <Modal open={open} onClose={onClose} title={multiple ? "Choose media" : "Choose a file"} wide>{open && <PickerBody onClose={onClose} onPick={onPick} multiple={multiple} imagesOnly={imagesOnly} category={category} />}</Modal>;
}

function PickerBody({ onClose, onPick, multiple, imagesOnly, category }: { onClose: () => void; onPick: (rows: MediaRow[]) => void; multiple: boolean; imagesOnly: boolean; category?: string }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [picked, setPicked] = useState<string[]>([]);
  const list = useQuery<MediaRow[]>(() => backend()!.from("media").select("*").eq("bucket", "public-media").order("created_at", { ascending: false }).limit(600), []);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (list.data ?? []).filter((m) => (!imagesOnly || isImage(m)) && (cat === "all" || m.category === cat) && (!t || `${m.file_name} ${m.alt} ${m.tags.join(" ")}`.toLowerCase().includes(t)));
  }, [list.data, q, cat, imagesOnly]);
  const choose = (m: MediaRow) => { if (!multiple) { onPick([m]); onClose(); } else setPicked((p) => (p.includes(m.id) ? p.filter((x) => x !== m.id) : [...p, m.id])); };
  const confirm = () => { const by = new Map((list.data ?? []).map((m) => [m.id, m])); onPick(picked.flatMap((id) => by.get(id) ?? [])); onClose(); };

  return (
    <div className="flex flex-col gap-4">
      <Uploader compact imagesOnly={imagesOnly} defaultCategory={category ?? "general"} onUploaded={(up) => { void list.reload(); if (!multiple && up[0]) { onPick([up[0]]); onClose(); } else setPicked((p) => [...p, ...up.map((u) => u.id)]); }} />
      <div className="flex flex-wrap gap-2">
        <input type="search" aria-label="Search media" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search file name, alt text or tag…" className={clsx(inputCls, "min-w-0 flex-1")} />
        <select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)} className={clsx(inputCls, "w-auto")}><option value="all">All categories</option>{MEDIA_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select>
      </div>
      {list.error && <p role="alert" className="text-sm text-danger">{list.error}</p>}
      {list.loading && !list.data && <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{Array.from({ length: 10 }, (_, i) => <div key={i} className="skeleton aspect-square" />)}</div>}
      {list.data && rows.length === 0 && <p className="border border-dashed border-ink-600 px-4 py-8 text-center text-sm text-fog-500">{list.data.length ? "Nothing matches that search." : "The library is empty. Upload the first file above."}</p>}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {rows.map((m) => {
          const n = picked.indexOf(m.id);
          return (
            <li key={m.id}>
              <button type="button" onClick={() => choose(m)} aria-pressed={multiple ? n >= 0 : undefined} title={m.file_name} className={clsx("group relative block w-full border text-left transition-colors", n >= 0 ? "border-yellow" : "border-ink-700 hover:border-ink-500")}>
                <MediaThumb media={m} className="aspect-square w-full" />
                <span className="block truncate px-1.5 py-1 text-[0.6875rem] text-fog-400">{m.alt || m.file_name}</span>
                {n >= 0 && <span className="t-data absolute left-0 top-0 flex h-6 min-w-6 items-center justify-center bg-yellow px-1 text-xs font-semibold text-ink-950">{n + 1}</span>}
                {!m.alt && isImage(m) && <span className="t-label absolute right-0 top-0 bg-warn px-1 py-0.5 text-[0.5625rem] text-ink-950">No alt</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {multiple && <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-between gap-3 border-t border-ink-700 bg-ink-900 px-6 py-3"><p className="text-sm text-fog-400">{picked.length} selected</p><Button size="sm" disabled={!picked.length} onClick={confirm}>Add selected</Button></div>}
    </div>
  );
}

"use client";
import { useId, useMemo, useState } from "react";
import { backend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import type { MediaRow } from "@/lib/backend/db-types";
import { FieldShell, type FieldProps } from "../resource/fields";
import { MediaPicker, MediaThumb } from "./MediaPicker";

/** Resolves media ids to rows (RLS: public-media rows are readable by everyone). */
export function useMediaByIds(ids: string[]) {
  const key = [...ids].sort().join(",");
  const q = useQuery<MediaRow[]>(() => (key ? backend()!.from("media").select("*").in("id", key.split(",")) : Promise.resolve([] as MediaRow[])), [key]);
  return useMemo(() => new Map((q.data ?? []).map((m) => [m.id, m])), [q.data]);
}

const btn = "t-label min-h-10 border border-ink-600 px-3 text-fog-300 hover:border-yellow hover:text-yellow disabled:opacity-40";

/** Single media reference (stores the media id). */
export function MediaField({ value, onChange, imagesOnly = true, category, ...p }: FieldProps & { value: string | null; onChange: (id: string | null) => void; imagesOnly?: boolean; category?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<MediaRow | null>(null);
  const byId = useMediaByIds(value && local?.id !== value ? [value] : []);
  const media = value ? (local?.id === value ? local : byId.get(value) ?? null) : null;
  return (
    <FieldShell id={id} as="legend" {...p}>
      <div role="group" aria-labelledby={`${id}-lbl`} className="flex items-center gap-3 border border-ink-600 bg-ink-950 p-2">
        {media ? <MediaThumb media={media} className="h-20 w-20 flex-none" /> : <span className="t-label flex h-20 w-20 flex-none items-center justify-center border border-dashed border-ink-600 text-[0.625rem] text-fog-500">{value ? "…" : "None"}</span>}
        <div className="min-w-0 flex-1">
          {media && <p className="truncate text-sm text-fog-100">{media.file_name}</p>}
          {media && !media.alt && <p className="text-xs text-warn">Missing alt text — add it in the Media library.</p>}
          {media?.alt && <p className="truncate text-xs text-fog-500">Alt: {media.alt}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={p.disabled} onClick={() => setOpen(true)} className={btn}>{value ? "Replace" : "Choose"}</button>
            {value && <button type="button" disabled={p.disabled} onClick={() => onChange(null)} className={btn}>Remove</button>}
          </div>
        </div>
      </div>
      <MediaPicker open={open} onClose={() => setOpen(false)} imagesOnly={imagesOnly} category={category} onPick={(rows) => { const m = rows[0]; if (m) { setLocal(m); onChange(m.id); } }} />
    </FieldShell>
  );
}

/** Ordered gallery (stores media ids; the first is shown first on the site). */
export function MediaListField({ value, onChange, category, max = 24, ...p }: FieldProps & { value: string[]; onChange: (ids: string[]) => void; category?: string; max?: number }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const byId = useMediaByIds(value);
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= value.length) return; const n = [...value]; [n[i], n[j]] = [n[j]!, n[i]!]; onChange(n); };
  return (
    <FieldShell id={id} as="legend" {...p}>
      <div role="group" aria-labelledby={`${id}-lbl`}>
        {value.length > 0 && (
          <ol className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {value.map((mid, i) => {
              const m = byId.get(mid);
              return (
                <li key={mid} className="border border-ink-700 bg-ink-950">
                  {m ? <MediaThumb media={m} className="aspect-square w-full" /> : <div className="skeleton aspect-square w-full" />}
                  <div className="flex items-center justify-between border-t border-ink-700">
                    <button type="button" disabled={p.disabled || i === 0} onClick={() => move(i, -1)} aria-label={`Move image ${i + 1} earlier`} className="h-9 flex-1 text-fog-400 hover:text-fog-50 disabled:opacity-30">←</button>
                    <span className="t-data text-xs text-fog-500">{i + 1}</span>
                    <button type="button" disabled={p.disabled || i === value.length - 1} onClick={() => move(i, 1)} aria-label={`Move image ${i + 1} later`} className="h-9 flex-1 text-fog-400 hover:text-fog-50 disabled:opacity-30">→</button>
                    <button type="button" disabled={p.disabled} onClick={() => onChange(value.filter((x) => x !== mid))} aria-label={`Remove image ${i + 1}`} className="h-9 flex-1 border-l border-ink-700 text-fog-400 hover:text-danger">×</button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <button type="button" disabled={p.disabled || value.length >= max} onClick={() => setOpen(true)} className={btn}>+ Add images</button>
      </div>
      <MediaPicker open={open} onClose={() => setOpen(false)} multiple category={category} onPick={(rows) => onChange([...value, ...rows.map((r) => r.id).filter((x) => !value.includes(x))].slice(0, max))} />
    </FieldShell>
  );
}

"use client";
import { clsx } from "clsx";
import { env } from "@/lib/env";
import { AreaField, TextField } from "./fields";

export type Seo = { title?: string; description?: string };
export const asSeo = (v: unknown): Seo => (v && typeof v === "object" && !Array.isArray(v) ? (v as Seo) : {});

const Count = ({ n, ideal }: { n: number; ideal: [number, number] }) => <span className={clsx("t-data", n === 0 ? "text-fog-500" : n < ideal[0] || n > ideal[1] ? "text-warn" : "text-ok")}>{n} / {ideal[0]}–{ideal[1]}</span>;

/** How the page is likely to appear in a search result. Falls back to the record's own title/summary. */
export function SeoSnippet({ title, description, path }: { title: string; description: string; path: string }) {
  const host = env.siteUrl.replace(/^https?:\/\//, "");
  return (
    <div className="border border-ink-700 bg-ink-950 p-4" aria-label="Search result preview">
      <p className="t-label mb-2 text-[0.625rem] text-fog-500">Search preview</p>
      <p className="truncate text-xs text-fog-400">{host}{env.basePath}{path}</p>
      <p className="mt-1 line-clamp-1 text-lg leading-snug text-sky">{title || "Untitled"}</p>
      <p className="mt-1 line-clamp-2 text-sm leading-snug text-fog-300">{description || "No description yet — search engines will pick their own excerpt."}</p>
    </div>
  );
}

/** SEO {title, description} editor with counters and a live snippet. Stores only non-empty keys. */
export function SeoField({ value, onChange, fallbackTitle, fallbackDescription, path, disabled }: { value: Seo; onChange: (v: Seo) => void; fallbackTitle: string; fallbackDescription: string; path: string; disabled?: boolean }) {
  const set = (k: keyof Seo, v: string) => { const next = { ...value, [k]: v }; if (!v.trim()) delete next[k]; onChange(next); };
  const title = value.title ?? "";
  const description = value.description ?? "";
  return (
    <div className="grid gap-4">
      <TextField label="SEO title" disabled={disabled} value={title} onChange={(v) => set("title", v)} maxLength={80} placeholder={fallbackTitle} hint={<>Leave empty to use the name. <Count n={title.length} ideal={[30, 60]} /></>} />
      <AreaField label="Meta description" disabled={disabled} rows={3} value={description} onChange={(v) => set("description", v)} placeholder={fallbackDescription} hint={<>Write for the person searching, not for keywords. <Count n={description.length} ideal={[70, 160]} /></>} />
      <SeoSnippet title={title || fallbackTitle} description={description || fallbackDescription} path={path} />
    </div>
  );
}

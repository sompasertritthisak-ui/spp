"use client";
import { clsx } from "clsx";
import { useMemo, useState } from "react";
import { canDo, useAuth } from "@/lib/backend/auth";
import type { MediaRow } from "@/lib/backend/db-types";
import { formatDate, titleCase } from "@/lib/format";
import { inputCls } from "../resource/fields";
import { useResource } from "../resource/useResource";
import { useSelection } from "../resource/useSelection";
import { DataTable, ErrorNote, Panel, Stat } from "../ui";
import { formatBytes, isImage, MEDIA_CATEGORIES } from "./lib";
import { MediaDetail } from "./MediaDetail";
import { MediaThumb } from "./MediaPicker";
import { Uploader } from "./Uploader";

const kindOf = (m: MediaRow) => (isImage(m) ? "image" : m.mime === "video/mp4" ? "video" : "pdf");

/** Media library. Selection lives in `?media=<id>` so usage links can point straight at a file. */
export function MediaLibrary() {
  const { profile } = useAuth();
  const canEdit = ["content", "catalogue", "billboards"].some((c) => canDo(profile?.role, c));
  const canDelete = canDo(profile?.role, "content"); // storage delete policy: can('content') only
  const res = useResource("media", { order: [{ column: "created_at", ascending: false }], singular: "File" });
  const sel = useSelection("media", "newmedia");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [kind, setKind] = useState("all");
  const [tag, setTag] = useState("all");
  const [noAlt, setNoAlt] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");

  const all = useMemo(() => (res.rows ?? []).filter((m) => m.bucket === "public-media"), [res.rows]);
  const tags = useMemo(() => [...new Set(all.flatMap((m) => m.tags))].sort(), [all]);
  const missingAlt = useMemo(() => all.filter((m) => isImage(m) && !m.alt.trim()).length, [all]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all.filter((m) => (cat === "all" || m.category === cat) && (kind === "all" || kindOf(m) === kind) && (tag === "all" || m.tags.includes(tag)) && (!noAlt || (isImage(m) && !m.alt.trim())) && (!t || `${m.file_name} ${m.alt} ${m.tags.join(" ")}`.toLowerCase().includes(t)));
  }, [all, q, cat, kind, tag, noAlt]);
  const selected = sel.id ? all.find((m) => m.id === sel.id) ?? null : null;
  const select = clsx(inputCls, "w-auto pr-8");

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Missing alt text" value={res.rows ? missingAlt : "—"} tone={missingAlt ? "danger" : "ok"} hint={missingAlt ? "Images without a description" : "Every image is described"} />
        <Stat label="Files" value={res.rows ? all.length : "—"} />
        <Stat label="Images" value={res.rows ? all.filter(isImage).length : "—"} />
        <Stat label="Storage used" value={res.rows ? formatBytes(all.reduce((n, m) => n + m.bytes, 0)) : "—"} />
      </div>
      {canEdit && <div className="mb-4"><Uploader onUploaded={(rows) => { res.setRows((rs) => [...rows, ...(rs ?? []).filter((r) => !rows.some((n) => n.id === r.id))]); if (rows.length === 1 && rows[0]) sel.open(rows[0].id); }} /></div>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search media" placeholder="Search file name, alt text or tag…" className={clsx(inputCls, "min-w-0 flex-1 basis-full sm:basis-auto")} />
        <select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)} className={select}><option value="all">All categories</option>{MEDIA_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select>
        <select aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value)} className={select}><option value="all">All types</option><option value="image">Images</option><option value="video">Video</option><option value="pdf">PDF</option></select>
        {tags.length > 0 && <select aria-label="Tag" value={tag} onChange={(e) => setTag(e.target.value)} className={select}><option value="all">All tags</option>{tags.map((t) => <option key={t} value={t}>{t}</option>)}</select>}
        <button type="button" aria-pressed={noAlt} onClick={() => setNoAlt((v) => !v)} className={clsx("t-label min-h-11 border px-3", noAlt ? "border-warn text-warn" : "border-ink-600 text-fog-400 hover:text-fog-50")}>Missing alt</button>
        <div role="group" aria-label="View" className="ml-auto flex">{(["grid", "list"] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={clsx("t-label min-h-11 border px-3", view === v ? "border-yellow text-fog-50" : "border-ink-600 text-fog-500 hover:text-fog-50")}>{v}</button>)}</div>
      </div>
      <ErrorNote message={res.error} onRetry={() => void res.reload()} />

      {view === "grid" ? (
        <>
          {res.loading && !res.rows && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">{Array.from({ length: 12 }, (_, i) => <div key={i} className="skeleton aspect-square" />)}</div>}
          {res.rows && shown.length === 0 && <p className="border border-dashed border-ink-600 px-4 py-12 text-center text-sm text-fog-500">{all.length ? "Nothing matches those filters." : "The library is empty. Upload the first file above."}</p>}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
            {shown.map((m) => (
              <li key={m.id}>
                <button type="button" disabled={m.id.startsWith("tmp-")} onClick={() => sel.open(m.id)} className="group relative block w-full border border-ink-700 bg-ink-900 text-left hover:border-ink-500">
                  <MediaThumb media={m} className="aspect-square w-full" />
                  <span className="block truncate border-t border-ink-700 px-2 py-1.5 text-xs text-fog-300">{m.file_name}</span>
                  {isImage(m) && !m.alt.trim() && <span className="t-label absolute right-0 top-0 bg-warn px-1.5 py-0.5 text-[0.5625rem] text-ink-950">No alt</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Panel flush>
          <DataTable caption="Media files" rows={res.error ? [] : shown} loading={res.loading} rowKey={(m) => m.id} onRowClick={(m) => !m.id.startsWith("tmp-") && sel.open(m.id)} empty={all.length ? "Nothing matches those filters." : "The library is empty."}
            columns={[
              { key: "thumb", header: "", className: "w-16", cell: (m) => <MediaThumb media={m} className="h-10 w-10" /> },
              { key: "name", header: "File", cell: (m) => <span className="block max-w-xs"><span className="block truncate text-fog-50">{m.file_name}</span><span className={clsx("block truncate text-xs", m.alt ? "text-fog-500" : isImage(m) ? "text-warn" : "text-fog-500")}>{m.alt || (isImage(m) ? "Missing alt text" : m.mime)}</span></span> },
              { key: "cat", header: "Category", hideBelow: "sm", cell: (m) => <span className="t-label text-fog-400">{m.category}</span> },
              { key: "size", header: "Size", hideBelow: "md", cell: (m) => <span className="t-data text-fog-400">{formatBytes(m.bytes)}{m.width && m.height ? ` · ${m.width}×${m.height}` : ""}</span> },
              { key: "date", header: "Uploaded", hideBelow: "lg", cell: (m) => <span className="t-data text-fog-400">{formatDate(m.created_at)}</span> },
            ]} />
        </Panel>
      )}
      {selected && <MediaDetail key={selected.id} media={selected} canEdit={canEdit} canDelete={canDelete} saving={res.saving} update={res.update} remove={res.remove} onClose={sel.close} />}
    </div>
  );
}

"use client";
import { clsx } from "clsx";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { PageSectionsRow } from "@/lib/backend/db-types";
import { Modal, useConfirm } from "../../resource/Confirm";
import type { Values } from "../../resource/types";
import { useResource } from "../../resource/useResource";
import { ErrorNote, Panel } from "../../ui";
import { blankSection, describeSection, SECTION_KINDS, SECTION_META, validateSection, type SectionKind } from "../section-kinds";
import { PagePreview } from "./PagePreview";
import { SectionDrawer } from "./SectionDrawer";

const asKind = (k: string): SectionKind => (SECTION_KINDS as readonly string[]).includes(k) ? (k as SectionKind) : "text";
const asProps = (p: unknown): Values => (p && typeof p === "object" && !Array.isArray(p) ? (p as Values) : {});

/** The section stack of one page: add, edit, duplicate, delete, reorder (drag handle or ↑ ↓). Every change saves immediately. */
export function SectionList({ pageId, pageTitle, canWrite, onChanged }: { pageId: string; pageTitle: string; canWrite: boolean; onChanged: () => void }) {
  const res = useResource("page_sections", { order: [{ column: "sort" }], singular: "Section", filter: { column: "page_id", value: pageId } });
  const sections = useMemo(() => [...(res.rows ?? [])].sort((a, b) => a.sort - b.sort), [res.rows]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);
  const [confirm, confirmUi] = useConfirm();

  const reorder = async (from: number, to: number) => {
    if (from === to || to < 0 || to >= sections.length) return;
    const next = [...sections];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    const changed = next.map((s, i) => ({ s, sort: i + 1 })).filter(({ s, sort }) => s.sort !== sort);
    const results = await Promise.all(changed.map(({ s, sort }) => res.update(s.id, { sort }, { quiet: true })));
    if (results.some((r) => !r)) void res.reload(); else onChanged();
  };
  const add = async (kind: SectionKind) => {
    setAdding(false);
    const made = await res.create({ page_id: pageId, kind, props: blankSection(kind), sort: (sections.at(-1)?.sort ?? 0) + 1 }, { quiet: true });
    if (made) { setEditing(made.id); onChanged(); }
  };
  const duplicate = async (s: PageSectionsRow) => {
    // open a gap right after the original, then insert the copy into it
    await Promise.all(sections.filter((x) => x.sort > s.sort).map((x) => res.update(x.id, { sort: x.sort + 1 }, { quiet: true })));
    if (await res.create({ page_id: pageId, kind: s.kind, props: s.props, sort: s.sort + 1 })) onChanged();
  };
  const del = async (s: PageSectionsRow) => {
    const kind = asKind(s.kind);
    if (!(await confirm({ title: `Delete this ${SECTION_META[kind].label.toLowerCase()} section?`, body: <>“{describeSection(kind, asProps(s.props))}” will be removed from the page. This cannot be undone.</>, confirmLabel: "Delete section", danger: true }))) return;
    if (await res.remove(s.id)) onChanged();
  };

  const current = editing ? sections.find((s) => s.id === editing) ?? null : null;
  const invalid = sections.filter((s) => !validateSection(asKind(s.kind), s.props).ok).length;

  return (
    <Panel title={`Sections${res.rows ? ` · ${sections.length}` : ""}`} action={<span className="flex gap-2"><Button variant="ghost" size="sm" disabled={!sections.length} onClick={() => setPreview(true)}>Preview</Button>{canWrite && <Button size="sm" onClick={() => setAdding(true)}>Add section</Button>}</span>}>
      <ErrorNote message={res.error} onRetry={() => void res.reload()} />
      {invalid > 0 && <p role="status" className="mb-3 border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-fog-50">{invalid} section{invalid > 1 ? "s are" : " is"} incomplete and will be skipped on the site until fixed.</p>}
      {res.loading && !res.rows && <div className="grid gap-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-16" />)}</div>}
      {res.rows && sections.length === 0 && <EmptyState title="An empty page." body="Add a first section — most pages open with a Hero and close with a Call to action." action={canWrite ? <Button size="sm" onClick={() => setAdding(true)}>Add section</Button> : undefined} />}
      <ol className="grid gap-2">
        {sections.map((s, i) => {
          const kind = asKind(s.kind);
          const ok = validateSection(kind, s.props).ok;
          const tmp = s.id.startsWith("tmp-");
          return (
            <li key={s.id}
              onDragOver={(e) => { if (drag) { e.preventDefault(); if (drag.over !== i) setDrag({ ...drag, over: i }); } }}
              onDrop={(e) => { e.preventDefault(); if (drag) void reorder(drag.from, i); setDrag(null); }}
              className={clsx("flex items-stretch border bg-ink-950 transition-colors", drag?.over === i && drag.from !== i ? "border-yellow" : "border-ink-700", drag?.from === i && "opacity-50")}>
              {canWrite && <span draggable={!tmp} onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", s.id); setDrag({ from: i, over: i }); }} onDragEnd={() => setDrag(null)} aria-hidden title="Drag to reorder" className="hidden w-8 flex-none cursor-grab items-center justify-center border-r border-ink-700 text-fog-500 hover:text-fog-50 active:cursor-grabbing sm:flex">⋮⋮</span>}
              <button type="button" disabled={tmp} onClick={() => setEditing(s.id)} className="min-w-0 flex-1 px-3 py-2.5 text-left hover:bg-ink-850">
                <span className="flex items-center gap-2"><span className="t-data text-xs text-fog-500">{String(i + 1).padStart(2, "0")}</span><span className="t-label text-fog-300">{SECTION_META[kind].label}</span>{!ok && <span className="t-label text-[0.625rem] text-warn">Incomplete</span>}</span>
                <span className="mt-0.5 block truncate text-sm text-fog-100">{describeSection(kind, asProps(s.props))}</span>
              </button>
              {canWrite && (
                <span className="flex flex-none items-center border-l border-ink-700">
                  <button type="button" disabled={i === 0 || tmp} onClick={() => void reorder(i, i - 1)} aria-label={`Move section ${i + 1} up`} className="h-11 w-9 text-fog-400 hover:text-yellow disabled:opacity-30">↑</button>
                  <button type="button" disabled={i === sections.length - 1 || tmp} onClick={() => void reorder(i, i + 1)} aria-label={`Move section ${i + 1} down`} className="h-11 w-9 text-fog-400 hover:text-yellow disabled:opacity-30">↓</button>
                  <button type="button" disabled={tmp} onClick={() => void duplicate(s)} aria-label={`Duplicate section ${i + 1}`} title="Duplicate" className="t-label hidden h-11 px-2 text-[0.625rem] text-fog-400 hover:text-yellow sm:block">Copy</button>
                  <button type="button" disabled={tmp} onClick={() => void del(s)} aria-label={`Delete section ${i + 1}`} className="h-11 w-9 text-fog-400 hover:text-danger">×</button>
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a section" wide>
        <ul className="grid gap-2 sm:grid-cols-2">
          {SECTION_KINDS.map((k) => <li key={k}><button type="button" onClick={() => void add(k)} className="block h-full w-full border border-ink-700 p-3 text-left hover:border-yellow"><span className="t-label block text-fog-50">{SECTION_META[k].label}</span><span className="mt-1 block text-sm leading-snug text-fog-400">{SECTION_META[k].blurb}</span></button></li>)}
        </ul>
      </Modal>
      {current && <SectionDrawer key={current.id} section={current} kind={asKind(current.kind)} canWrite={canWrite} saving={res.saving} onClose={() => setEditing(null)} onDuplicate={() => { setEditing(null); void duplicate(current); }}
        onSave={async (props) => { const r = await res.update(current.id, { props }, { message: "Section saved." }); if (r) { onChanged(); setEditing(null); } }} />}
      <Modal open={preview} onClose={() => setPreview(false)} title={`Preview · ${pageTitle}`} wide>{preview && <PagePreview sections={sections} />}</Modal>
      {confirmUi}
    </Panel>
  );
}

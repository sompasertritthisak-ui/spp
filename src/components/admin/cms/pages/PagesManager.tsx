"use client";
import { clsx } from "clsx";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { canDo, useAuth } from "@/lib/backend/auth";
import { backend } from "@/lib/backend/client";
import type { PagesRow, PageSectionsRow } from "@/lib/backend/db-types";
import { relativeTime } from "@/lib/format";
import { Modal } from "../../resource/Confirm";
import { adminError } from "../../resource/errors";
import { inputCls, TextField } from "../../resource/fields";
import { SlugField } from "../../resource/pickers";
import { displayStatus, SLUG_RE, slugify } from "../../resource/status";
import { useResource } from "../../resource/useResource";
import { useSelection } from "../../resource/useSelection";
import { DataTable, ErrorNote, Panel, StatusPill } from "../../ui";
import { useToast } from "@/components/ui/Toast";
import { PageEditor } from "./PageEditor";

/** Pages list → full-view page builder (`?id=`). `?new=1` opens the create dialog. */
export function PagesManager() {
  const { profile, user } = useAuth();
  const toast = useToast();
  const canWrite = canDo(profile?.role, "content");
  const sel = useSelection();
  const pages = useResource("pages", { order: [{ column: "updated_at", ascending: false }], singular: "Page" });
  const [q, setQ] = useState("");
  const shown = useMemo(() => { const t = q.trim().toLowerCase(); return (pages.rows ?? []).filter((p) => !t || `${p.title} ${p.slug}`.toLowerCase().includes(t)); }, [pages.rows, q]);

  const duplicate = async (page: PagesRow) => {
    const taken = new Set((pages.rows ?? []).map((p) => p.slug));
    let slug = `${page.slug}-copy`;
    for (let n = 2; taken.has(slug); n++) slug = `${page.slug}-copy-${n}`;
    const made = await pages.create({ title: `${page.title} (copy)`, slug, seo: page.seo, status: "draft", created_by: user?.id ?? null }, { quiet: true });
    if (!made) return;
    const src = await backend()!.from("page_sections").select("kind,props,sort").eq("page_id", page.id).order("sort");
    const rows = ((src.data ?? []) as Pick<PageSectionsRow, "kind" | "props" | "sort">[]).map((s) => ({ ...s, page_id: made.id }));
    const ins = rows.length ? await backend()!.from("page_sections").insert(rows) : { error: null };
    toast(src.error || ins.error ? `The page was copied, but its sections were not: ${adminError(src.error ?? ins.error)}` : "Page duplicated as a draft.", src.error || ins.error ? "danger" : "ok");
    sel.open(made.id);
  };

  const selected = sel.id ? pages.rows?.find((p) => p.id === sel.id) ?? null : null;
  if (sel.id && selected) return <PageEditor key={selected.id} page={selected} canWrite={canWrite} saving={pages.saving} update={pages.update} remove={pages.remove} duplicate={duplicate} onBack={sel.close} />;

  return (
    <div>
      <p className="mb-4 max-w-3xl text-sm leading-relaxed text-fog-400">Build landing pages from sections — no code. A page goes live at the first “Publish site” after it is marked Published (and after its go-live date, if one is set).</p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search pages" placeholder="Search pages…" className={clsx(inputCls, "min-w-0 flex-1 sm:max-w-sm")} />
        {canWrite && <Button size="sm" className="ml-auto min-h-11" onClick={sel.openNew}>New page</Button>}
      </div>
      <ErrorNote message={pages.error} onRetry={() => void pages.reload()} />
      {sel.id && !selected && pages.rows && <ErrorNote message="That page no longer exists, or your role cannot see it." />}
      <Panel flush>
        <DataTable caption="Pages" rows={pages.error ? [] : shown} loading={pages.loading} rowKey={(p) => p.id} onRowClick={(p) => !p.id.startsWith("tmp-") && sel.open(p.id)}
          empty={pages.rows?.length ? "Nothing matches that search." : "No pages yet. Create the first one with “New page”."}
          columns={[
            { key: "title", header: "Page", cell: (p) => <span><span className="block text-fog-50">{p.title}</span><span className="t-data block text-xs text-fog-500">/p/{p.slug}/</span></span> },
            { key: "status", header: "Status", cell: (p) => <StatusPill status={displayStatus(p)} /> },
            { key: "updated", header: "Edited", hideBelow: "sm", cell: (p) => <span className="text-fog-400">{relativeTime(p.updated_at)}</span> },
          ]} />
      </Panel>
      {sel.isNew && canWrite && <NewPageDialog onClose={sel.close} saving={pages.saving} onCreate={async (title, slug) => { const made = await pages.create({ title, slug, status: "draft", seo: {}, created_by: user?.id ?? null }); if (made) sel.open(made.id); }} />}
    </div>
  );
}

function NewPageDialog({ onClose, onCreate, saving }: { onClose: () => void; onCreate: (title: string, slug: string) => Promise<void>; saving: boolean }) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; slug?: string }>({});
  const submit = () => {
    const e = { title: title.trim().length < 2 ? "Give the page a title." : undefined, slug: SLUG_RE.test(slug) ? undefined : "Lowercase letters, numbers and single hyphens only." };
    setErrors(e);
    if (!e.title && !e.slug) void onCreate(title.trim(), slug);
  };
  return (
    <Modal open onClose={onClose} title="New page" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={submit}>Create draft</Button></>}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <TextField label="Title" required value={title} error={errors.title} onChange={(v) => { setTitle(v); if (!touched) setSlug(slugify(v)); }} maxLength={160} />
        <SlugField label="Slug" required value={slug} error={errors.slug} onChange={(v) => { setSlug(v); setTouched(true); }} source={title} table="pages" prefix="/p/" />
        <p className="text-sm text-fog-400">The page starts as a draft with no sections. Nothing appears on the site until you publish it.</p>
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>Create</button>
      </form>
    </Modal>
  );
}

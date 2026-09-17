"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { PagesRow } from "@/lib/backend/db-types";
import { relativeTime } from "@/lib/format";
import { DISCARD, useConfirm } from "../../resource/Confirm";
import { FormFields } from "../../resource/FormFields";
import { validateValues } from "../../resource/schema";
import { asSeo, SeoField } from "../../resource/seo";
import { displayStatus, PUBLISH_OPTIONS } from "../../resource/status";
import type { FieldGroup, Values } from "../../resource/types";
import { Panel, StatusPill } from "../../ui";
import { SectionList } from "./SectionList";

type Update = (id: string, patch: Values, o?: { quiet?: boolean; message?: string }) => Promise<PagesRow | null>;

const groups: FieldGroup[] = [
  { title: "Page", fields: [
    { name: "title", label: "Title", type: "text", required: true, max: 160, wide: true },
    { name: "slug", label: "Slug", type: "slug", from: "title", required: true, prefix: "/p/", hint: undefined },
  ] },
  { title: "SEO", fields: [{ name: "seo", label: "SEO", type: "custom", render: ({ value, onChange, values, disabled }) => <SeoField value={asSeo(value)} onChange={onChange} disabled={disabled} fallbackTitle={String(values.title ?? "")} fallbackDescription="" path={`/p/${String(values.slug ?? "") || "…"}/`} /> }] },
  { title: "Publishing", note: "Saving updates the database straight away. Visitors see the change after the next “Publish site”.", fields: [
    { name: "status", label: "Status", type: "select", required: true, options: PUBLISH_OPTIONS },
    { name: "publish_at", label: "Go live from", type: "date", withTime: true, showIf: (v) => v.status === "published", hint: "Optional. With a future date the page stays hidden until the first site build after that moment." },
  ] },
];

/** Full-view page builder: details on the left, the section stack on the right. */
export function PageEditor({ page, canWrite, saving, update, remove, duplicate, onBack }: { page: PagesRow; canWrite: boolean; saving: boolean; update: Update; remove: (id: string) => Promise<boolean>; duplicate: (p: PagesRow) => Promise<void>; onBack: () => void }) {
  const initial = useMemo<Values>(() => ({ title: page.title, slug: page.slug, seo: page.seo ?? {}, status: page.status, publish_at: page.publish_at }), [page]);
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, confirmUi] = useConfirm();
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  const save = async () => {
    const found = validateValues(groups, values);
    setErrors(found);
    if (Object.keys(found).length) return;
    await update(page.id, { ...values, publish_at: values.status === "published" ? values.publish_at : null });
  };
  const back = async () => { if (!dirty || (await confirm(DISCARD))) onBack(); };
  const quick = async (status: "published" | "draft" | "archived") => {
    if (status === "archived" && !(await confirm({ title: "Archive this page?", body: "It will disappear from the site at the next publish. Nothing is deleted.", confirmLabel: "Archive" }))) return;
    const r = await update(page.id, { status, ...(status !== "published" ? { publish_at: null } : {}) }, { message: status === "published" ? "Marked as published — it goes live at the next “Publish site”." : status === "archived" ? "Archived." : "Back to draft." });
    if (r) setValues((v) => ({ ...v, status: r.status, publish_at: r.publish_at }));
  };
  const del = async () => {
    if (!(await confirm({ title: "Delete this page?", body: <>“{page.title}” and all of its sections will be permanently deleted. This cannot be undone — archive it instead if you only want it off the site.</>, confirmLabel: "Delete permanently", danger: true }))) return;
    if (await remove(page.id)) onBack();
  };

  return (
    <div>
      <div className="sticky top-16 z-10 -mx-4 mb-5 flex flex-wrap items-center gap-2 border-b border-ink-700 bg-ink-950/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
        <Button variant="ghost" size="sm" onClick={() => void back()}>← Pages</Button>
        <div className="mr-auto min-w-0">
          <h2 className="t-heading truncate text-fog-50">{page.title}</h2>
          <p className="flex flex-wrap items-center gap-2 text-xs text-fog-500"><StatusPill status={displayStatus(page)} /><span>Edited {relativeTime(page.updated_at)}</span>{dirty && <span className="t-label text-warn">Unsaved details</span>}</p>
        </div>
        {canWrite && (
          <>
            {page.status === "published" ? <Button variant="ghost" size="sm" onClick={() => void quick("draft")}>Unpublish</Button> : <Button variant="outline" size="sm" disabled={dirty} title={dirty ? "Save the details first" : undefined} onClick={() => void quick("published")}>Mark published</Button>}
            <Button variant="ghost" size="sm" disabled={dirty} onClick={() => void duplicate(page)}>Duplicate</Button>
            {page.status !== "archived" && <Button variant="ghost" size="sm" onClick={() => void quick("archived")}>Archive</Button>}
            <Button variant="danger" size="sm" onClick={() => void del()}>Delete</Button>
          </>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <Panel title="Page details" action={canWrite ? <Button size="sm" loading={saving} disabled={!dirty} onClick={() => void save()}>Save details</Button> : <span className="t-label text-fog-500">Read-only</span>}>
          <form noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <FormFields groups={groups} values={values} errors={errors} table="pages" rowId={page.id} disabled={!canWrite}
              onChange={(n, v) => { setValues((p) => ({ ...p, [n]: v })); if (errors[n]) setErrors((e) => { const x = { ...e }; delete x[n]; return x; }); }} />
            <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>Save</button>
          </form>
        </Panel>
        <SectionList pageId={page.id} pageTitle={page.title} canWrite={canWrite} onChanged={() => void update(page.id, { title: page.title }, { quiet: true })} />
      </div>
      {confirmUi}
    </div>
  );
}

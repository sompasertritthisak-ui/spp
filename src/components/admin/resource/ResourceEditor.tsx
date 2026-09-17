"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { TableName, Tables } from "@/lib/backend/db-types";
import { useAuth } from "@/lib/backend/auth";
import { Drawer, StatusPill } from "../ui";
import { DISCARD, useConfirm } from "./Confirm";
import { FormFields } from "./FormFields";
import { blankFor, validateValues } from "./schema";
import { displayStatus, PUBLISH_OPTIONS, slugify } from "./status";
import type { FieldGroup, ResourceConfig, Values } from "./types";

export type EditorActions<K extends TableName> = {
  create: (v: Values) => Promise<(Tables[K] & { id: string }) | null>;
  update: (id: string, patch: Values, o?: { quiet?: boolean; message?: string }) => Promise<(Tables[K] & { id: string }) | null>;
  remove: (id: string) => Promise<boolean>;
  duplicate: (row: Tables[K] & { id: string }) => Promise<void>;
};

const PUBLISH_NOTE = "Saving updates the database straight away. The public site is static, so visitors see the change after the next “Publish site” (about 2–3 minutes).";

function publishingGroup<K extends TableName>(c: ResourceConfig<K>): FieldGroup[] {
  if (!c.statusField) return [];
  return [{
    title: "Publishing", note: PUBLISH_NOTE,
    fields: [
      { name: c.statusField, label: "Status", type: "select", options: PUBLISH_OPTIONS, required: true },
      ...(c.schedulable ? [{ name: "publish_at", label: "Go live from", type: "date", withTime: true, hint: "Optional. With a future date, a published item stays hidden until the first site build after that moment.", showIf: (v: Values) => v[c.statusField!] === "published" } as const] : []),
    ],
  }];
}

export function ResourceEditor<K extends TableName>({ config, row, canWrite, saving, actions, onClose, onCreated }: { config: ResourceConfig<K>; row: (Tables[K] & { id: string }) | null; canWrite: boolean; saving: boolean; actions: EditorActions<K>; onClose: () => void; onCreated: (id: string) => void }) {
  const { user } = useAuth();
  const isNew = row === null;
  const groups = useMemo(() => [...config.groups, ...publishingGroup(config)], [config]);
  const initial = useMemo<Values>(() => {
    const src: Values = row ?? { ...(config.statusField ? { [config.statusField]: "draft" } : {}), ...config.defaults() };
    return Object.fromEntries(groups.flatMap((g) => g.fields).map((f) => [f.name, src[f.name] ?? blankFor(f)]));
  }, [row, config, groups]);
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [confirm, confirmUi] = useConfirm();
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(initial), [values, initial]);

  const onChange = (name: string, value: unknown) => {
    setValues((v) => {
      const next = { ...v, [name]: value };
      // a new record's slug follows its title until someone edits the slug by hand
      if (!slugTouched) for (const f of groups.flatMap((g) => g.fields)) if (f.type === "slug" && f.from === name) next[f.name] = slugify(String(value ?? ""));
      return next;
    });
    if (groups.some((g) => g.fields.some((f) => f.type === "slug" && f.name === name))) setSlugTouched(true);
    if (errors[name]) setErrors((e) => { const n = { ...e }; delete n[name]; return n; });
  };

  const close = async () => { if (!dirty || (await confirm(DISCARD))) onClose(); };

  const save = async () => {
    const found = validateValues(groups, values, config.validate);
    setErrors(found);
    if (Object.keys(found).length) return;
    const payload = config.beforeSave ? config.beforeSave({ ...values }, { isNew, userId: user?.id ?? null }) : { ...values };
    if (isNew) { const made = await actions.create(payload); if (made) onCreated(made.id); }
    else if (await actions.update(row.id, payload)) onClose();
  };

  const statusNow = config.statusField && row ? displayStatus(row as Values, config.statusField) : null;
  const archive = async () => {
    if (!row || !config.statusField) return;
    const to = (row as Values)[config.statusField] === "archived" ? "draft" : "archived";
    if (to === "archived" && !(await confirm({ title: `Archive this ${config.singular.toLowerCase()}?`, body: "It will be hidden from the site at the next publish. Nothing is deleted and you can restore it at any time.", confirmLabel: "Archive" }))) return;
    if (await actions.update(row.id, { [config.statusField]: to }, { message: to === "archived" ? "Archived." : "Restored as a draft." })) onClose();
  };
  const del = async () => {
    if (!row) return;
    if (!(await confirm({ title: `Delete this ${config.singular.toLowerCase()}?`, body: <>“{config.titleOf(row)}” will be permanently deleted. This cannot be undone. If you only want it off the site, archive it instead.</>, confirmLabel: "Delete permanently", danger: true }))) return;
    if (await actions.remove(row.id)) onClose();
  };

  const errorCount = Object.keys(errors).length;
  return (
    <Drawer open onClose={() => void close()} title={isNew ? `New ${config.singular.toLowerCase()}` : config.titleOf(row) || config.singular}
      sub={<span className="flex flex-wrap items-center gap-2">{statusNow && <StatusPill status={statusNow} />}{dirty && <span className="t-label text-warn">Unsaved changes</span>}{!canWrite && <span className="t-label text-fog-500">Read-only for your role</span>}</span>}
      footer={canWrite ? (
        <>
          {!isNew && config.deletable !== false && <Button variant="danger" size="sm" className="mr-auto" onClick={() => void del()}>Delete</Button>}
          {!isNew && config.statusField && <Button variant="ghost" size="sm" onClick={() => void archive()}>{(row as Values)[config.statusField] === "archived" ? "Restore" : "Archive"}</Button>}
          {!isNew && <Button variant="ghost" size="sm" disabled={dirty} title={dirty ? "Save first, then duplicate" : undefined} onClick={() => void actions.duplicate(row)}>Duplicate</Button>}
          <Button size="sm" loading={saving} disabled={!dirty && !isNew} onClick={() => void save()}>{isNew ? "Create" : "Save changes"}</Button>
        </>
      ) : <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>}
    >
      {config.aside && <div className="mb-6">{config.aside(row, values)}</div>}
      <div aria-live="polite">{errorCount > 0 && <p role="alert" className="mb-4 border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-fog-50">{errorCount === 1 ? "One field needs attention" : `${errorCount} fields need attention`} before this can be saved.</p>}</div>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <FormFields groups={groups} values={values} errors={errors} onChange={onChange} table={config.table} rowId={row?.id ?? null} disabled={!canWrite} />
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>Save</button>
      </form>
      {confirmUi}
    </Drawer>
  );
}

"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { PageSectionsRow } from "@/lib/backend/db-types";
import { DISCARD, useConfirm } from "../../resource/Confirm";
import { FormFields } from "../../resource/FormFields";
import { validateValues } from "../../resource/schema";
import type { Values } from "../../resource/types";
import { Drawer } from "../../ui";
import { blankSection, parseEmbed, SECTION_META, validateSection, type SectionKind } from "../section-kinds";
import { sectionForms } from "./section-forms";

/** Per-kind props form. What is saved has passed the zod contract in section-kinds.ts. */
export function SectionDrawer({ section, kind, canWrite, saving, onClose, onSave, onDuplicate }: { section: PageSectionsRow; kind: SectionKind; canWrite: boolean; saving: boolean; onClose: () => void; onSave: (props: Values) => Promise<void>; onDuplicate: () => void }) {
  const groups = sectionForms[kind];
  const initial = useMemo<Values>(() => ({ ...blankSection(kind), ...(section.props && typeof section.props === "object" && !Array.isArray(section.props) ? (section.props as Values) : {}) }), [section.props, kind]);
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, confirmUi] = useConfirm();
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  const change = (name: string, value: unknown) => {
    setValues((v) => ({ ...v, [name]: value, ...(kind === "embed" && name === "src" ? { provider: parseEmbed(String(value))?.provider ?? v.provider } : {}) }));
    if (errors[name]) setErrors((e) => { const n = { ...e }; delete n[name]; return n; });
  };
  const save = async () => {
    const fieldErrors = validateValues(groups, values);
    const contract = validateSection(kind, values);
    const all = { ...(contract.ok ? {} : contract.errors), ...fieldErrors };
    setErrors(all);
    if (Object.keys(all).length || !contract.ok) return;
    await onSave(contract.props);
  };
  const close = async () => { if (!dirty || (await confirm(DISCARD))) onClose(); };
  const count = Object.keys(errors).length;

  return (
    <Drawer open onClose={() => void close()} title={`${SECTION_META[kind].label} section`} sub={<span className="flex flex-wrap gap-2"><span>{SECTION_META[kind].blurb}</span>{dirty && <span className="t-label text-warn">Unsaved changes</span>}</span>}
      footer={canWrite ? <><Button variant="ghost" size="sm" disabled={dirty} title={dirty ? "Save first, then duplicate" : undefined} onClick={onDuplicate}>Duplicate</Button><Button size="sm" loading={saving} disabled={!dirty} onClick={() => void save()}>Save section</Button></> : <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>}>
      <div aria-live="polite">{count > 0 && <p role="alert" className="mb-4 border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-fog-50">{count === 1 ? "One field needs" : `${count} fields need`} attention.{errors._ && ` ${errors._}`}</p>}</div>
      <form noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <FormFields groups={groups} values={values} errors={errors} onChange={change} table="page_sections" rowId={section.id} disabled={!canWrite} />
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>Save</button>
      </form>
      {confirmUi}
    </Drawer>
  );
}

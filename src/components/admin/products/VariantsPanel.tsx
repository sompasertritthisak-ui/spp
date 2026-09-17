"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ProductVariantsRow } from "@/lib/backend/db-types";
import { Modal, useConfirm } from "../resource/Confirm";
import { KeyValueField, TextField, ToggleField } from "../resource/fields";
import { useResource } from "../resource/useResource";
import { ErrorNote } from "../ui";

type Draft = { id: string | null; name: string; sku: string; attrs: Record<string, string>; active: boolean };
const attrsOf = (v: unknown): Record<string, string> => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, String(x)])) : {});

/** product_variants CRUD. Variants save on their own, independently of the product form. */
export function VariantsPanel({ productId, disabled }: { productId: string; disabled: boolean }) {
  const res = useResource("product_variants", { order: [{ column: "name" }], singular: "Variant", filter: { column: "product_id", value: productId } });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, confirmUi] = useConfirm();

  const save = async () => {
    if (!draft) return;
    if (draft.name.trim().length < 1) return setError("Give the variant a name, e.g. “Navy / XL”.");
    const payload = { name: draft.name.trim(), sku: draft.sku.trim() || null, attrs: draft.attrs, active: draft.active };
    const ok = draft.id ? await res.update(draft.id, payload) : await res.create({ ...payload, product_id: productId });
    if (ok) setDraft(null);
  };
  const del = async (v: ProductVariantsRow) => { if (await confirm({ title: "Delete this variant?", body: <>“{v.name}” will be removed. This cannot be undone.</>, danger: true, confirmLabel: "Delete variant" })) await res.remove(v.id); };

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm leading-relaxed text-fog-400">Variants are the stock-keeping combinations staff quote and produce (colour / size / material). They are optional and save immediately, separately from the rest of the product.</p>
      <ErrorNote message={res.error} onRetry={() => void res.reload()} />
      {res.loading && !res.rows && <div className="skeleton h-24" />}
      {res.rows?.length === 0 && <p className="mb-3 border border-dashed border-ink-600 px-4 py-6 text-sm text-fog-500">No variants yet.</p>}
      <ul className="mb-3 divide-y divide-ink-800 border-y border-ink-800 empty:hidden">
        {res.rows?.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1 basis-48"><p className="truncate text-sm text-fog-50">{v.name}{!v.active && <span className="t-label ml-2 text-fog-500">Inactive</span>}</p><p className="t-data truncate text-xs text-fog-500">{v.sku ?? "no SKU"}{Object.entries(attrsOf(v.attrs)).map(([k, x]) => ` · ${k}: ${x}`).join("")}</p></div>
            {!disabled && <>
              <ToggleField label="Active" className="[&>span]:sr-only" value={v.active} onChange={(a) => void res.update(v.id, { active: a }, { quiet: true })} onLabel="Active" offLabel="Off" />
              <Button variant="ghost" size="sm" disabled={v.id.startsWith("tmp-")} onClick={() => { setError(null); setDraft({ id: v.id, name: v.name, sku: v.sku ?? "", attrs: attrsOf(v.attrs), active: v.active }); }}>Edit</Button>
              <Button variant="ghost" size="sm" disabled={v.id.startsWith("tmp-")} onClick={() => void del(v)}>Delete</Button>
            </>}
          </li>
        ))}
      </ul>
      {!disabled && <Button variant="outline" size="sm" onClick={() => { setError(null); setDraft({ id: null, name: "", sku: "", attrs: {}, active: true }); }}>Add variant</Button>}
      <Modal open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? "Edit variant" : "New variant"} footer={<><Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button><Button loading={res.saving} onClick={() => void save()}>Save variant</Button></>}>
        {draft && (
          <form key={draft.id ?? "new"} className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <TextField label="Name" required value={draft.name} onChange={(v) => { setDraft({ ...draft, name: v }); setError(null); }} error={error} placeholder="Navy / XL" />
            <TextField label="SKU" value={draft.sku} onChange={(v) => setDraft({ ...draft, sku: v })} hint="Optional. Must be unique across all products." />
            <KeyValueField label="Attributes" value={draft.attrs} onChange={(v) => setDraft({ ...draft, attrs: v })} keyLabel="Attribute (e.g. colour)" valueLabel="Value (e.g. Navy)" />
            <ToggleField label="Active" value={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} onLabel="Available" offLabel="Hidden from staff pickers and the site" />
            <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>Save</button>
          </form>
        )}
      </Modal>
      {confirmUi}
    </div>
  );
}

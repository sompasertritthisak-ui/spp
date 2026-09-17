"use client";
import { clsx } from "clsx";
import type { TableName } from "@/lib/backend/db-types";
import { MediaField } from "../media/MediaField";
import { AreaField, ColourField, DateField, FormSection, KeyValueField, NumberField, SelectField, TagsField, TextField, ToggleField } from "./fields";
import { RelationField, SlugField } from "./pickers";
import type { FieldDef, FieldGroup, Values } from "./types";

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const rec = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, str(x)])) : {});

function Control({ f, values, error, set, table, rowId, disabled }: { f: FieldDef; values: Values; error: string | null; set: (v: unknown) => void; table: TableName; rowId: string | null; disabled: boolean }) {
  const v = values[f.name];
  const common = { label: f.label, hint: f.hint, required: f.required, error, disabled };
  switch (f.type) {
    case "text": return <TextField {...common} value={str(v)} onChange={set} type={f.input} maxLength={f.max} placeholder={f.placeholder} inputMode={f.input === "tel" ? "tel" : f.input === "email" ? "email" : f.input === "url" ? "url" : undefined} />;
    case "textarea": return <AreaField {...common} value={str(v)} onChange={set} rows={f.rows} maxLength={f.max} mono={f.mono} placeholder={f.placeholder} />;
    case "number": return <NumberField {...common} value={typeof v === "number" ? v : null} onChange={set} min={f.min} max={f.max} step={f.step ?? (f.integer ? 1 : undefined)} suffix={f.suffix} />;
    case "select": return <SelectField {...common} value={str(v)} onChange={set} options={f.options} placeholder={f.placeholder} />;
    case "toggle": return <ToggleField {...common} value={Boolean(v)} onChange={set} onLabel={f.onLabel} offLabel={f.offLabel} />;
    case "tags": return <TagsField {...common} value={arr(v)} onChange={set} suggestions={f.suggestions} max={f.max} placeholder={f.placeholder} />;
    case "slug": return <SlugField {...common} value={str(v)} onChange={set} source={str(values[f.from])} table={table} column={f.column} excludeId={rowId} prefix={f.prefix} />;
    case "date": return <DateField {...common} value={typeof v === "string" ? v : null} onChange={set} withTime={f.withTime} />;
    case "colour": return <ColourField {...common} value={str(v)} onChange={set} />;
    case "keyvalue": return <KeyValueField {...common} value={rec(v)} onChange={set} keyLabel={f.keyLabel} valueLabel={f.valueLabel} />;
    case "media": return <MediaField {...common} value={typeof v === "string" ? v : null} onChange={set} imagesOnly={f.imagesOnly} category={f.category} />;
    case "relation": return <RelationField {...common} table={f.table} valueField={f.valueField} labelField={f.labelField} hintField={f.hintField} multiple={f.multiple} value={f.multiple ? arr(v) : typeof v === "string" ? v : null} onChange={set} exclude={f.table === table && (f.valueField ?? "id") === "id" ? rowId : null} />;
    case "custom": return <>{f.render({ value: v, onChange: set, values, error, disabled })}</>;
  }
}

/** Renders a field-definition array. Wide-by-nature controls span both columns automatically. */
export function FormFields({ groups, values, errors, onChange, table, rowId, disabled = false }: { groups: FieldGroup[]; values: Values; errors: Record<string, string>; onChange: (name: string, value: unknown) => void; table: TableName; rowId: string | null; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => {
        const fields = g.fields.filter((f) => !f.showIf || f.showIf(values));
        if (!fields.length) return null;
        return (
          <FormSection key={g.title} title={g.title} note={g.note}>
            {fields.map((f) => {
              const wide = f.wide ?? (["textarea", "tags", "keyvalue", "media", "custom", "slug"].includes(f.type) || (f.type === "relation" && Boolean(f.multiple)));
              return <div key={f.name} className={clsx("min-w-0", wide && "sm:col-span-2")}><Control f={f} values={values} error={errors[f.name] ?? null} set={(v) => onChange(f.name, v)} table={table} rowId={rowId} disabled={disabled} /></div>;
            })}
          </FormSection>
        );
      })}
    </div>
  );
}

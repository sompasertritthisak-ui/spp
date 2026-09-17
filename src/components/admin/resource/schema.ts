import { BRAND } from "@/lib/brand";
import { z } from "zod";
import { HEX_RE } from "./fields";
import { SLUG_RE } from "./status";
import type { FieldDef, FieldGroup, Values } from "./types";

/** One zod schema per field definition. The database re-validates; this is for fast, inline feedback. */
function schemaFor(f: FieldDef): z.ZodType {
  const need = `${f.label} is required.`;
  switch (f.type) {
    case "text": {
      let s = z.string().trim().max(f.max ?? 300, `Keep this under ${f.max ?? 300} characters.`);
      if (f.required) s = s.min(1, need);
      return s
        .refine((v) => !v || !f.pattern || f.pattern.test(v), f.patternMessage ?? "That format does not look right.")
        .refine((v) => !v || f.input !== "email" || z.email().safeParse(v).success, "That email address does not look right.")
        .refine((v) => !v || f.input !== "url" || /^(https?:\/\/|\/)\S+$/.test(v), "Use a full https:// address or a site path starting with /.");
    }
    case "textarea": { const s = z.string().max(f.max ?? 20000, `Keep this under ${f.max ?? 20000} characters.`); return f.required ? s.refine((v) => v.trim().length > 0, need) : s; }
    case "number":
      return z.number({ error: f.required ? need : "Enter a number." }).nullable()
        .refine((v) => !f.required || v !== null, need)
        .refine((v) => v === null || !f.integer || Number.isInteger(v), "Use a whole number.")
        .refine((v) => v === null || f.min === undefined || v >= f.min, `Must be ${f.min} or more.`)
        .refine((v) => v === null || f.max === undefined || v <= f.max, `Must be ${f.max} or less.`);
    case "select": return f.required ? z.string().min(1, need) : z.string();
    case "toggle": return z.boolean();
    case "tags": { const a = z.array(z.string().trim().min(1).max(160)).max(f.max ?? 40, `No more than ${f.max ?? 40} entries.`); return f.required ? a.min(1, `Add at least one entry to ${f.label.toLowerCase()}.`) : a; }
    case "slug": return z.string().min(1, need).max(80).regex(SLUG_RE, "Lowercase letters, numbers and single hyphens only.");
    case "date": return z.string().nullable().refine((v) => !f.required || Boolean(v), need).refine((v) => !v || !Number.isNaN(new Date(v).getTime()), "That date is not valid.");
    case "colour": return z.string().refine((v) => (!v && !f.required) || HEX_RE.test(v), `Use a 6-digit hex colour, e.g. ${BRAND.gold}.`);
    case "keyvalue": return z.record(z.string().max(60), z.string().max(400));
    case "media": return z.string().nullable().refine((v) => !f.required || Boolean(v), need);
    case "relation": return f.multiple ? z.array(z.string()).refine((v) => !f.required || v.length > 0, need) : z.string().nullable().refine((v) => !f.required || Boolean(v), need);
    case "custom": return z.unknown();
  }
}

/** The "empty" value for a field, so controlled inputs and zod both see the right type. */
export function blankFor(f: FieldDef): unknown {
  switch (f.type) {
    case "text": case "textarea": case "select": case "slug": case "colour": return "";
    case "toggle": return false;
    case "tags": return [];
    case "keyvalue": return {};
    case "relation": return f.multiple ? [] : null;
    default: return null;
  }
}

export const visibleFields = (groups: FieldGroup[], values: Values) => groups.flatMap((g) => g.fields).filter((f) => !f.showIf || f.showIf(values));

export function validateValues(groups: FieldGroup[], values: Values, extra?: (v: Values) => Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of visibleFields(groups, values)) {
    const r = schemaFor(f).safeParse(values[f.name]);
    if (!r.success) errors[f.name] = r.error.issues[0]?.message ?? "That value is not valid.";
    else { const m = f.check?.(values[f.name], values); if (m) errors[f.name] = m; }
  }
  return { ...errors, ...(extra?.(values) ?? {}) };
}

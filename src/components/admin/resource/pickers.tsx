"use client";
import { clsx } from "clsx";
import { useEffect, useId, useMemo, useState } from "react";
import { backend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import type { TableName } from "@/lib/backend/db-types";
import { FieldShell, SelectField, inputCls, type FieldProps } from "./fields";
import { SLUG_RE, slugify } from "./status";

/** Slug input with a generate button and a live uniqueness check against `table.column`. */
export function SlugField({ value, onChange, source, table, column = "slug", excludeId, prefix, ...p }: FieldProps & { value: string; onChange: (v: string) => void; source: string; table: TableName; column?: string; excludeId?: string | null; prefix?: string }) {
  const id = useId();
  const [check, setCheck] = useState<{ value: string; taken: boolean } | null>(null);
  const wellFormed = SLUG_RE.test(value);

  useEffect(() => {
    const b = backend();
    if (!b || !wellFormed) return;
    let alive = true;
    const t = setTimeout(async () => {
      let q = b.from(table).select("id", { count: "exact", head: true }).eq(column, value);
      if (excludeId) q = q.neq("id", excludeId);
      const { count, error } = await q;
      if (alive && !error) setCheck({ value, taken: (count ?? 0) > 0 });
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [value, wellFormed, table, column, excludeId]);

  const state = !value ? null : !wellFormed ? "bad" : check?.value !== value ? "checking" : check.taken ? "taken" : "free";
  const error = p.error ?? (state === "bad" ? "Lowercase letters, numbers and single hyphens only." : state === "taken" ? "Already in use — choose another." : null);
  return (
    <FieldShell id={id} {...p} error={error} hint={p.hint ?? (prefix ? <>URL: <span className="t-data text-fog-400">{prefix}{value || "…"}/</span></> : undefined)}>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : `${id}-hint`} disabled={p.disabled} value={value} spellCheck={false} autoComplete="off" onChange={(e) => onChange(e.target.value.toLowerCase().replace(/\s+/g, "-"))} className={clsx(inputCls, "t-data pr-20")} />
          {state && state !== "bad" && <span aria-live="polite" className={clsx("t-label pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[0.625rem]", state === "free" ? "text-ok" : state === "taken" ? "text-danger" : "text-fog-500")}>{state === "free" ? "Available" : state === "taken" ? "Taken" : "Checking"}</span>}
        </div>
        <button type="button" disabled={p.disabled || !source.trim()} onClick={() => onChange(slugify(source))} className="t-label flex-none border border-ink-600 px-3 text-fog-300 hover:border-yellow hover:text-yellow disabled:opacity-40">Generate</button>
      </div>
    </FieldShell>
  );
}

export type PickOption = { value: string; label: string; hint?: string };

/** Ordered multi-select: searchable checklist plus the chosen items as reorderable rows. */
export function MultiPick({ value, onChange, options, loading = false, max, emptyText = "Nothing selected.", ...p }: FieldProps & { value: string[]; onChange: (v: string[]) => void; options: PickOption[]; loading?: boolean; max?: number; emptyText?: string }) {
  const id = useId();
  const [q, setQ] = useState("");
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const shown = useMemo(() => { const t = q.trim().toLowerCase(); return options.filter((o) => !value.includes(o.value) && (!t || `${o.label} ${o.hint ?? ""} ${o.value}`.toLowerCase().includes(t))).slice(0, 30); }, [options, value, q]);
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= value.length) return; const n = [...value]; [n[i], n[j]] = [n[j]!, n[i]!]; onChange(n); };
  const full = max != null && value.length >= max;
  return (
    <FieldShell id={id} as="legend" {...p}>
      <div role="group" aria-labelledby={`${id}-lbl`} className="border border-ink-600 bg-ink-950">
        {value.length === 0 ? <p className="px-3 py-3 text-sm text-fog-500">{emptyText}</p> : (
          <ol className="divide-y divide-ink-800">
            {value.map((v, i) => (
              <li key={v} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                <span className="t-data w-5 flex-none text-fog-500">{i + 1}</span>
                <span className={clsx("min-w-0 flex-1 truncate", byValue.has(v) ? "text-fog-100" : "text-warn")}>{byValue.get(v)?.label ?? `${v} (not found)`}</span>
                <button type="button" disabled={p.disabled || i === 0} onClick={() => move(i, -1)} aria-label="Move up" className="h-9 w-8 text-fog-400 hover:text-fog-50 disabled:opacity-30">↑</button>
                <button type="button" disabled={p.disabled || i === value.length - 1} onClick={() => move(i, 1)} aria-label="Move down" className="h-9 w-8 text-fog-400 hover:text-fog-50 disabled:opacity-30">↓</button>
                <button type="button" disabled={p.disabled} onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${byValue.get(v)?.label ?? v}`} className="h-9 w-8 text-fog-400 hover:text-danger">×</button>
              </li>
            ))}
          </ol>
        )}
        <div className="border-t border-ink-700 p-2">
          <input aria-label={`Search ${p.label}`} disabled={p.disabled || full} value={q} onChange={(e) => setQ(e.target.value)} placeholder={full ? `Maximum of ${max} reached` : loading ? "Loading…" : "Search to add…"} className={clsx(inputCls, "min-h-10 border-ink-700")} />
          {!full && (q.trim() || options.length <= 12) && shown.length > 0 && (
            <ul className="thin-scroll mt-1 max-h-44 overflow-y-auto">
              {shown.map((o) => <li key={o.value}><button type="button" disabled={p.disabled} onClick={() => { onChange([...value, o.value]); setQ(""); }} className="flex min-h-10 w-full items-center justify-between gap-3 px-2 text-left text-sm text-fog-300 hover:bg-ink-850 hover:text-fog-50"><span className="truncate">{o.label}</span>{o.hint && <span className="t-label flex-none text-[0.625rem] text-fog-500">{o.hint}</span>}</button></li>)}
            </ul>
          )}
          {!full && q.trim() && shown.length === 0 && <p className="px-2 py-2 text-sm text-fog-500">No matches.</p>}
        </div>
      </div>
    </FieldShell>
  );
}

/** Loads `{ value, label }` options from a table (RLS applies). */
export function useOptions(table: TableName, valueField: string, labelField: string, hintField?: string) {
  const cols = [...new Set(["id", valueField, labelField, ...(hintField ? [hintField] : [])])].join(",");
  const q = useQuery<Record<string, unknown>[]>(() => backend()!.from(table).select(cols).order(labelField).limit(1000) as unknown as PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>, [table, cols]);
  const options = useMemo<PickOption[]>(() => (q.data ?? []).map((r) => ({ value: String(r[valueField] ?? ""), label: String(r[labelField] ?? ""), hint: hintField ? String(r[hintField] ?? "") : undefined })), [q.data, valueField, labelField, hintField]);
  return { options, loading: q.loading, error: q.error };
}

export function RelationField({ table, valueField = "id", labelField = "name", hintField, multiple = false, value, onChange, exclude, placeholder = "— none —", ...p }: FieldProps & { table: TableName; valueField?: string; labelField?: string; hintField?: string; multiple?: boolean; value: string | string[] | null; onChange: (v: string | string[] | null) => void; exclude?: string | null; placeholder?: string }) {
  const { options, loading, error } = useOptions(table, valueField, labelField, hintField);
  const usable = useMemo(() => (exclude ? options.filter((o) => o.value !== exclude) : options), [options, exclude]);
  if (multiple) return <MultiPick {...p} error={p.error ?? error} loading={loading} options={usable} value={Array.isArray(value) ? value : []} onChange={onChange} />;
  return <SelectField {...p} error={p.error ?? error} options={usable} value={typeof value === "string" ? value : ""} onChange={(v) => onChange(v || null)} placeholder={loading ? "Loading…" : p.required ? "Choose…" : placeholder} />;
}

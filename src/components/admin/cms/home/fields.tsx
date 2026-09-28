"use client";
import { clsx } from "clsx";
import { useId, useState } from "react";
import type { Bilingual, HomeLink } from "@/content/types";
import { isHomeHref, HOME_LIMITS } from "@/lib/home";
import { FieldShell, inputCls } from "../../resource/fields";

type Errors = Record<string, string>;

const counter = (n: number, max: number) => <span className={clsx("t-data text-[0.6875rem]", n > max ? "text-danger" : n > max * 0.9 ? "text-warn" : "text-fog-500")}>{n}/{max}</span>;

/**
 * One piece of text in both languages, side by side. An empty box means "use
 * the site's own wording", which is shown greyed out as the placeholder.
 */
export function BilingualField({ label, value, onChange, max, rows = 1, fallback, accent = false, hint, errors, path, disabled }: {
  label: string; value: Bilingual; onChange: (v: Bilingual) => void; max: number; rows?: number;
  /** what the site shows while the field is empty */
  fallback: Bilingual; accent?: boolean; hint?: string; errors: Errors; path: string; disabled: boolean;
}) {
  const id = useId();
  const changed = Boolean(value.en || value.lo);
  const box = (lang: "en" | "lo") => {
    const err = errors[`${path}.${lang}`];
    const common = {
      id: `${id}-${lang}`, disabled, value: value[lang], maxLength: max, lang, "aria-invalid": Boolean(err), "aria-describedby": `${id}-${lang}-note`,
      placeholder: fallback[lang] || (lang === "lo" ? fallback.en && "ຖ້າເວັ້ນວ່າງ ຈະສະແດງເປັນພາສາອັງກິດ" : "Leave empty to show nothing here"),
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [lang]: e.target.value }),
    };
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={`${id}-${lang}`} className="t-label flex items-center justify-between gap-2 text-[0.625rem] text-fog-500">
          <span>{lang === "en" ? "English" : "ລາວ · Lao"}</span>
          {counter(value[lang].length, max)}
        </label>
        {rows > 1
          ? <textarea {...common} rows={rows} className={clsx(inputCls, "resize-y py-2.5 leading-relaxed")} />
          : <input {...common} type="text" autoComplete="off" className={inputCls} />}
        <p id={`${id}-${lang}-note`} className={clsx("min-h-4 text-xs leading-snug", err ? "text-danger" : "text-fog-500")} role={err ? "alert" : undefined}>
          {err ?? (lang === "lo" && !value.lo && value.en ? "Empty: Lao readers see the English text." : "")}
        </p>
      </div>
    );
  };
  return (
    <fieldset className="min-w-0 border-t border-ink-800 pt-4 first:border-0 first:pt-0">
      <legend className="sr-only">{label}</legend>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span aria-hidden className="t-label text-fog-300">{label}</span>
        <button type="button" disabled={disabled || !changed} onClick={() => onChange({ en: "", lo: "" })} className="t-label min-h-9 text-[0.625rem] text-fog-400 underline decoration-ink-500 underline-offset-4 hover:text-yellow disabled:no-underline disabled:opacity-40">
          {changed ? "Reset to default" : "Using the default"}
        </button>
      </div>
      <div className="grid gap-x-4 gap-y-2 md:grid-cols-2">{box("en")}{box("lo")}</div>
      {(hint || accent) && <p className="mt-1 text-xs leading-relaxed text-fog-500">{hint}{hint && accent ? " " : ""}{accent && <>Put *asterisks* around a word to set it as the accent, e.g. “See it *before* it exists.”</>}</p>}
    </fieldset>
  );
}

export type LinkOption = { href: string; label: string; group: string };
const CUSTOM = "__custom";
const NONE = "";

/** Where a button goes: a page of the site from the list, or any full https:// address. */
export function LinkField({ label, value, onChange, options, optional = false, error, disabled }: {
  label: string; value: string; onChange: (href: string) => void; options: LinkOption[]; optional?: boolean; error?: string; disabled: boolean;
}) {
  const id = useId();
  const listed = options.some((o) => o.href === value);
  const [custom, setCustom] = useState(value !== "" && !listed);
  const showCustom = custom || (value !== "" && !listed);
  const groups = [...new Set(options.map((o) => o.group))];
  const hint = showCustom
    ? value && !isHomeHref(value.trim()) ? undefined : "A full address starting with https:// — it opens in a new tab."
    : optional && !value ? "No destination: this button is not shown." : undefined;
  return (
    <FieldShell id={id} label={label} error={error ?? (showCustom && value && !isHomeHref(value.trim()) ? "Use a full address starting with https://" : null)} hint={hint} disabled={disabled}>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="relative">
          <select id={id} disabled={disabled} aria-invalid={Boolean(error)} value={showCustom ? CUSTOM : value} className={clsx(inputCls, "appearance-none pr-9")}
            onChange={(e) => { const v = e.target.value; if (v === CUSTOM) { setCustom(true); onChange(value && !listed ? value : "https://"); } else { setCustom(false); onChange(v); } }}>
            {optional ? <option value={NONE}>— No button —</option> : !value && <option value={NONE}>Choose a page…</option>}
            {groups.map((g) => <optgroup key={g} label={g}>{options.filter((o) => o.group === g).map((o) => <option key={o.href} value={o.href}>{o.label}</option>)}</optgroup>)}
            <option value={CUSTOM}>Another website (https://…)</option>
          </select>
          <svg aria-hidden viewBox="0 0 12 8" className="pointer-events-none absolute right-3 top-1/2 h-2 w-3 -translate-y-1/2 text-fog-400" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 1l5 5 5-5" /></svg>
        </div>
        {showCustom
          ? <input type="url" inputMode="url" aria-label={`${label} — web address`} disabled={disabled} value={value} maxLength={HOME_LIMITS.href} placeholder="https://www.facebook.com/…" spellCheck={false} autoComplete="off" onChange={(e) => onChange(e.target.value.trim())} className={clsx(inputCls, "t-data")} />
          : <p className="t-data flex min-h-11 items-center truncate border border-dashed border-ink-700 px-3 text-xs text-fog-500">{value || "—"}</p>}
      </div>
    </FieldShell>
  );
}

/** A button = its wording in both languages + where it goes. */
export function ButtonField({ label, value, onChange, fallback, options, optional, errors, path, disabled }: {
  label: string; value: HomeLink; onChange: (v: HomeLink) => void; fallback: Bilingual; options: LinkOption[]; optional: boolean; errors: Errors; path: string; disabled: boolean;
}) {
  const off = optional && !value.href;
  return (
    <div className="border border-ink-700 bg-ink-950 p-4">
      <p className="t-label mb-3 flex flex-wrap items-center gap-x-3 text-fog-300">{label}{off && <span className="text-[0.625rem] text-fog-500">Not shown</span>}</p>
      <div className="grid gap-4">
        <LinkField label="Goes to" value={value.href} onChange={(href) => onChange({ ...value, href })} options={options} optional={optional} error={errors[`${path}.href`]} disabled={disabled} />
        {!off && <BilingualField label="Wording" value={value.label} onChange={(l) => onChange({ ...value, label: l })} max={HOME_LIMITS.label} fallback={fallback} errors={errors} path={`${path}.label`} disabled={disabled} />}
      </div>
    </div>
  );
}

/** Tick list with every box keyboard-reachable; at least one stays ticked. */
export function CheckList({ label, hint, options, value, onChange, error, disabled }: { label: string; hint?: string; options: { value: string; label: string; note?: string }[]; value: string[]; onChange: (v: string[]) => void; error?: string; disabled: boolean }) {
  const id = useId();
  // an empty list means "all of them"
  const on = (v: string) => value.length === 0 || value.includes(v);
  const toggle = (v: string) => {
    const current = value.length ? value : options.map((o) => o.value);
    const next = current.includes(v) ? current.filter((x) => x !== v) : options.map((o) => o.value).filter((x) => x === v || current.includes(x));
    if (next.length === 0) return;
    onChange(next.length === options.length ? [] : next);
  };
  const count = value.length || options.length;
  return (
    <FieldShell id={id} as="legend" label={`${label} · ${count} of ${options.length}`} hint={hint} error={error} disabled={disabled}>
      <ul role="group" aria-labelledby={`${id}-lbl`} className="grid gap-px border border-ink-700 bg-ink-700 sm:grid-cols-2">
        {options.map((o) => {
          const last = on(o.value) && count === 1;
          return (
            <li key={o.value} className="bg-ink-950">
              <label className={clsx("flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-ink-850", on(o.value) ? "text-fog-50" : "text-fog-500", (disabled || last) && "cursor-default")} title={last ? "At least one style must stay ticked" : undefined}>
                <input type="checkbox" checked={on(o.value)} disabled={disabled || last} onChange={() => toggle(o.value)} className="h-4 w-4 flex-none accent-[var(--color-yellow)]" />
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.note && <span className="t-label hidden flex-none text-[0.625rem] text-fog-500 sm:block">{o.note}</span>}
              </label>
            </li>
          );
        })}
      </ul>
    </FieldShell>
  );
}

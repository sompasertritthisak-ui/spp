import type { z } from "zod";

export type Errors = Record<string, string>;

/**
 * First message per dotted path, e.g. { "contact.email": "…" }. `say` puts a
 * message from a shared schema (written in English) into the visitor's language.
 */
export function zodErrors(err: z.ZodError, say: (message: string) => string = (m) => m): Errors {
  const out: Errors = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    out[key] ??= say(issue.message);
  }
  return out;
}

/** Field components mark themselves aria-invalid; focus the first once React has painted the errors. */
export function focusFirstInvalid(root: HTMLElement | null) {
  requestAnimationFrame(() => root?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00`).getTime());

import type { PublishStatus } from "@/lib/backend/db-types";

/**
 * Publishing model (one rule for the whole CMS):
 *  - Saving writes to the database immediately. The LIVE site is static, so it
 *    only changes on the next site build ("Publish site").
 *  - RLS exposes a row to the build when status = 'published' AND (where the
 *    table has publish_at) publish_at is null or in the past. Scheduling is
 *    therefore "published + a future publish_at": the first build after that
 *    moment picks it up. We display such rows as "scheduled".
 */
export const PUBLISH_OPTIONS: { value: PublishStatus; label: string }[] = [
  { value: "draft", label: "Draft — hidden from the site" },
  { value: "published", label: "Published — included in the next site build" },
  { value: "archived", label: "Archived — hidden, kept for the record" },
];

export function displayStatus(row: { status?: unknown; publish?: unknown; publish_at?: unknown }, field: "status" | "publish" = "status"): string {
  const st = String(row[field] ?? "");
  if (st === "scheduled") return "scheduled";
  if (st === "published" && typeof row.publish_at === "string" && new Date(row.publish_at).getTime() > Date.now()) return "scheduled";
  return st;
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** datetime-local <-> ISO. Inputs work in the editor's local time zone. */
export const isoToLocalInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const localInputToIso = (v: string) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

import type { ReactNode } from "react";
import type { ProjectStage, ProjectsRow } from "@/lib/backend/db-types";
import { titleCase } from "@/lib/format";

export type Project = ProjectsRow;
export const STAGES: readonly ProjectStage[] = ["discovery", "design", "artwork", "approval", "production", "quality_control", "delivery", "completion"];

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const isEmpty = (v: unknown) => v == null || v === "" || (Array.isArray(v) && v.length === 0) || (isObj(v) && Object.keys(v).length === 0);
const label = (k: string) => titleCase(k.replace(/([a-z])([A-Z])/g, "$1 $2"));

/** Pretty-prints the project-builder answers (arbitrary JSON) as a readable brief instead of a code dump. */
export function Requirements({ value, depth = 0 }: { value: unknown; depth?: number }): ReactNode {
  if (isEmpty(value)) return <span className="text-fog-500">—</span>;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") return <span className="whitespace-pre-wrap">{String(value)}</span>;
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === "string" || typeof v === "number")) return value.join(", ");
    return <ol className="flex flex-col gap-2">{value.map((v, i) => <li key={i} className="border-l border-ink-600 pl-3"><Requirements value={v} depth={depth + 1} /></li>)}</ol>;
  }
  if (!isObj(value)) return null;
  const entries = Object.entries(value).filter(([, v]) => !isEmpty(v));
  if (!entries.length) return <span className="text-fog-500">—</span>;
  return (
    <dl className={depth ? "flex flex-col gap-1.5" : "flex flex-col gap-3"}>
      {entries.map(([k, v]) => (
        <div key={k} className={depth ? "grid grid-cols-[minmax(0,8rem)_1fr] gap-3" : ""}>
          <dt className="t-label text-[0.625rem] text-fog-500">{label(k)}</dt>
          <dd className={depth ? "min-w-0 text-sm text-fog-100" : "mt-1 min-w-0 text-sm text-fog-100"}><Requirements value={v} depth={depth + 1} /></dd>
        </div>
      ))}
    </dl>
  );
}

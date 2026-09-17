import type { ReactNode } from "react";
import type { TableName, Tables } from "@/lib/backend/db-types";
import type { Column } from "../ui";

export type Values = Record<string, unknown>;

type Base = {
  name: string;
  label: string;
  hint?: ReactNode;
  required?: boolean;
  /** span both columns of the form grid */
  wide?: boolean;
  showIf?: (v: Values) => boolean;
  /** extra rule for this field; return a message or null */
  check?: (value: unknown, all: Values) => string | null;
};

export type FieldDef = Base & (
  | { type: "text"; max?: number; placeholder?: string; input?: "text" | "url" | "email" | "tel"; pattern?: RegExp; patternMessage?: string }
  | { type: "textarea"; rows?: number; max?: number; mono?: boolean; placeholder?: string }
  | { type: "number"; min?: number; max?: number; step?: number; integer?: boolean; suffix?: string }
  | { type: "select"; options: readonly { value: string; label: string }[]; placeholder?: string }
  | { type: "toggle"; onLabel?: string; offLabel?: string }
  | { type: "tags"; suggestions?: readonly string[]; max?: number; placeholder?: string }
  | { type: "slug"; from: string; column?: string; prefix?: string }
  | { type: "date"; withTime?: boolean }
  | { type: "colour" }
  | { type: "keyvalue"; keyLabel?: string; valueLabel?: string }
  | { type: "media"; imagesOnly?: boolean; category?: string }
  | { type: "relation"; table: TableName; valueField?: string; labelField?: string; hintField?: string; multiple?: boolean }
  | { type: "custom"; render: (p: { value: unknown; onChange: (v: unknown) => void; values: Values; error: string | null; disabled: boolean }) => ReactNode }
);

export type FieldGroup = { title: string; note?: ReactNode; fields: FieldDef[] };

export type ResourceConfig<K extends TableName> = {
  table: K;
  singular: string;
  plural: string;
  /** canDo() domain that may write. RLS is the real gate; this only hides controls. */
  cap: string | string[];
  /** publish_status column ("status", or "publish" on billboards); omit for tables without one */
  statusField?: "status" | "publish";
  /** table has publish_at → offer scheduling */
  schedulable?: boolean;
  /** column holding a manual order; enables move up/down */
  sortField?: string;
  order: { column: string; ascending?: boolean }[];
  search: (row: Tables[K]) => string;
  titleOf: (row: Tables[K]) => string;
  columns: Column<Tables[K]>[];
  groups: FieldGroup[];
  defaults: () => Values;
  /** cross-field rules → { fieldName: message } */
  validate?: (v: Values) => Record<string, string>;
  /** last-moment normalisation before insert/update */
  beforeSave?: (v: Values, ctx: { isNew: boolean; userId: string | null }) => Values;
  /** fields reset when duplicating (slug gets "-copy", status returns to draft automatically) */
  duplicateOmit?: string[];
  /** shown above the list: what this content is and where it appears */
  intro?: ReactNode;
  /** extra read-only content at the top of the editor (previews, links) */
  aside?: (row: Tables[K] | null, values: Values) => ReactNode;
  /** false → archive only (no hard delete offered) */
  deletable?: boolean;
  /** query-string keys, so several managers can share a page */
  idKey?: string;
  newKey?: string;
};

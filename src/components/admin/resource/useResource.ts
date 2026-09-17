"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { backend } from "@/lib/backend/client";
import type { TableName, Tables } from "@/lib/backend/db-types";
import { adminError } from "./errors";
import type { Values } from "./types";

type Opts = { select?: string; order: { column: string; ascending?: boolean }[]; singular: string; filter?: { column: string; value: string } };

/**
 * List + optimistic create / update / remove for one table. The UI changes
 * first; if the database (RLS, constraints) refuses, the change is rolled back
 * and the reason is toasted.
 */
export function useResource<K extends TableName>(table: K, opts: Opts) {
  type Row = Tables[K] & { id: string };
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const optsRef = useRef(opts);
  const rowsRef = useRef<Row[] | null>(null);
  useEffect(() => { optsRef.current = opts; rowsRef.current = rows; });
  const orderKey = JSON.stringify(opts.order);
  const filterKey = opts.filter ? `${opts.filter.column}=${opts.filter.value}` : "";

  const load = useCallback(async () => {
    const o = optsRef.current;
    let q = backend()!.from(table).select(o.select ?? "*");
    if (o.filter) q = q.eq(o.filter.column, o.filter.value);
    for (const ord of o.order) q = q.order(ord.column, { ascending: ord.ascending ?? true });
    const r = await q.limit(2000);
    if (r.error) setError(adminError(r.error));
    else { setRows(r.data as unknown as Row[]); setError(null); }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, orderKey, filterKey]);
  useEffect(() => { void load(); }, [load]);
  const reload = useCallback(() => { setLoading(true); return load(); }, [load]);

  const create = useCallback(async (values: Values, o: { quiet?: boolean } = {}): Promise<Row | null> => {
    const tmp = `tmp-${crypto.randomUUID()}`;
    setSaving(true);
    setRows((rs) => [{ ...(values as unknown as Row), id: tmp }, ...(rs ?? [])]);
    const r = await backend()!.from(table).insert(values).select(optsRef.current.select ?? "*").single();
    setSaving(false);
    if (r.error) { setRows((rs) => rs?.filter((x) => x.id !== tmp) ?? null); toast(adminError(r.error), "danger"); return null; }
    const row = r.data as unknown as Row;
    setRows((rs) => rs?.map((x) => (x.id === tmp ? row : x)) ?? [row]);
    if (!o.quiet) toast(`${optsRef.current.singular} created.`, "ok");
    return row;
  }, [table, toast]);

  const update = useCallback(async (id: string, patch: Values, o: { quiet?: boolean; message?: string } = {}): Promise<Row | null> => {
    const before = rowsRef.current?.find((x) => x.id === id);
    setSaving(true);
    setRows((rs) => rs?.map((x) => (x.id === id ? { ...x, ...(patch as Partial<Row>) } : x)) ?? null);
    const r = await backend()!.from(table).update(patch).eq("id", id).select(optsRef.current.select ?? "*").maybeSingle();
    setSaving(false);
    const refused = !r.error && !r.data; // RLS filtered the row out: nothing was updated
    if (r.error || refused) {
      setRows((rs) => rs?.map((x) => (x.id === id && before ? before : x)) ?? null);
      toast(refused ? "You do not have permission to change that." : adminError(r.error), "danger");
      return null;
    }
    const row = r.data as unknown as Row;
    setRows((rs) => rs?.map((x) => (x.id === id ? row : x)) ?? null);
    if (!o.quiet) toast(o.message ?? `${optsRef.current.singular} saved.`, "ok");
    return row;
  }, [table, toast]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    const gone = rowsRef.current?.find((x) => x.id === id);
    const at = rowsRef.current?.findIndex((x) => x.id === id) ?? 0;
    setRows((rs) => rs?.filter((x) => x.id !== id) ?? null);
    const r = await backend()!.from(table).delete().eq("id", id).select("id");
    const refused = !r.error && (r.data?.length ?? 0) === 0;
    if (r.error || refused) { if (gone) setRows((rs) => { const n = [...(rs ?? [])]; n.splice(Math.max(at, 0), 0, gone); return n; }); toast(refused ? "You do not have permission to delete that." : adminError(r.error), "danger"); return false; }
    toast(`${optsRef.current.singular} deleted.`, "ok");
    return true;
  }, [table, toast]);

  return { rows, loading, error, saving, reload, create, update, remove, setRows };
}

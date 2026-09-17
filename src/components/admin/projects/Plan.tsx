"use client";
import { clsx } from "clsx";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useQuery } from "@/lib/backend/hooks";
import type { ProjectMilestonesRow, ProjectTasksRow } from "@/lib/backend/db-types";
import { db, daysUntil, exec, useOptimistic, write, type StaffMember } from "../ops/data";
import { Confirm, DueTag, SectionTitle } from "../ops/parts";
import { adminInput, ErrorNote } from "../ui";

const small = "min-h-9 border border-ink-600 bg-ink-950 px-2 text-xs text-fog-100 focus:border-yellow focus:outline-none";
type Doomed = { table: "project_milestones" | "project_tasks"; id: string; title: string } | null;

/** Milestones and tasks. Ticking is optimistic; a refused write rolls back and says why. */
export function Plan({ projectId, staff, now }: { projectId: string; staff: StaffMember[]; now: number }) {
  const toast = useToast();
  const ms = useQuery<ProjectMilestonesRow[]>(() => db().from("project_milestones").select("*").eq("project_id", projectId).order("sort").order("due_on"), [projectId]);
  const ts = useQuery<ProjectTasksRow[]>(() => db().from("project_tasks").select("*").eq("project_id", projectId).order("sort").order("due_on"), [projectId]);
  const mo = useOptimistic(ms.data), to = useOptimistic(ts.data);
  const [m, setM] = useState({ title: "", due: "" });
  const [t, setT] = useState({ title: "", milestone: "", assignee: "", due: "" });
  const [doomed, setDoomed] = useState<Doomed>(null);
  const [busy, setBusy] = useState(false);

  const patchRow = async <R extends { id: string }>(table: "project_milestones" | "project_tasks", o: { patch: (id: string, p: Partial<R>) => void; clear: (id: string) => void }, reload: () => Promise<void>, id: string, p: Partial<R>) => {
    o.patch(id, p);
    const r = await write(db().from(table).update(p as Record<string, unknown>).eq("id", id).select("id"));
    if (r.error) { o.clear(id); return toast(r.error, "danger"); }
    await reload(); o.clear(id);
  };
  const setMilestone = (id: string, p: Partial<ProjectMilestonesRow>) => void patchRow("project_milestones", mo, ms.reload, id, p);
  const setTask = (id: string, p: Partial<ProjectTasksRow>) => void patchRow("project_tasks", to, ts.reload, id, p);

  const addMilestone = async () => {
    if (m.title.trim().length < 2) return;
    const r = await exec(db().from("project_milestones").insert({ project_id: projectId, title: m.title.trim(), due_on: m.due || null, sort: (ms.data?.length ?? 0) + 1 }));
    if (r.error) return toast(r.error, "danger");
    setM({ title: "", due: "" }); void ms.reload();
  };
  const addTask = async () => {
    if (t.title.trim().length < 2) return;
    const r = await exec(db().from("project_tasks").insert({ project_id: projectId, title: t.title.trim(), milestone_id: t.milestone || null, assignee: t.assignee || null, due_on: t.due || null, sort: (ts.data?.length ?? 0) + 1 }));
    if (r.error) return toast(r.error, "danger");
    setT((s) => ({ ...s, title: "", due: "" })); void ts.reload();
  };
  const remove = async () => {
    if (!doomed) return;
    setBusy(true);
    const r = await write(db().from(doomed.table).delete().eq("id", doomed.id).select("id"));
    setBusy(false); setDoomed(null);
    if (r.error) return toast(r.error, "danger");
    toast("Removed.", "ok"); void ms.reload(); void ts.reload();
  };

  const taskRow = (k: ProjectTasksRow) => (
    <li key={k.id} className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 border-b border-ink-800 py-2 last:border-0 sm:grid-cols-[auto_1fr_9rem_8.5rem_auto]">
      <input type="checkbox" aria-label={`Done: ${k.title}`} checked={Boolean(k.done_at)} onChange={(e) => setTask(k.id, { done_at: e.target.checked ? new Date().toISOString() : null })} className="h-4 w-4 accent-[var(--color-yellow)]" />
      <span className={clsx("min-w-0 text-sm", k.done_at ? "text-fog-500 line-through" : "text-fog-100")}>{k.title} {!k.done_at && k.due_on && <DueTag days={daysUntil(k.due_on, now)} />}</span>
      <select aria-label={`Assignee for ${k.title}`} value={k.assignee ?? ""} onChange={(e) => setTask(k.id, { assignee: e.target.value || null })} className={clsx(small, "col-start-2 sm:col-start-auto")}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}</select>
      <input type="date" aria-label={`Due date for ${k.title}`} value={k.due_on ?? ""} onChange={(e) => setTask(k.id, { due_on: e.target.value || null })} className={clsx(small, "col-start-2 sm:col-start-auto")} />
      <button type="button" onClick={() => setDoomed({ table: "project_tasks", id: k.id, title: k.title })} className="t-label col-start-2 min-h-9 justify-self-start px-1 text-[0.5625rem] text-fog-500 hover:text-danger sm:col-start-auto">Delete</button>
    </li>
  );
  const tasks = to.rows ?? [];
  const loose = tasks.filter((k) => !k.milestone_id || !mo.rows?.some((x) => x.id === k.milestone_id));
  const doneCount = tasks.filter((k) => k.done_at).length;

  return (
    <section aria-label="Milestones and tasks">
      <SectionTitle action={tasks.length > 0 && <span className="t-data text-xs text-fog-400">{doneCount}/{tasks.length} tasks done</span>}>Milestones &amp; tasks</SectionTitle>
      <ErrorNote message={ms.error ?? ts.error} onRetry={() => { void ms.reload(); void ts.reload(); }} />
      {(ms.loading && !ms.data) || (ts.loading && !ts.data) ? <div className="skeleton h-20" /> : null}
      <ol className="flex flex-col gap-3">
        {mo.rows?.map((x) => (
          <li key={x.id} className="border border-ink-700 bg-ink-950">
            <div className="flex flex-wrap items-center gap-3 border-b border-ink-700 px-3 py-2">
              <input type="checkbox" aria-label={`Milestone reached: ${x.title}`} checked={Boolean(x.done_at)} onChange={(e) => setMilestone(x.id, { done_at: e.target.checked ? new Date().toISOString() : null })} className="h-4 w-4 accent-[var(--color-yellow)]" />
              <p className={clsx("min-w-0 flex-1 text-sm font-medium", x.done_at ? "text-fog-500 line-through" : "text-fog-50")}>{x.title}</p>
              {!x.done_at && x.due_on && <DueTag days={daysUntil(x.due_on, now)} />}
              <input type="date" aria-label={`Due date for milestone ${x.title}`} value={x.due_on ?? ""} onChange={(e) => setMilestone(x.id, { due_on: e.target.value || null })} className={small} />
              <button type="button" onClick={() => setDoomed({ table: "project_milestones", id: x.id, title: x.title })} className="t-label min-h-9 px-1 text-[0.5625rem] text-fog-500 hover:text-danger">Delete</button>
            </div>
            <ul className="px-3">{tasks.filter((k) => k.milestone_id === x.id).map(taskRow)}{!tasks.some((k) => k.milestone_id === x.id) && <li className="py-2 text-xs text-fog-500">No tasks under this milestone.</li>}</ul>
          </li>
        ))}
      </ol>
      {loose.length > 0 && <div className="mt-3 border border-ink-700 bg-ink-950 px-3"><p className="t-label border-b border-ink-700 py-2 text-[0.625rem] text-fog-500">Tasks without a milestone</p><ul>{loose.map(taskRow)}</ul></div>}
      {ms.data?.length === 0 && ts.data?.length === 0 && <p className="text-sm text-fog-500">No plan yet. Add the first milestone or task below.</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <form onSubmit={(e) => { e.preventDefault(); void addMilestone(); }} className="flex flex-col gap-2 border border-ink-700 p-3">
          <p className="t-label text-[0.625rem] text-fog-500">Add milestone</p>
          <input aria-label="Milestone title" value={m.title} onChange={(e) => setM((s) => ({ ...s, title: e.target.value }))} placeholder="e.g. Artwork signed off" className={adminInput} />
          <div className="flex gap-2"><input type="date" aria-label="Milestone due date" value={m.due} onChange={(e) => setM((s) => ({ ...s, due: e.target.value }))} className={adminInput} /><button type="submit" disabled={m.title.trim().length < 2} className="t-label min-h-10 flex-none border border-ink-500 px-3 text-[0.625rem] text-fog-50 hover:border-yellow hover:text-yellow disabled:opacity-40">Add</button></div>
        </form>
        <form onSubmit={(e) => { e.preventDefault(); void addTask(); }} className="flex flex-col gap-2 border border-ink-700 p-3">
          <p className="t-label text-[0.625rem] text-fog-500">Add task</p>
          <input aria-label="Task title" value={t.title} onChange={(e) => setT((s) => ({ ...s, title: e.target.value }))} placeholder="e.g. Send proof to customer" className={adminInput} />
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Milestone" value={t.milestone} onChange={(e) => setT((s) => ({ ...s, milestone: e.target.value }))} className={adminInput}><option value="">No milestone</option>{ms.data?.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select>
            <select aria-label="Assignee" value={t.assignee} onChange={(e) => setT((s) => ({ ...s, assignee: e.target.value }))} className={adminInput}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}</select>
          </div>
          <div className="flex gap-2"><input type="date" aria-label="Task due date" value={t.due} onChange={(e) => setT((s) => ({ ...s, due: e.target.value }))} className={adminInput} /><button type="submit" disabled={t.title.trim().length < 2} className="t-label min-h-10 flex-none border border-ink-500 px-3 text-[0.625rem] text-fog-50 hover:border-yellow hover:text-yellow disabled:opacity-40">Add</button></div>
        </form>
      </div>
      <Confirm open={Boolean(doomed)} danger title="Delete this item?" confirmLabel="Delete" pending={busy} onClose={() => setDoomed(null)} onConfirm={() => void remove()} body={<>“{doomed?.title}” will be removed from the plan.{doomed?.table === "project_milestones" ? " Its tasks are kept and move to “without a milestone”." : ""}</>} />
    </section>
  );
}

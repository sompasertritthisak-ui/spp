"use client";
import { Suspense, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { db, daysUntil, useNow, useStaff, useUrlState } from "@/components/admin/ops/data";
import { DueTag, NoAccess, SearchBox } from "@/components/admin/ops/parts";
import { NewProjectDialog } from "@/components/admin/projects/NewProjectDialog";
import { ProjectDrawer } from "@/components/admin/projects/ProjectDrawer";
import { STAGES, type Project } from "@/components/admin/projects/shared";
import { DataTable, ErrorNote, PageHeader, StatusPill, Tabs, type Column } from "@/components/admin/ui";
import { canDo, useAuth } from "@/lib/backend/auth";
import { useQuery } from "@/lib/backend/hooks";
import { relativeTime, titleCase } from "@/lib/format";

function Projects() {
  const { profile } = useAuth();
  const url = useUrlState();
  const now = useNow();
  const { staff, name } = useStaff();
  const canSales = canDo(profile?.role, "sales");
  const canRead = canSales || canDo(profile?.role, "production");
  const [search, setSearch] = useState("");
  const stage = url.get("stage") ?? "open";
  const q = useQuery<Project[]>(() => db().from("projects").select("*").order("updated_at", { ascending: false }).limit(1000), [], { enabled: canRead });
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return q.data?.filter((p) => (stage === "all" ? true : stage === "open" ? p.stage !== "completion" : stage === "blocked" ? Boolean(p.blocked_reason) : p.stage === stage) && (!term || `${p.name} ${p.ref}`.toLowerCase().includes(term))) ?? null;
  }, [q.data, stage, search]);

  if (!canRead) return <><PageHeader title="Projects" /><NoAccess what="projects" /></>;
  const count = (f: (p: Project) => boolean) => (q.data ? q.data.filter(f).length : null);
  const columns: Column<Project>[] = [
    { key: "name", header: "Project", cell: (p) => <span className="block min-w-48"><span className="block font-medium text-fog-50">{p.name}</span><span className="t-data block text-xs text-fog-400">{p.ref}</span></span> },
    { key: "stage", header: "Stage", cell: (p) => <span className="flex flex-wrap items-center gap-1"><span className="t-data text-[0.625rem] text-fog-500">{String(STAGES.indexOf(p.stage) + 1).padStart(2, "0")}/08</span><StatusPill status={p.stage} />{p.blocked_reason && <StatusPill status="blocked" />}</span> },
    { key: "due", header: "Due", hideBelow: "sm", cell: (p) => <DueTag days={daysUntil(p.due_on, now)} done={p.stage === "completion"} /> },
    { key: "owner", header: "Owner", hideBelow: "md", cell: (p) => <span className="text-fog-300">{name(p.owner_staff)}</span> },
    { key: "upd", header: "Updated", hideBelow: "lg", cell: (p) => <span className="t-data text-xs text-fog-400">{relativeTime(p.updated_at)}</span> },
  ];
  return (
    <>
      <PageHeader title="Projects" sub="Multi-part work, from discovery to completion — plan, files, conversation and commercial links in one place." actions={canSales && <Button size="sm" onClick={() => url.set({ new: "1" })}>New project</Button>} />
      <Tabs label="Project stage" value={stage} onChange={(v) => url.set({ stage: v === "open" ? null : v })} tabs={[{ value: "open", label: "Open", count: count((p) => p.stage !== "completion") }, { value: "blocked", label: "Blocked", count: count((p) => Boolean(p.blocked_reason)) }, ...STAGES.map((s) => ({ value: s as string, label: titleCase(s), count: count((p) => p.stage === s) })), { value: "all", label: "All", count: q.data?.length ?? null }]} />
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      <div className="border border-ink-700 bg-ink-900">
        <div className="border-b border-ink-700 p-3"><SearchBox value={search} onChange={setSearch} label="Search projects" placeholder="Project name or ref…" /></div>
        <DataTable caption="Projects" rows={rows} columns={columns} rowKey={(p) => p.id} onRowClick={(p) => url.set({ id: p.id })} loading={q.loading} empty={search ? "No projects match that search." : "No projects in this view. Projects start from the project builder, a converted consultation, or “New project”."} />
      </div>
      <ProjectDrawer id={url.get("id")} staff={staff} canSales={canSales} now={now} onClose={() => url.set({ id: null })} onChanged={() => void q.reload()} />
      {canSales && url.get("new") === "1" && <NewProjectDialog open leadId={url.get("lead")} onClose={() => url.set({ new: null, lead: null })} onCreated={(id) => { url.set({ new: null, lead: null, id }); void q.reload(); }} />}
    </>
  );
}

export default function ProjectsPage() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Projects /></Suspense>;
}

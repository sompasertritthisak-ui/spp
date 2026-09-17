"use client";
import { Check } from "lucide-react";
import { ErrorNote, Meta, StatusPill } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireBackend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { formatDate } from "@/lib/format";
import { MessagesThread } from "../MessagesThread";
import { usePortal } from "../PortalShell";
import { Block, PortalHeader, RowsSkeleton, Stepper } from "../ui";
import { ProjectFiles } from "./ProjectFiles";
import { PROJECT_COLS, PROJECT_STEPS, STAGE_NOTE, type Milestone, type ProjectLite } from "./shared";

type Loaded = { project: ProjectLite | null; milestones: Milestone[] };

export function ProjectDetail({ id }: { id: string }) {
  const { uid } = usePortal();
  const q = useQuery<Loaded>(async () => {
    const b = requireBackend();
    const [project, milestones] = await Promise.all([
      b.from("projects").select(PROJECT_COLS).eq("id", id).eq("customer_id", uid).maybeSingle(),
      b.from("project_milestones").select("id,title,due_on,done_at,sort").eq("project_id", id).order("sort").order("due_on"),
    ]);
    const err = project.error ?? milestones.error;
    if (err) return { data: null, error: err };
    return { data: { project: project.data as ProjectLite | null, milestones: (milestones.data ?? []) as Milestone[] }, error: null };
  }, [id, uid]);

  const back = { href: "/account/projects/", label: "All projects" };
  if (q.loading && !q.data) return <><PortalHeader title="Project" back={back} /><RowsSkeleton rows={4} tall /></>;
  if (q.error) return <><PortalHeader title="Project" back={back} /><ErrorNote message={q.error} onRetry={q.reload} /></>;
  const p = q.data?.project;
  if (!p || !q.data) return <><PortalHeader title="Project not found" back={back} /><EmptyState title="We could not find that project." body="It may belong to a different account, or the link may be incomplete." action={<Button href="/account/projects/" variant="outline">All projects</Button>} /></>;

  const done = q.data.milestones.filter((m) => m.done_at).length;
  return (
    <>
      <PortalHeader title={p.name || "Untitled project"} back={back} sub={<span className="flex flex-wrap items-center gap-3"><StatusPill status={p.stage} /><span className="t-data">{p.ref}</span>{p.due_on && <span>Due {formatDate(p.due_on)}</span>}</span>} />

      <section aria-label="Project stage" className="mb-10 border border-ink-700 bg-ink-900 p-5">
        <Stepper steps={PROJECT_STEPS} current={p.stage} label={`Project ${p.ref}`} />
        <p className="mt-4 text-fog-100">{STAGE_NOTE[p.stage]}</p>
      </section>

      {(p.objective || p.scope) && (
        <Block title="Brief">
          <Meta items={[...(p.objective ? [{ label: "Objective", value: <span className="whitespace-pre-wrap">{p.objective}</span> }] : []), ...(p.scope ? [{ label: "Scope", value: <span className="whitespace-pre-wrap">{p.scope}</span> }] : [])]} />
        </Block>
      )}

      <Block title={`Milestones${q.data.milestones.length ? ` · ${done} of ${q.data.milestones.length} done` : ""}`}>
        {q.data.milestones.length === 0 ? <p className="border border-dashed border-ink-600 p-5 text-fog-400">SPP has not set milestones for this project yet. They appear here as soon as the plan is agreed.</p> : (
          <ol className="border-t border-ink-700">
            {q.data.milestones.map((m, i) => (
              <li key={m.id} className="flex items-center gap-4 border-b border-ink-700 py-3">
                <span aria-hidden className={`flex h-6 w-6 flex-none items-center justify-center border ${m.done_at ? "border-ok bg-ok text-ink-950" : "border-ink-500 text-fog-500"}`}>{m.done_at ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : <span className="t-data text-[0.625rem]">{i + 1}</span>}</span>
                <span className={`min-w-0 flex-1 break-words ${m.done_at ? "text-fog-400" : "text-fog-50"}`}>{m.title}</span>
                <span className="t-data flex-none text-right text-xs text-fog-400">{m.done_at ? `Done ${formatDate(m.done_at)}` : m.due_on ? `Due ${formatDate(m.due_on)}` : "No date yet"}</span>
              </li>
            ))}
          </ol>
        )}
      </Block>

      <ProjectFiles projectId={p.id} />
      <MessagesThread entity="project" entityId={p.id} refLabel={p.ref} />
    </>
  );
}

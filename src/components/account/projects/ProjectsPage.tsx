"use client";
import { useSearchParams } from "next/navigation";
import { ErrorNote, StatusPill } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireBackend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { formatDate } from "@/lib/format";
import { usePortal } from "../PortalShell";
import { PortalHeader, RowLink, RowsSkeleton } from "../ui";
import { ProjectDetail } from "./ProjectDetail";
import { PROJECT_COLS, stageLabel, type ProjectLite } from "./shared";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ProjectsPage() {
  const id = useSearchParams().get("id");
  return id && UUID.test(id) ? <ProjectDetail key={id} id={id} /> : <ProjectList />;
}

function ProjectList() {
  const { uid } = usePortal();
  const q = useQuery<ProjectLite[]>(() => requireBackend().from("projects").select(PROJECT_COLS).eq("customer_id", uid).order("created_at", { ascending: false }).limit(100), [uid]);
  return (
    <>
      <PortalHeader title="My Projects" sub="Larger jobs SPP is running with you — signage, fit-outs, campaigns — with the current stage, milestones, files and the conversation in one place." />
      <ErrorNote message={q.error} onRetry={q.reload} />
      {q.loading && !q.data ? <RowsSkeleton rows={4} /> : q.data?.length === 0 ? (
        <EmptyState title="No projects yet." body="Projects begin with a conversation. Describe what you need in the project builder, or book a consultation and SPP will scope it with you." action={<div className="flex flex-wrap gap-3"><Button href="/request-quote/" arrow>Start a project</Button><Button href="/consultation/" variant="outline">Let&apos;s talk</Button></div>} />
      ) : (
        <ul className="border-t border-ink-700">
          {q.data?.map((p) => (
            <li key={p.id}>
              <RowLink href={`/account/projects/?id=${p.id}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-fog-50">{p.name || "Untitled project"}</span>
                  <span className="t-data block truncate text-sm text-fog-400">{p.ref} · started {formatDate(p.created_at)}{p.due_on ? ` · due ${formatDate(p.due_on)}` : ""}</span>
                </span>
                <span className="hidden text-sm text-fog-400 sm:block">{stageLabel(p.stage)}</span>
                <StatusPill status={p.stage} />
              </RowLink>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

"use client";
import { Download } from "lucide-react";
import { useRef, useState } from "react";
import { ErrorNote } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { track } from "@/lib/backend/analytics";
import type { AttachmentsRow } from "@/lib/backend/db-types";
import { BackendError, requireBackend, toBackendError } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { formatDate } from "@/lib/format";
import { usePortal } from "../PortalShell";
import { downloadPrivate, formatBytes } from "../storage";
import { Block, RowsSkeleton } from "../ui";
import { acceptAttr, ALL_ARTWORK, prepareUpload, removePrivate, uploadPrivate } from "../uploads";

type FileRow = Pick<AttachmentsRow, "id" | "owner_id" | "path" | "file_name" | "mime" | "bytes" | "created_at">;

/** Customer-visible files on a project. Internal attachments are filtered out by RLS before they reach the browser. */
export function ProjectFiles({ projectId }: { projectId: string }) {
  const { uid } = usePortal();
  const toast = useToast();
  const q = useQuery<FileRow[]>(() => requireBackend().from("attachments").select("id,owner_id,path,file_name,mime,bytes,created_at").eq("entity", "project").eq("entity_id", projectId).eq("internal", false).order("created_at", { ascending: false }), [projectId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    let path: string | null = null;
    try {
      const up = await prepareUpload(file);
      path = await uploadPrivate(uid, up);
      const { error: err } = await requireBackend().from("attachments").insert({ entity: "project", entity_id: projectId, owner_id: uid, path, file_name: up.fileName, mime: up.mime, bytes: up.bytes, internal: false });
      if (err) throw toBackendError(err);
      track("artwork_uploaded", { step: "project_file" });
      toast("File shared with SPP.", "ok");
      void q.reload();
    } catch (e) {
      if (path) void removePrivate([path]);
      setError(e instanceof BackendError ? e.message : "We could not upload that file. Please try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const save = async (f: FileRow) => {
    try { await downloadPrivate(f.path, f.file_name); } catch (e) { toast(e instanceof BackendError ? e.message : "We could not prepare that download.", "danger"); }
  };

  return (
    <Block title="Files" action={<><input ref={input} type="file" accept={acceptAttr(ALL_ARTWORK)} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void upload(e.target.files?.[0])} /><Button size="sm" variant="outline" loading={busy} onClick={() => input.current?.click()}>Upload artwork</Button></>}>
      <FormError message={error} />
      <ErrorNote message={q.error} onRetry={q.reload} />
      {q.loading && !q.data ? <RowsSkeleton rows={2} /> : q.data?.length === 0 ? (
        <p className="border border-dashed border-gold/40 p-5 text-fog-400">No files yet. Upload briefs, site photos, logos or artwork (PNG, JPG, WEBP, SVG or PDF, up to 25 MB) and the SPP project team will see them straight away.</p>
      ) : (
        <ul className="border-t border-gold/25">
          {q.data?.map((f) => (
            <li key={f.id} className="flex items-center gap-4 border-b border-ink-700 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-fog-50" title={f.file_name}>{f.file_name}</p>
                <p className="t-data text-xs text-fog-500">{f.owner_id === uid ? "Uploaded by you" : "From SPP"} · {formatBytes(f.bytes)} · {formatDate(f.created_at)}</p>
              </div>
              <button type="button" onClick={() => void save(f)} aria-label={`Download ${f.file_name}`} className="t-label flex min-h-11 flex-none items-center gap-2 px-3 text-fog-300 hover:text-yellow"><Download aria-hidden className="h-3.5 w-3.5" strokeWidth={1.5} /><span className="hidden sm:inline">Download</span></button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm text-fog-500">Files are private to you and the SPP team. Once shared they stay on the project record; ask SPP if one needs removing.</p>
    </Block>
  );
}

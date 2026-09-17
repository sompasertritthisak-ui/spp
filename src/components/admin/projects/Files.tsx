"use client";
import { useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/backend/auth";
import { useQuery } from "@/lib/backend/hooks";
import type { AttachmentsRow } from "@/lib/backend/db-types";
import { formatDate } from "@/lib/format";
import { db, exec } from "../ops/data";
import { SectionTitle } from "../ops/parts";
import { ErrorNote } from "../ui";

const BUCKET = "private-artwork";
const OK_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "application/pdf"];
const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Project files live in the private bucket under the uploader's own folder (the storage policy requires it). */
export function ProjectFiles({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const q = useQuery<AttachmentsRow[]>(() => db().from("attachments").select("*").eq("entity", "project").eq("entity_id", projectId).order("created_at", { ascending: false }), [projectId]);

  const open = async (a: AttachmentsRow) => {
    const { data, error } = await db().storage.from(BUCKET).createSignedUrl(a.path, 300, { download: a.file_name });
    if (error || !data?.signedUrl) return toast("That file could not be opened. Your role may not have access to private files.", "danger");
    window.open(data.signedUrl, "_blank", "noopener");
  };
  const upload = async (file: File | undefined) => {
    if (!file || !user) return;
    if (!OK_TYPES.includes(file.type)) return toast("Upload a PNG, JPG, WebP, SVG or PDF.", "danger");
    if (file.size > 25 * 1048576) return toast("Files must be 25 MB or smaller.", "danger");
    setBusy(true);
    const path = `${user.id}/${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"}`;
    const up = await db().storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { setBusy(false); return toast("The upload failed. Check your connection and try again.", "danger"); }
    const r = await exec(db().from("attachments").insert({ entity: "project", entity_id: projectId, owner_id: user.id, path, file_name: file.name.slice(0, 200), mime: file.type, bytes: file.size, internal: true }));
    setBusy(false);
    if (input.current) input.current.value = "";
    if (r.error) return toast(r.error, "danger");
    toast("File attached.", "ok"); void q.reload();
  };

  return (
    <section aria-label="Files">
      <SectionTitle>Files</SectionTitle>
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      <ul>
        {q.loading && !q.data && <li className="skeleton h-10" />}
        {q.data?.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink-800 py-2 text-sm last:border-0">
            <button type="button" onClick={() => void open(a)} className="min-w-0 truncate text-left text-fog-50 underline decoration-ink-500 underline-offset-4 hover:decoration-yellow">{a.file_name}</button>
            <span className="t-label border border-ink-600 px-1.5 py-0.5 text-[0.5625rem] text-fog-400">{a.internal ? "Internal" : "From customer"}</span>
            <span className="t-data ml-auto text-xs text-fog-500">{kb(a.bytes)} · {formatDate(a.created_at)}</span>
          </li>
        ))}
        {q.data?.length === 0 && <li className="py-2 text-sm text-fog-500">No files attached.</li>}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input ref={input} type="file" aria-label="Attach a file" accept={OK_TYPES.join(",")} disabled={busy} onChange={(e) => void upload(e.target.files?.[0])} className="max-w-full text-xs text-fog-400 file:mr-3 file:min-h-9 file:border file:border-ink-500 file:bg-transparent file:px-3 file:font-mono file:text-[0.625rem] file:uppercase file:tracking-widest file:text-fog-50" />
        <span className="text-xs text-fog-500">Staff uploads are internal — customers never see them.</span>
        {busy && <span className="text-xs text-fog-500" aria-live="polite">Uploading…</span>}
      </div>
    </section>
  );
}

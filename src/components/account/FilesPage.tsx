"use client";
import Link from "next/link";
import { Download } from "lucide-react";
import { useState } from "react";
import { ErrorNote, Tabs } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { BackendError, requireBackend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { formatDate, titleCase } from "@/lib/format";
import { usePortal } from "./PortalShell";
import { downloadPrivate, formatBytes } from "./storage";
import { PortalHeader, RowsSkeleton } from "./ui";

type Source = "brand" | "design" | "shared";
type FileRow = { key: string; source: Source; path: string; file_name: string; mime: string; bytes: number; created_at: string; context: string; href: string };
const SOURCE_LABEL: Record<Source, string> = { brand: "Brand library", design: "Design artwork", shared: "Shared with SPP" };

async function load(uid: string): Promise<FileRow[]> {
  const b = requireBackend();
  const cols = "id,path,file_name,mime,bytes,created_at";
  const [brand, design, shared] = await Promise.all([
    b.from("brand_assets").select(`${cols},kind`).eq("owner_id", uid),
    b.from("design_assets").select(`${cols},design_id,designs(ref,name)`).eq("owner_id", uid),
    b.from("attachments").select(`${cols},entity,entity_id`).eq("owner_id", uid).eq("internal", false),
  ]);
  const failed = [brand, design, shared].find((r) => r.error);
  if (failed?.error) throw failed.error;
  const entityHref = (entity: string, id: string) => (entity === "project" || entity === "quote" || entity === "order" ? `/account/${entity}s/?id=${id}` : "/account/files/");
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
  return [
    ...(brand.data ?? []).map((r): FileRow => ({ key: `b-${r.id}`, source: "brand", path: r.path, file_name: r.file_name, mime: r.mime, bytes: r.bytes, created_at: r.created_at, context: titleCase(String(r.kind)), href: "/account/brand/" })),
    ...(design.data ?? []).map((r): FileRow => {
      const d = one(r.designs as { ref: string; name: string } | { ref: string; name: string }[] | null);
      return { key: `d-${r.id}`, source: "design", path: r.path, file_name: r.file_name, mime: r.mime, bytes: r.bytes, created_at: r.created_at, context: d ? `${d.ref} · ${d.name}` : "Not placed on a design", href: r.design_id ? `/design/?id=${r.design_id}` : "/account/designs/" };
    }),
    ...(shared.data ?? []).map((r): FileRow => ({ key: `a-${r.id}`, source: "shared", path: r.path, file_name: r.file_name, mime: r.mime, bytes: r.bytes, created_at: r.created_at, context: titleCase(String(r.entity)), href: entityHref(String(r.entity), String(r.entity_id)) })),
  ].sort((x, y) => y.created_at.localeCompare(x.created_at));
}

export function FilesPage() {
  const { uid } = usePortal();
  const toast = useToast();
  const q = useQuery<FileRow[]>(async () => {
    try { return { data: await load(uid), error: null }; } catch (e) { return { data: null, error: e }; }
  }, [uid]);
  const [filter, setFilter] = useState<"all" | Source>("all");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const files = q.data ?? [];
  const shown = filter === "all" ? files : files.filter((f) => f.source === filter);
  const count = (s: Source) => files.filter((f) => f.source === s).length;
  const total = files.reduce((n, f) => n + f.bytes, 0);

  const save = async (f: FileRow) => {
    setBusyKey(f.key);
    try { await downloadPrivate(f.path, f.file_name); } catch (e) { toast(e instanceof BackendError ? e.message : "We could not prepare that download.", "danger"); } finally { setBusyKey(null); }
  };

  return (
    <>
      <PortalHeader title="My Files" sub={files.length ? `${files.length} file${files.length === 1 ? "" : "s"} · ${formatBytes(total)}. Everything you have uploaded to SPP — private to you and the SPP team.` : "Everything you have uploaded to SPP — private to you and the SPP team."} />
      <ErrorNote message={q.error} onRetry={q.reload} />
      {q.loading && !q.data ? <RowsSkeleton rows={6} /> : files.length === 0 && !q.error ? (
        <EmptyState title="No files yet." body="Start with your logo in My Brand, or upload artwork while designing in SPP Studio. Every file you add is listed here for download." action={<div className="flex flex-wrap gap-3"><Button href="/account/brand/" arrow>Upload artwork</Button><Button href="/spp-studio/" variant="outline">Open SPP Studio</Button></div>} />
      ) : (
        <>
          <Tabs label="Filter files" value={filter} onChange={setFilter} tabs={[{ value: "all", label: "All", count: files.length }, { value: "brand", label: SOURCE_LABEL.brand, count: count("brand") }, { value: "design", label: SOURCE_LABEL.design, count: count("design") }, { value: "shared", label: SOURCE_LABEL.shared, count: count("shared") }]} />
          {shown.length === 0 ? <p className="border border-dashed border-ink-600 p-6 text-fog-400">No files in this view.</p> : (
            <ul className="border-t border-ink-700">
              {shown.map((f) => (
                <li key={f.key} className="flex items-center gap-4 border-b border-ink-700 py-3">
                  <span aria-hidden className="t-label hidden w-12 flex-none border border-ink-600 py-1 text-center text-[0.5625rem] text-fog-400 sm:block">{f.mime === "application/pdf" ? "PDF" : f.mime === "image/svg+xml" ? "SVG" : (f.mime.split("/")[1] ?? "file").toUpperCase().slice(0, 4)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-fog-50" title={f.file_name}>{f.file_name}</p>
                    <p className="truncate text-xs text-fog-500"><Link href={f.href} className="underline-offset-4 hover:text-yellow hover:underline">{SOURCE_LABEL[f.source]} · {f.context}</Link><span className="t-data"> · {formatBytes(f.bytes)} · {formatDate(f.created_at)}</span></p>
                  </div>
                  <button type="button" disabled={busyKey === f.key} onClick={() => void save(f)} aria-label={`Download ${f.file_name}`} className="t-label flex min-h-11 flex-none items-center gap-2 px-3 text-fog-300 hover:text-yellow disabled:opacity-40"><Download aria-hidden className="h-3.5 w-3.5" strokeWidth={1.5} /><span className="hidden sm:inline">Download</span></button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-sm text-fog-500">Download links are created when you click and expire after five minutes. Delete brand files in My Brand; design artwork is removed when you delete the design.</p>
        </>
      )}
    </>
  );
}

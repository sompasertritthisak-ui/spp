"use client";
import { Download, FileText, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { ErrorNote } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormError, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { track } from "@/lib/backend/analytics";
import type { BrandAssetsRow } from "@/lib/backend/db-types";
import { BackendError, requireBackend, toBackendError } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { formatDate } from "@/lib/format";
import { usePortal } from "../PortalShell";
import { downloadPrivate, formatBytes, useSignedUrls } from "../storage";
import { Block, GridSkeleton } from "../ui";
import { acceptAttr, ALL_ARTWORK, prepareUpload, removePrivate, uploadPrivate, type ArtworkMime } from "../uploads";

const KINDS = [
  { value: "logo", label: "Logo", allow: ALL_ARTWORK },
  { value: "alt_logo", label: "Alternate logo", allow: ALL_ARTWORK },
  { value: "guideline", label: "Guideline PDF", allow: ["application/pdf"] as ArtworkMime[] },
  { value: "image", label: "Approved imagery", allow: ["image/png", "image/jpeg", "image/webp"] as ArtworkMime[] },
  { value: "artwork", label: "Existing artwork", allow: ALL_ARTWORK },
] as const;
type Kind = (typeof KINDS)[number]["value"];
const kindLabel = (k: string) => KINDS.find((x) => x.value === k)?.label ?? k;

type Asset = Pick<BrandAssetsRow, "id" | "kind" | "path" | "file_name" | "mime" | "bytes" | "width" | "height" | "created_at">;

export function AssetLibrary() {
  const { uid } = usePortal();
  const toast = useToast();
  const q = useQuery<Asset[]>(() => requireBackend().from("brand_assets").select("id,kind,path,file_name,mime,bytes,width,height,created_at").eq("owner_id", uid).order("created_at", { ascending: false }), [uid]);
  const [kind, setKind] = useState<Kind>("logo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Asset | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const allow = KINDS.find((k) => k.value === kind)!.allow;

  const assets = useMemo(() => (q.data ?? []).filter((a) => !hidden.includes(a.id)), [q.data, hidden]);
  const url = useSignedUrls(useMemo(() => assets.filter((a) => a.mime.startsWith("image/")).map((a) => a.path), [assets]));

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    let path: string | null = null;
    try {
      const up = await prepareUpload(file, [...allow]);
      path = await uploadPrivate(uid, up);
      const { error: err } = await requireBackend().from("brand_assets").insert({ owner_id: uid, kind, path, file_name: up.fileName, mime: up.mime, bytes: up.bytes, width: up.width, height: up.height });
      if (err) throw toBackendError(err);
      track("artwork_uploaded", { step: `brand:${kind}` });
      toast(`${kindLabel(kind)} added to your library.`, "ok");
      void q.reload();
    } catch (e) {
      if (path) void removePrivate([path]); // never leave an orphaned object behind a failed row
      setError(e instanceof BackendError ? e.message : "We could not upload that file. Please try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async (a: Asset) => {
    setRemoving(null);
    setHidden((h) => [...h, a.id]); // optimistic
    const { error: err } = await requireBackend().from("brand_assets").delete().eq("id", a.id).eq("owner_id", uid);
    if (err) {
      setHidden((h) => h.filter((x) => x !== a.id));
      return toast(toBackendError(err).message, "danger");
    }
    await removePrivate([a.path]);
    toast("File deleted.", "ok");
    void q.reload();
  };

  const save = async (a: Asset) => {
    try { await downloadPrivate(a.path, a.file_name); } catch (e) { toast(e instanceof BackendError ? e.message : "We could not prepare that download.", "danger"); }
  };

  return (
    <Block title="Asset library">
      <div className="mb-6 flex max-w-3xl flex-col gap-4 border border-ink-700 p-5 sm:flex-row sm:items-end">
        <Select label="What are you adding?" value={kind} onChange={(e) => setKind(e.target.value as Kind)} className="flex-1">
          {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </Select>
        <input ref={input} type="file" accept={acceptAttr([...allow])} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void upload(e.target.files?.[0])} />
        <Button loading={busy} onClick={() => input.current?.click()} className="min-h-12">Upload artwork</Button>
      </div>
      <p className="-mt-3 mb-6 max-w-3xl text-sm text-fog-500">{allow.length === 1 ? "PDF only" : allow.map((m) => (m === "image/svg+xml" ? "SVG" : m.split("/")[1]!.toUpperCase())).join(", ")} · up to 25 MB. Files are private to you and the SPP team. SVG files are cleaned of scripts before they are stored.</p>
      <div className="max-w-3xl"><FormError message={error} /></div>
      <ErrorNote message={q.error} onRetry={q.reload} />

      {q.loading && !q.data ? <GridSkeleton items={3} /> : assets.length === 0 ? (
        <EmptyState title="No brand files yet." body="Upload your logo first. SPP designers will use it on quotes, mockups and print-ready artwork." action={<Button variant="outline" onClick={() => input.current?.click()}>Upload artwork</Button>} />
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {assets.map((a) => (
            <li key={a.id} className="flex flex-col border border-ink-700">
              <div className="flex aspect-[4/3] items-center justify-center bg-[repeating-conic-gradient(var(--color-ink-800)_0_25%,var(--color-ink-850)_0_50%)] bg-[length:16px_16px] p-4">
                {a.mime.startsWith("image/")
                  // eslint-disable-next-line @next/next/no-img-element -- private, short-lived signed URL; next/image cannot optimise it in a static export
                  ? url(a.path) ? <img src={url(a.path)} alt={`${kindLabel(a.kind)}: ${a.file_name}`} loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" /> : <div className="skeleton h-full w-full" />
                  : <FileText aria-hidden className="h-10 w-10 text-fog-400" strokeWidth={1} />}
              </div>
              <div className="flex flex-1 flex-col gap-1 border-t border-ink-700 p-4">
                <p className="t-label text-[0.625rem] text-yellow">{kindLabel(a.kind)}</p>
                <p className="truncate text-fog-50" title={a.file_name}>{a.file_name}</p>
                <p className="t-data text-xs text-fog-500">{formatBytes(a.bytes)}{a.width && a.height ? ` · ${a.width}×${a.height}px` : ""} · {formatDate(a.created_at)}</p>
              </div>
              <div className="flex border-t border-ink-700">
                <button type="button" onClick={() => void save(a)} className="t-label flex min-h-11 flex-1 items-center justify-center gap-2 text-fog-300 hover:bg-ink-850 hover:text-yellow"><Download aria-hidden className="h-3.5 w-3.5" strokeWidth={1.5} />Download</button>
                <button type="button" onClick={() => setRemoving(a)} className="t-label flex min-h-11 flex-1 items-center justify-center gap-2 border-l border-ink-700 text-fog-300 hover:bg-ink-850 hover:text-danger"><Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.5} />Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(removing)} onClose={() => setRemoving(null)} title="Delete this file?" footer={<><Button variant="ghost" onClick={() => setRemoving(null)}>Keep it</Button><Button variant="danger" onClick={() => removing && void remove(removing)}>Delete file</Button></>}>
        <p className="text-fog-300"><span className="break-all text-fog-50">{removing?.file_name}</span> will be removed from your brand library. Jobs SPP has already produced are not affected.</p>
      </Dialog>
    </Block>
  );
}

"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BackendError, requireBackend, toBackendError } from "@/lib/backend/client";

export const ARTWORK_BUCKET = "private-artwork";
const SIGNED_TTL = 300; // seconds — previews are short-lived by design

/** Rows store the object name `<uid>/<uuid>.<ext>`; tolerate a bucket-prefixed value too. */
export const objectName = (path: string) => path.replace(/^\/?private-artwork\//, "");

/** Short-lived signed URLs for a set of private objects. RLS on storage.objects decides what can be signed. */
export function useSignedUrls(paths: string[]) {
  const key = useMemo(() => [...new Set(paths.map(objectName))].sort().join("|"), [paths]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const names = key ? key.split("|") : [];
    if (!names.length) return;
    let alive = true;
    const sign = () =>
      void requireBackend().storage.from(ARTWORK_BUCKET).createSignedUrls(names, SIGNED_TTL).then(({ data }) => {
        if (!alive || !data) return;
        setUrls(Object.fromEntries(data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : []))));
      }, () => {});
    sign();
    // re-sign a little before expiry so a page left open keeps its previews
    const t = setInterval(sign, (SIGNED_TTL - 40) * 1000);
    return () => { alive = false; clearInterval(t); };
  }, [key]);
  return useCallback((path: string | null | undefined) => (path ? urls[objectName(path)] : undefined), [urls]);
}

/** Opens a private file through a fresh signed URL that forces a download with the original name. */
export async function downloadPrivate(path: string, fileName: string) {
  const { data, error } = await requireBackend().storage.from(ARTWORK_BUCKET).createSignedUrl(objectName(path), SIGNED_TTL, { download: fileName || true });
  if (error || !data?.signedUrl) throw error ? toBackendError(error) : new BackendError("We could not prepare that download. Please try again.");
  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.rel = "noopener";
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export const formatBytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);

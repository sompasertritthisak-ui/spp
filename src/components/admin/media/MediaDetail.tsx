"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { backend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import type { MediaRow } from "@/lib/backend/db-types";
import { formatDateTime, titleCase } from "@/lib/format";
import { DISCARD, useConfirm } from "../resource/Confirm";
import { AreaField, SelectField, TagsField } from "../resource/fields";
import type { Values } from "../resource/types";
import { Drawer, Meta } from "../ui";
import { BUCKET, formatBytes, isImage, MEDIA_CATEGORIES, mediaUrl } from "./lib";
import { MediaThumb } from "./MediaPicker";
import { findMediaUsage } from "./usage";

export function MediaDetail({ media, canEdit, canDelete, saving, update, remove, onClose }: { media: MediaRow; canEdit: boolean; canDelete: boolean; saving: boolean; update: (id: string, patch: Values, o?: { message?: string }) => Promise<MediaRow | null>; remove: (id: string) => Promise<boolean>; onClose: () => void }) {
  const toast = useToast();
  const [alt, setAlt] = useState(media.alt);
  const [category, setCategory] = useState(media.category);
  const [tags, setTags] = useState(media.tags);
  const [confirm, confirmUi] = useConfirm();
  const usage = useQuery(() => findMediaUsage(media.id), [media.id]);
  const dirty = alt !== media.alt || category !== media.category || JSON.stringify(tags) !== JSON.stringify(media.tags);
  const url = mediaUrl(media.path);

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast("Public URL copied.", "ok"); }
    catch { toast("Copy is blocked by this browser — select the URL and copy it by hand.", "danger"); }
  };
  const close = async () => { if (!dirty || (await confirm(DISCARD))) onClose(); };
  const save = async () => { if (await update(media.id, { alt: alt.trim(), category, tags }, { message: "Media details saved." })) onClose(); };
  const del = async () => {
    const used = usage.data?.length ?? 0;
    const ok = await confirm({
      title: used ? `Delete a file that is used in ${used} place${used > 1 ? "s" : ""}?` : "Delete this file?", danger: true, confirmLabel: "Delete permanently",
      body: <>{used > 0 && <strong className="mb-2 block text-warn">It is still in use (see “Where it is used”). Those places will lose their image at the next site publish.</strong>}“{media.file_name}” will be removed from the library and from storage. Anyone holding its public URL will get an error. This cannot be undone.{usage.error && <span className="mt-2 block text-warn">Usage could not be checked — delete only if you are sure it is unused.</span>}</>,
    });
    if (!ok || !(await remove(media.id))) return;
    const gone = await backend()!.storage.from(BUCKET).remove([media.path]);
    if (gone.error) toast("The library entry was deleted, but the stored file could not be removed. Tell an administrator.", "danger");
    onClose();
  };

  return (
    <Drawer open onClose={() => void close()} title={media.file_name} sub={dirty ? <span className="t-label text-warn">Unsaved changes</span> : undefined}
      footer={<>{canDelete ? <Button variant="danger" size="sm" className="mr-auto" onClick={() => void del()}>Delete</Button> : <span className="mr-auto self-center text-xs text-fog-500">Only content editors and admins can delete files.</span>}{canEdit && <Button size="sm" loading={saving} disabled={!dirty} onClick={() => void save()}>Save details</Button>}</>}>
      <div className="grid gap-6">
        {isImage(media) ? <MediaThumb media={media} className="max-h-72 w-full border border-ink-700" /> : media.mime === "video/mp4" ? <video controls preload="metadata" src={url} className="max-h-72 w-full border border-ink-700 bg-ink-950" /> : <MediaThumb media={media} className="h-32 w-full border border-ink-700" />}
        <div>
          <p className="t-label mb-1.5 text-fog-400">Public URL</p>
          <div className="flex gap-2"><input readOnly value={url} aria-label="Public URL" onFocus={(e) => e.currentTarget.select()} className="t-data min-h-11 min-w-0 flex-1 border border-ink-600 bg-ink-950 px-3 text-xs text-fog-300" /><Button variant="outline" size="sm" className="min-h-11" onClick={() => void copy()}>Copy</Button><Button variant="ghost" size="sm" className="min-h-11" href={url} external>Open</Button></div>
        </div>
        <AreaField label="Alt text" rows={2} maxLength={300} disabled={!canEdit} value={alt} onChange={setAlt} error={isImage(media) && !alt.trim() ? "Missing. Describe what the image shows for people who cannot see it." : null} hint="One factual sentence. Leave decorative flourishes out; do not start with “Image of”." />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Category" disabled={!canEdit} value={category} onChange={setCategory} options={[...new Set([...MEDIA_CATEGORIES, media.category])].map((c) => ({ value: c, label: titleCase(c) }))} />
          <TagsField label="Tags" disabled={!canEdit} value={tags} onChange={setTags} max={12} />
        </div>
        <Meta items={[{ label: "Type", value: media.mime }, { label: "Size", value: formatBytes(media.bytes) }, { label: "Dimensions", value: media.width && media.height ? `${media.width} × ${media.height} px` : "—" }, { label: "Uploaded", value: formatDateTime(media.created_at) }, { label: "Path", value: <span className="t-data text-xs">{media.path}</span> }]} />
        <div>
          <p className="t-label mb-2 text-fog-400">Where it is used</p>
          {usage.loading && <div className="skeleton h-10" />}
          {usage.error && <p className="text-sm text-danger">{usage.error} <button type="button" className="t-label ml-2 text-fog-300 hover:text-fog-50" onClick={() => void usage.reload()}>Retry</button></p>}
          {usage.data && usage.data.length === 0 && <p className="text-sm text-fog-500">Not referenced anywhere. Safe to delete.</p>}
          {usage.data && usage.data.length > 0 && <ul className="divide-y divide-ink-800 border border-ink-700">{usage.data.map((u, i) => <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><span className="min-w-0"><span className="t-label block text-[0.625rem] text-fog-500">{u.where}</span><span className="block truncate text-fog-100">{u.label}</span></span>{u.href && <Link href={u.href} className="t-label flex-none text-yellow hover:text-fog-50">Open</Link>}</li>)}</ul>}
        </div>
      </div>
      {confirmUi}
    </Drawer>
  );
}

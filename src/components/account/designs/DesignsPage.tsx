"use client";
import { useMemo, useState, type FormEvent } from "react";
import { ErrorNote, Tabs } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import type { ArtworkPreflightsRow } from "@/lib/backend/db-types";
import { BackendError, requireBackend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { usePortal } from "../PortalShell";
import { GridSkeleton, PortalHeader, PREFLIGHT_DISCLAIMER } from "../ui";
import { deleteDesign, duplicateDesign, lockedBySpp, renameDesign } from "./actions";
import { DesignCard, type Verdict } from "./DesignCard";
import { ShareDialog } from "./ShareDialog";
import { DESIGN_COLS, useDesignImages, type DesignLite } from "./shared";

type Filter = "all" | "mine" | "spp" | "archived";
type Pre = Pick<ArtworkPreflightsRow, "design_id" | "verdict" | "review_verdict">;
const msg = (e: unknown, fallback: string) => (e instanceof BackendError ? e.message : fallback);

export function DesignsPage() {
  const { uid } = usePortal();
  const toast = useToast();
  const q = useQuery<DesignLite[]>(() => requireBackend().from("designs").select(DESIGN_COLS).eq("owner_id", uid).order("updated_at", { ascending: false }).limit(200), [uid]);
  const ids = useMemo(() => q.data?.map((d) => d.id) ?? [], [q.data]);
  const pre = useQuery<Pre[]>(() => requireBackend().from("artwork_preflights").select("design_id,verdict,review_verdict").in("design_id", ids).order("created_at", { ascending: false }).limit(600), [ids.join(",")], { enabled: ids.length > 0 });

  // Local overlay so rename / share / delete feel instant; the reload reconciles.
  const [patches, setPatches] = useState<Record<string, Partial<DesignLite> | null>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [renaming, setRenaming] = useState<DesignLite | null>(null);
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState<DesignLite | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const designs = useMemo(() => (q.data ?? []).flatMap((d) => (patches[d.id] === null ? [] : [{ ...d, ...patches[d.id] }])), [q.data, patches]);
  const imageUrl = useDesignImages(designs);
  const verdicts = useMemo(() => {
    const m = new Map<string, Verdict>();
    for (const p of pre.data ?? []) if (!m.has(p.design_id)) m.set(p.design_id, { verdict: p.review_verdict ?? p.verdict, reviewed: Boolean(p.review_verdict) });
    return m;
  }, [pre.data]);

  const groups = { all: designs.filter((d) => d.status !== "archived"), mine: designs.filter((d) => d.status === "draft" || d.status === "saved"), spp: designs.filter((d) => lockedBySpp(d.status)), archived: designs.filter((d) => d.status === "archived") };
  const shown = groups[filter];
  const patch = (id: string, p: Partial<DesignLite> | null) => setPatches((s) => ({ ...s, [id]: p === null ? null : { ...s[id], ...p } }));
  const settle = async () => { await q.reload(); setPatches({}); };

  const rename = async (e: FormEvent) => {
    e.preventDefault();
    const d = renaming;
    const name = newName.trim().slice(0, 120);
    if (!d || !name) return;
    setRenaming(null);
    patch(d.id, { name });
    try { await renameDesign(uid, d.id, name); toast("Design renamed.", "ok"); } catch (err) { patch(d.id, { name: d.name }); toast(msg(err, "We could not rename that design."), "danger"); }
  };

  const duplicate = async (d: DesignLite) => {
    setBusyId(d.id);
    try { const copy = await duplicateDesign(uid, d); toast(`Copy saved as ${copy.ref}.`, "ok"); await settle(); } catch (err) { toast(msg(err, "We could not duplicate that design."), "danger"); } finally { setBusyId(null); }
  };

  const remove = async () => {
    const d = deleting;
    if (!d) return;
    setDeleting(null);
    patch(d.id, null);
    try { await deleteDesign(uid, d.id); toast("Design deleted.", "ok"); } catch (err) { setPatches((s) => { const { [d.id]: _gone, ...rest } = s; return rest; }); toast(msg(err, "We could not delete that design."), "danger"); }
  };

  return (
    <>
      <PortalHeader title="My Designs" sub="Everything you have saved in SPP Studio. Open one to keep editing, send it for a quote, or share a view-only link for sign-off." actions={<Button href="/spp-studio/" arrow>Open SPP Studio</Button>} />
      <ErrorNote message={q.error} onRetry={q.reload} />
      {q.loading && !q.data ? <GridSkeleton /> : designs.length === 0 && !q.error ? (
        <EmptyState title="No designs saved yet." body="Pick a garment in SPP Studio, add your artwork and press SAVE DESIGN. It will be waiting here next time you sign in." action={<Button href="/spp-studio/" arrow>Open SPP Studio</Button>} />
      ) : (
        <>
          <Tabs label="Filter designs" value={filter} onChange={setFilter} tabs={[{ value: "all", label: "All", count: groups.all.length }, { value: "mine", label: "Drafts & saved", count: groups.mine.length }, { value: "spp", label: "With SPP", count: groups.spp.length }, ...(groups.archived.length ? [{ value: "archived" as const, label: "Archived", count: groups.archived.length }] : [])]} />
          {shown.length === 0 ? <p className="border border-dashed border-ink-600 p-6 text-fog-400">No designs in this view.</p> : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((d) => (
                <DesignCard key={d.id} design={d} verdict={verdicts.get(d.id)} imageUrl={imageUrl} busy={busyId === d.id}
                  onRename={() => { setNewName(d.name); setRenaming(d); }} onDuplicate={() => void duplicate(d)} onShare={() => setSharingId(d.id)} onDelete={() => setDeleting(d)} />
              ))}
            </ul>
          )}
          <p className="mt-8 flex items-start gap-3 text-sm text-fog-500"><span aria-hidden className="reg mt-0.5 flex-none" />{PREFLIGHT_DISCLAIMER}</p>
        </>
      )}

      <Dialog open={Boolean(renaming)} onClose={() => setRenaming(null)} title="Rename design">
        <form onSubmit={rename} className="flex flex-col gap-5">
          <Input label="Design name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={120} required autoFocus hint={`The reference ${renaming?.ref ?? ""} never changes.`} />
          <div className="flex justify-end gap-3"><Button variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button><Button type="submit" disabled={!newName.trim()}>Save name</Button></div>
        </form>
      </Dialog>

      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} title="Delete this design?" footer={<><Button variant="ghost" onClick={() => setDeleting(null)}>Keep it</Button><Button variant="danger" onClick={() => void remove()}>Delete design</Button></>}>
        <p className="text-fog-300"><span className="text-fog-50">{deleting?.name}</span> <span className="t-data text-fog-500">{deleting?.ref}</span> will be deleted with its version history and uploaded artwork. This cannot be undone.</p>
        {deleting?.share_token && <p className="mt-3 text-sm text-warn">Its shared link will stop working.</p>}
      </Dialog>

      <ShareDialog design={designs.find((d) => d.id === sharingId) ?? null} onClose={() => setSharingId(null)} onChanged={(id, token) => patch(id, { share_token: token })} />
    </>
  );
}

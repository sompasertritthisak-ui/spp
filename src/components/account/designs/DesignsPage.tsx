"use client";
import { useMemo, useState, type FormEvent } from "react";
import { ErrorNote, Tabs } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import type { ArtworkPreflightsRow } from "@/lib/backend/db-types";
import { BackendError, requireBackend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { useT } from "@/lib/i18n";
import { usePortal } from "../PortalShell";
import { GridSkeleton, PortalEmpty, PortalHeader, PREFLIGHT_DISCLAIMER } from "../ui";
import { deleteDesign, duplicateDesign, lockedBySpp, renameDesign } from "./actions";
import { DesignCard, type Verdict } from "./DesignCard";
import { ShareDialog } from "./ShareDialog";
import { DESIGN_COLS, useDesignImages, type DesignLite } from "./shared";

type Filter = "all" | "mine" | "spp" | "archived";
type Pre = Pick<ArtworkPreflightsRow, "design_id" | "verdict" | "review_verdict">;
const msg = (e: unknown, fallback: string) => (e instanceof BackendError ? e.message : fallback);

export function DesignsPage() {
  const { uid, contact } = usePortal();
  const toast = useToast();
  const t = useT();
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
    try { await renameDesign(uid, d.id, name); toast(t("des.renamed"), "ok"); } catch (err) { patch(d.id, { name: d.name }); toast(msg(err, t("des.renameFail")), "danger"); }
  };

  const duplicate = async (d: DesignLite) => {
    setBusyId(d.id);
    try { const copy = await duplicateDesign(uid, d); toast(t("des.copySaved", { ref: copy.ref }), "ok"); await settle(); } catch (err) { toast(msg(err, t("des.dupFail")), "danger"); } finally { setBusyId(null); }
  };

  const remove = async () => {
    const d = deleting;
    if (!d) return;
    setDeleting(null);
    patch(d.id, null);
    try { await deleteDesign(uid, d.id); toast(t("des.deleted"), "ok"); } catch (err) { setPatches((s) => { const { [d.id]: _gone, ...rest } = s; return rest; }); toast(msg(err, t("des.deleteFail")), "danger"); }
  };

  return (
    <>
      <PortalHeader title={t("portal.designs")} sub={t("des.sub")} actions={<Button href="/spp-studio/" arrow>{t("common.openStudio")}</Button>} />
      <ErrorNote message={q.error} onRetry={q.reload} />
      {q.loading && !q.data ? <GridSkeleton /> : designs.length === 0 && !q.error ? (
        <PortalEmpty title={t("des.emptyTitle")} body={t("des.emptyBody")} action={<Button href="/spp-studio/" arrow>{t("common.openStudio")}</Button>} />
      ) : (
        <>
          <Tabs label={t("des.filter")} value={filter} onChange={setFilter} tabs={[{ value: "all", label: t("des.all"), count: groups.all.length }, { value: "mine", label: t("des.mine"), count: groups.mine.length }, { value: "spp", label: t("des.withSpp"), count: groups.spp.length }, ...(groups.archived.length ? [{ value: "archived" as const, label: t("des.archived"), count: groups.archived.length }] : [])]} />
          {shown.length === 0 ? <p className="border border-dashed border-gold/40 p-6 text-fog-400">{t("des.noneInView")}</p> : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((d) => (
                <DesignCard key={d.id} design={d} verdict={verdicts.get(d.id)} imageUrl={imageUrl} busy={busyId === d.id} contact={contact}
                  onRename={() => { setNewName(d.name); setRenaming(d); }} onDuplicate={() => void duplicate(d)} onShare={() => setSharingId(d.id)} onDelete={() => setDeleting(d)} />
              ))}
            </ul>
          )}
          <p className="mt-8 flex items-start gap-3 text-sm text-fog-500"><span aria-hidden className="reg mt-0.5 flex-none text-gold" />{PREFLIGHT_DISCLAIMER}</p>
        </>
      )}

      <Dialog open={Boolean(renaming)} onClose={() => setRenaming(null)} title={t("des.rename")}>
        <form onSubmit={rename} className="flex flex-col gap-5">
          <Input label={t("des.name")} value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={120} required autoFocus hint={t("des.refNever", { ref: renaming?.ref ?? "" })} />
          <div className="flex justify-end gap-3"><Button variant="ghost" onClick={() => setRenaming(null)}>{t("common.cancel")}</Button><Button type="submit" disabled={!newName.trim()}>{t("des.saveName")}</Button></div>
        </form>
      </Dialog>

      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} title={t("des.deleteQ")} footer={<><Button variant="ghost" onClick={() => setDeleting(null)}>{t("des.keep")}</Button><Button variant="danger" onClick={() => void remove()}>{t("des.delete")}</Button></>}>
        <p className="text-fog-300"><span className="text-fog-50">{deleting?.name}</span> <span className="t-data text-fog-500">{deleting?.ref}</span> {t("des.deleteBody")}</p>
        {deleting?.share_token && <p className="mt-3 text-sm text-warn">{t("des.deleteShare")}</p>}
      </Dialog>

      <ShareDialog design={designs.find((d) => d.id === sharingId) ?? null} onClose={() => setSharingId(null)} onChanged={(id, token) => patch(id, { share_token: token })} />
    </>
  );
}

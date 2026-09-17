"use client";
import { clsx } from "clsx";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { track } from "@/lib/backend/analytics";
import { downloadBlob, exportMockup } from "@/lib/studio/export";
import { art } from "@/lib/studio/persistence";
import { renderScene, sceneBlob, SCENES, type SceneKey } from "@/lib/studio/scenes";
import type { DesignDoc } from "@/lib/studio/schema";

const Garment3D = dynamic(() => import("./Garment3D"), { ssr: false, loading: () => <div className="skeleton h-full w-full" /> });
type View = "flat" | "3d" | SceneKey;

/** SEE IT IN THE REAL WORLD + DOWNLOAD MOCKUP. Every download is preview-resolution and watermarked with the Design ID. */
export function VisualiseDialog({ open, onClose, doc, name, designRef, productName, dirty, onSave }: { open: boolean; onClose: () => void; doc: DesignDoc; name: string; designRef: string | null; productName: string; dirty: boolean; onSave: () => Promise<string | null> }) {
  const toast = useToast();
  const [view, setView] = useState<View>("flat");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [ref, setRef] = useState(designRef);
  const holder = useRef<string | null>(null);
  useEffect(() => setRef(designRef), [designRef]);

  // Render the still preview for flat + scene views whenever the dialog or view changes.
  useEffect(() => {
    if (!open || view === "3d") return;
    let alive = true;
    (async () => {
      const images = (l: Parameters<typeof art.bitmap>[0]) => art.bitmap(l);
      const blob = view === "flat" ? await exportMockup({ doc, name, designRef: ref, productName, images }) : await new Promise<Blob | null>((res) => renderScene(view, { doc, designRef: ref, images }).then((c) => c.toBlob(res, "image/png")));
      if (!alive || !blob) return;
      if (holder.current) URL.revokeObjectURL(holder.current);
      holder.current = URL.createObjectURL(blob);
      setPreview(holder.current);
    })().catch(() => alive && toast("We could not render that preview.", "danger"));
    return () => { alive = false; };
  }, [open, view, doc, name, ref, productName, toast]);
  useEffect(() => () => { if (holder.current) URL.revokeObjectURL(holder.current); }, []);

  const download = async () => {
    setBusy(true);
    try {
      // Stamp the real Design ID: save first when there are unsaved changes and saving is possible.
      let id = ref;
      if (dirty) { const saved = await onSave(); if (saved) { id = saved; setRef(saved); } }
      const images = (l: Parameters<typeof art.bitmap>[0]) => art.bitmap(l);
      const blob = view === "flat" || view === "3d" ? await exportMockup({ doc, name, designRef: id, productName, images }) : await sceneBlob(view, { doc, designRef: id, images });
      downloadBlob(blob, `${id ?? "SPP-mockup"}-${view === "3d" ? "flat" : view}.png`);
      track("mockup_downloaded", { product: doc.productSlug, ref: id ?? undefined, step: view });
      toast(id ? `Downloaded with Design ID ${id}` : "Downloaded. Save your design to get a Design ID on it.", "ok");
    } catch { toast("The download failed. Please try again.", "danger"); }
    finally { setBusy(false); }
  };

  const views: { key: View; label: string }[] = [{ key: "flat", label: "Front & back" }, ...(doc.garment === "cap" ? [] : [{ key: "3d" as View, label: "3D" }]), ...SCENES.map((s) => ({ key: s.key as View, label: s.label }))];
  return (
    <Dialog open={open} onClose={onClose} title="Visualise it" wide footer={<><span className="mr-auto self-center text-sm text-fog-400">Preview resolution · watermarked{ref ? ` · ${ref}` : ""}</span><Button variant="outline" onClick={onClose}>Keep designing</Button><Button onClick={() => void download()} loading={busy}>Download mockup</Button></>}>
      <div role="tablist" aria-label="Visualisation" className="thin-scroll mb-4 flex gap-1 overflow-x-auto">
        {views.map((v) => <button key={v.key} role="tab" type="button" aria-selected={view === v.key} onClick={() => setView(v.key)} className={clsx("t-label min-h-10 flex-none border px-3.5 text-[0.6875rem]", view === v.key ? "border-yellow bg-yellow text-ink-950" : "border-ink-600 text-fog-300 hover:border-ink-500")}>{v.label}</button>)}
      </div>
      <div className="relative aspect-[16/10] w-full overflow-hidden border border-ink-700 bg-ink-950">
        {view === "3d" ? <Garment3D doc={doc} /> : preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- a locally generated blob URL; next/image cannot optimise it and the site is a static export
          <img src={preview} alt={`${views.find((v) => v.key === view)?.label} preview of your design`} className="h-full w-full object-contain" />
        ) : <div className="skeleton h-full w-full" />}
      </div>
      <p className="mt-3 text-sm text-fog-400">{view === "3d" ? "Drag to turn the garment. The download for this view is the front & back mockup." : view === "flat" ? "A close visual guide to placement, scale and colour. Screens and fabric show colour differently — SPP confirms final colours with a production proof." : SCENES.find((s) => s.key === view)?.blurb + " Illustrative scene."}</p>
    </Dialog>
  );
}

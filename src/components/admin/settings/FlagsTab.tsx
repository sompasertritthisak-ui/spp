"use client";
import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { backend } from "@/lib/backend/client";
import type { FeatureFlagsRow } from "@/lib/backend/db-types";
import { relativeTime } from "@/lib/format";
import { PublishSite } from "../cms/PublishSite";
import { useConfirm } from "../resource/Confirm";
import { adminError } from "../resource/errors";
import { ErrorNote, Panel } from "../ui";

type Info = { effect: string; off: string; major: boolean; immediate?: string };
const INFO: Record<string, Info> = {
  AI_DESIGN: { effect: "The AI design assistant inside SPP Studio (suggestions only — it never orders or approves anything).", off: "The assistant panel disappears from Studio.", major: false },
  MOCKUP_STUDIO: { effect: "SPP Studio — the online mockup designer and every “Design something” entry point.", off: "Customers can no longer design online; product pages fall back to quote requests.", major: true },
  BILLBOARD_BOOKING: { effect: "“Request this location” on billboard pages.", off: "Billboards stay visible but nobody can send a booking request online.", major: true },
  ONLINE_PRICING: { effect: "Instant estimate bands on the public site.", off: "Every product shows “quote required”; no figures are calculated for customers.", major: true, immediate: "The pricing engine reads this flag live, so estimates stop or start immediately — before any publish." },
  PREORDERS: { effect: "Preorder windows on campaigns.", off: "Preorder forms are hidden.", major: false },
  CUSTOMER_PORTAL: { effect: "Customer accounts (My SPP): saved designs, quotes, orders.", off: "Sign-in and account links are hidden; existing customers cannot reach their history.", major: true },
  PAYMENTS: { effect: "Online payments.", off: "", major: false },
  PRODUCTION_WORKFLOW: { effect: "Production jobs, QC and delivery tracking in the Command Center and customer order timelines.", off: "Order timelines stop showing production stages.", major: true },
};

/** feature_flags is keyed by `key` (no id), so it has its own small optimistic hook. */
function useFlags() {
  const toast = useToast();
  const [rows, setRows] = useState<FeatureFlagsRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    void backend()!.from("feature_flags").select("*").order("key").then((r) => { if (!alive) return; if (r.error) setError(adminError(r.error)); else { setRows(r.data as FeatureFlagsRow[]); setError(null); } });
    return () => { alive = false; };
  }, [tick]);
  const toggle = async (key: string, enabled: boolean) => {
    setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, enabled } : r)) ?? null);
    const r = await backend()!.from("feature_flags").update({ enabled }).eq("key", key).select("*").maybeSingle();
    if (r.error || !r.data) { setRows((rs) => rs?.map((x) => (x.key === key ? { ...x, enabled: !enabled } : x)) ?? null); toast(r.error ? adminError(r.error) : "You do not have permission to change feature flags.", "danger"); return; }
    setRows((rs) => rs?.map((x) => (x.key === key ? (r.data as FeatureFlagsRow) : x)) ?? null);
    toast(`${key} switched ${enabled ? "on" : "off"}.`, "ok");
  };
  return { rows, error, toggle, reload: () => setTick((t) => t + 1) };
}

export function FlagsTab() {
  const flags = useFlags();
  const [confirm, confirmUi] = useConfirm();
  const flip = async (f: FeatureFlagsRow) => {
    const info = INFO[f.key];
    if (f.enabled && info?.major && !(await confirm({ title: `Switch off ${f.key}?`, danger: true, confirmLabel: "Switch off", body: <><strong className="block text-fog-50">{info.off}</strong><span className="mt-2 block">{info.immediate ?? "The public site changes at the next “Publish site”."} You can switch it back on at any time.</span></> }))) return;
    await flags.toggle(f.key, !f.enabled);
  };
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Feature flags" action={<PublishSite compact />}>
        <p className="mb-4 max-w-3xl text-sm leading-relaxed text-fog-400">Flags switch whole features on or off without a code change. They are baked into the static site, so most take effect at the next “Publish site”. Exceptions are noted on the flag.</p>
        <ErrorNote message={flags.error} onRetry={flags.reload} />
        {!flags.rows && !flags.error && <div className="grid gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-20" />)}</div>}
        {flags.rows?.length === 0 && <p className="text-sm text-fog-500">No feature flags are defined. Run the database seed to create them.</p>}
        <ul className="divide-y divide-ink-800 border-y border-ink-800">
          {flags.rows?.map((f) => {
            const info = INFO[f.key];
            const locked = f.key === "PAYMENTS";
            const on = locked ? false : f.enabled;
            return (
              <li key={f.key} className="flex flex-wrap items-start gap-x-6 gap-y-3 py-4">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="flex flex-wrap items-center gap-2"><span className="t-label text-fog-50">{f.key}</span>{locked && <span className="t-label border border-ink-500 px-1.5 py-0.5 text-[0.625rem] text-fog-400">Not implemented</span>}{info?.major && <span className="t-label text-[0.625rem] text-fog-500">Major feature</span>}</p>
                  <p className="mt-1 text-sm leading-relaxed text-fog-300">{info?.effect ?? f.description}</p>
                  {locked ? <p className="mt-1 text-xs text-fog-500">Online payments have not been built. This flag stays off so the site can never show a payment option that does not work.</p> : <p className="mt-1 text-xs text-fog-500">{info?.immediate ?? "Takes effect at the next site publish."} · changed {relativeTime(f.updated_at)}</p>}
                </div>
                <button type="button" role="switch" aria-checked={on} aria-label={`${f.key}: ${on ? "on" : "off"}`} disabled={locked} onClick={() => void flip(f)} className="flex min-h-11 flex-none items-center gap-3 text-sm text-fog-100 disabled:opacity-40">
                  <span aria-hidden className={clsx("relative h-5 w-9 border transition-colors", on ? "border-yellow bg-yellow/20" : "border-ink-500 bg-ink-950")}><span className={clsx("absolute top-0.5 h-3.5 w-3.5 transition-[left]", on ? "left-[1.125rem] bg-yellow" : "left-0.5 bg-fog-500")} /></span>
                  <span className="t-label w-8">{on ? "On" : "Off"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>
      {confirmUi}
    </div>
  );
}

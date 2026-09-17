"use client";
import { clsx } from "clsx";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { canDo, useAuth } from "@/lib/backend/auth";
import { formatDateTime, relativeTime } from "@/lib/format";
import { useConfirm } from "../resource/Confirm";
import { Panel } from "../ui";
import { publishSite, usePublishState, type PublishResult } from "./publish";

const PUBLISH_CAPS = ["content", "catalogue", "billboards", "campaigns", "settings"];

/**
 * The one control that makes saved content LIVE. `compact` sits in page
 * headers; the full variant (Settings → Publishing) adds the explanation and
 * the history. It reports exactly what the Edge Function said — never a
 * pretend success.
 */
export function PublishSite({ compact = false }: { compact?: boolean }) {
  const { profile, user } = useAuth();
  const toast = useToast();
  const state = usePublishState();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [confirm, confirmUi] = useConfirm();
  const allowed = PUBLISH_CAPS.some((c) => canDo(profile?.role, c));

  const run = async () => {
    const go = await confirm({
      title: "Publish the site now?",
      confirmLabel: "Publish site",
      body: <>This rebuilds the public website from the database. Everything marked <strong className="text-fog-50">Published</strong> goes live in about 2–3 minutes; drafts, archived items and future-dated items stay hidden.{state.latestChange && <> Latest edit: {state.latestChange.table}, {relativeTime(state.latestChange.at)}.</>}</>,
    });
    if (!go) return;
    setBusy(true);
    setResult(null);
    const r = await publishSite(user ? { id: user.id, name: profile?.full_name || profile?.email || "" } : null);
    setBusy(false);
    setResult(r);
    toast(r.ok ? "Site build started — live in about 2–3 minutes." : "The site was NOT published. See the message for details.", r.ok ? "ok" : "danger");
    void state.reload();
  };

  const indicator = state.loading ? <span className="skeleton inline-block h-4 w-40 align-middle" /> : state.error ? <span className="text-danger">{state.error}</span> : (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className={clsx("t-label flex items-center gap-2", state.pending ? "text-warn" : "text-ok")}><span aria-hidden className={clsx("h-2 w-2", state.pending ? "bg-warn" : "bg-ok")} />{state.pending ? "Unpublished changes" : "Site is up to date"}</span>
      <span className="text-xs text-fog-500">{state.last ? <>Last publish {relativeTime(state.last.at)}{state.last.by_name && ` by ${state.last.by_name}`}</> : "Never published from here"}</span>
    </span>
  );
  const outcome = (
    <div aria-live="polite">
      {busy && <p className="mt-3 text-sm text-fog-300">Asking the build server to start…</p>}
      {result && (
        <div role={result.ok ? "status" : "alert"} className={clsx("mt-3 border px-4 py-3 text-sm text-fog-50", result.ok ? "border-ok/40 bg-ok/10" : "border-danger/40 bg-danger/10")}>
          <p><strong className="t-label mr-2">{result.ok ? "Build started" : "Not published"}</strong>{result.message}</p>
          {result.ok && <p className="mt-1 text-fog-300">Changes go live in about 2–3 minutes. Refresh the public page after that to check.</p>}
          {result.recordWarning && <p className="mt-1 text-warn">{result.recordWarning}</p>}
        </div>
      )}
    </div>
  );
  const button = <Button size="sm" className="min-h-11" loading={busy} disabled={!allowed} title={allowed ? undefined : "Your role cannot publish the site"} onClick={() => void run()}>Publish site</Button>;

  if (compact)
    return (
      <div className="w-full sm:w-auto">
        <div className="flex flex-wrap items-center gap-3 sm:justify-end"><div className="text-sm">{indicator}</div>{button}</div>
        {outcome}
        {confirmUi}
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Publish site" action={button}>
        <div className="text-sm">{indicator}</div>
        {state.pending && state.latestChange && <p className="mt-2 text-sm text-fog-400">Latest edit: {state.latestChange.table}, {formatDateTime(state.latestChange.at)}.</p>}
        {outcome}
        <div className="mt-5 grid gap-4 border-t border-ink-700 pt-5 text-sm leading-relaxed text-fog-400 sm:grid-cols-3">
          <p><span className="t-label mb-1 block text-fog-300">1 · Edit</span>Saving in the Command Center writes to the database immediately. Nothing on the public site changes yet.</p>
          <p><span className="t-label mb-1 block text-fog-300">2 · Publish</span>“Publish site” asks the build server to regenerate the static website from everything marked Published. No code change is involved.</p>
          <p><span className="t-label mb-1 block text-fog-300">3 · Live</span>The new version is online in about 2–3 minutes. Items scheduled for a future date appear at the first publish after that date.</p>
        </div>
      </Panel>
      <Panel title="Publish history" flush>
        {state.history.length === 0 ? <p className="p-4 text-sm text-fog-500">{state.loading ? "Loading…" : "No publishes recorded yet."}</p> : (
          <ol className="divide-y divide-ink-800">
            {state.history.map((h, i) => (
              <li key={`${h.at}-${i}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className={clsx("t-label w-20 flex-none", h.ok ? "text-ok" : "text-danger")}>{h.ok ? "Started" : "Failed"}</span>
                <span className="t-data flex-none text-fog-100">{formatDateTime(h.at)}</span>
                <span className="flex-none text-fog-400">{h.by_name || "Unknown"}</span>
                <span className="min-w-0 flex-1 break-words text-fog-500">{h.message}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
      {confirmUi}
    </div>
  );
}

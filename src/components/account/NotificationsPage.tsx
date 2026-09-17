"use client";
import Link from "next/link";
import { useState } from "react";
import { ErrorNote } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import type { NotificationsRow } from "@/lib/backend/db-types";
import { requireBackend, toBackendError } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { relativeTime } from "@/lib/format";
import { usePortal } from "./PortalShell";
import { internalHref, PortalHeader, RowsSkeleton } from "./ui";

type Note = Pick<NotificationsRow, "id" | "kind" | "title" | "body" | "href" | "read_at" | "created_at">;

export function NotificationsPage() {
  const { uid, reloadUnread } = usePortal();
  const toast = useToast();
  const q = useQuery<Note[]>(() => requireBackend().from("notifications").select("id,kind,title,body,href,read_at,created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(100), [uid]);
  const [readLocal, setReadLocal] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const notes = (q.data ?? []).map((n) => (readLocal.has(n.id) && !n.read_at ? { ...n, read_at: "now" } : n));
  const unread = notes.filter((n) => !n.read_at);

  const mark = async (ids: string[]) => {
    if (!ids.length) return;
    setReadLocal((s) => new Set([...s, ...ids])); // optimistic
    const { error } = await requireBackend().from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids).eq("user_id", uid);
    if (error) {
      setReadLocal((s) => new Set([...s].filter((x) => !ids.includes(x))));
      return toast(toBackendError(error).message, "danger");
    }
    reloadUnread();
  };

  return (
    <>
      <PortalHeader title="Notifications" sub={q.data ? (unread.length ? `${unread.length} unread.` : "You are up to date.") : undefined}
        actions={unread.length > 0 ? <Button variant="outline" loading={busy} onClick={async () => { setBusy(true); await mark(unread.map((n) => n.id)); setBusy(false); }}>Mark all read</Button> : undefined} />
      <ErrorNote message={q.error} onRetry={q.reload} />
      {q.loading && !q.data ? <RowsSkeleton rows={5} /> : notes.length === 0 ? (
        <EmptyState title="No notifications yet." body="When SPP sends a quotation, replies to a message, starts production or confirms a billboard, you will see it here." action={<Button href="/account/" variant="outline">Back to overview</Button>} />
      ) : (
        <ul className="border-t border-ink-700" aria-live="polite">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start gap-4 border-b border-ink-700 py-4">
              <span aria-hidden className={`mt-2 h-2 w-2 flex-none ${n.read_at ? "bg-ink-600" : "bg-yellow"}`} />
              <div className="min-w-0 flex-1">
                <p className={n.read_at ? "text-fog-300" : "text-fog-50"}>{!n.read_at && <span className="sr-only">Unread: </span>}{n.title}</p>
                {n.body && <p className="mt-0.5 break-words text-sm text-fog-400">{n.body}</p>}
                <p className="t-data mt-1 text-xs text-fog-500">{relativeTime(n.created_at)}</p>
              </div>
              <div className="flex flex-none flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-4">
                {n.href && <Link href={internalHref(n.href)} onClick={() => { if (!n.read_at) void mark([n.id]); }} className="t-label flex min-h-11 items-center text-fog-100 hover:text-yellow">Open</Link>}
                {!n.read_at && <button type="button" onClick={() => void mark([n.id])} className="t-label min-h-11 text-fog-400 hover:text-yellow">Mark read</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

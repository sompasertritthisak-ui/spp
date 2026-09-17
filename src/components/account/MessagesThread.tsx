"use client";
import { useState, type FormEvent } from "react";
import { ErrorNote } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { MessagesRow } from "@/lib/backend/db-types";
import { requireBackend, toBackendError } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { formatDateTime } from "@/lib/format";
import { usePortal } from "./PortalShell";
import { Block, RowsSkeleton } from "./ui";

type Msg = Pick<MessagesRow, "id" | "sender" | "from_staff" | "body" | "created_at"> & { pending?: boolean };

/** Customer ↔ SPP conversation on one quote / order / project. Internal notes live in another table the customer cannot read. */
export function MessagesThread({ entity, entityId, refLabel }: { entity: "quote" | "order" | "project"; entityId: string; refLabel: string }) {
  const { uid } = usePortal();
  const toast = useToast();
  const q = useQuery<Msg[]>(() => requireBackend().from("messages").select("id,sender,from_staff,body,created_at").eq("entity", entity).eq("entity_id", entityId).order("created_at", { ascending: true }).limit(200), [entity, entityId]);
  const [optimistic, setOptimistic] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const all = [...(q.data ?? []), ...optimistic];

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    const temp: Msg = { id: `tmp-${Date.now()}`, sender: uid, from_staff: false, body: text, created_at: new Date().toISOString(), pending: true };
    setOptimistic((o) => [...o, temp]);
    setBody("");
    setSending(true);
    const { error } = await requireBackend().from("messages").insert({ entity, entity_id: entityId, customer_id: uid, sender: uid, from_staff: false, body: text });
    setSending(false);
    if (error) {
      setOptimistic((o) => o.filter((m) => m.id !== temp.id));
      setBody(text); // give the words back
      return toast(toBackendError(error).message, "danger");
    }
    await q.reload();
    setOptimistic((o) => o.filter((m) => m.id !== temp.id));
  };

  return (
    <Block title="Messages with SPP" action={<button type="button" onClick={() => void q.reload()} className="t-label min-h-11 text-fog-400 hover:text-yellow">Refresh</button>}>
      <ErrorNote message={q.error} onRetry={q.reload} />
      {q.loading && !q.data ? <RowsSkeleton rows={2} /> : (
        <ol aria-live="polite" aria-label={`Messages about ${refLabel}`} className="mb-5 flex flex-col gap-3">
          {all.length === 0 && <li className="border border-dashed border-ink-600 p-5 text-fog-400">No messages yet. Ask a question about {refLabel} and the SPP team will answer here.</li>}
          {all.map((m) => (
            <li key={m.id} className={`flex max-w-[92%] flex-col gap-1.5 border p-4 sm:max-w-[80%] ${m.from_staff ? "self-start border-ink-600 bg-ink-900" : "self-end border-yellow/40 bg-yellow/5"} ${m.pending ? "opacity-60" : ""}`}>
              <span className="t-label text-[0.625rem] text-fog-500">{m.from_staff ? "SPP" : "You"} · {m.pending ? "sending…" : formatDateTime(m.created_at)}</span>
              <p className="whitespace-pre-wrap break-words text-fog-100">{m.body}</p>
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={send} className="flex flex-col gap-3">
        <label htmlFor={`msg-${entityId}`} className="t-label text-fog-400">Write to SPP</label>
        <textarea
          id={`msg-${entityId}`} rows={3} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send(); }}
          placeholder="Questions, changes, delivery details…"
          className="w-full resize-y border border-ink-600 bg-ink-900 px-4 py-3 text-base leading-relaxed text-fog-50 placeholder:text-fog-500 hover:border-ink-500 focus:border-yellow focus:outline-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-fog-500">SPP replies during working hours. {body.length > 3600 && <span className="t-data text-warn">{4000 - body.length} characters left</span>}</p>
          <Button type="submit" loading={sending} disabled={!body.trim()}>Send message</Button>
        </div>
      </form>
    </Block>
  );
}

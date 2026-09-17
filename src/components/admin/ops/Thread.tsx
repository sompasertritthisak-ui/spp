"use client";
import { clsx } from "clsx";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/backend/auth";
import { useQuery } from "@/lib/backend/hooks";
import type { MessagesRow } from "@/lib/backend/db-types";
import { formatDateTime } from "@/lib/format";
import { adminInput, ErrorNote } from "../ui";
import { db, exec } from "./data";

/** The customer-visible conversation. Kept visually distinct from internal notes so nothing is sent by mistake. */
export function CustomerThread({ entity, entityId, customerId }: { entity: "quote" | "order" | "project"; entityId: string; customerId: string | null }) {
  const { user } = useAuth();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const msgs = useQuery<MessagesRow[]>(() => db().from("messages").select("*").eq("entity", entity).eq("entity_id", entityId).order("created_at"), [entity, entityId]);

  const send = async () => {
    const text = body.trim();
    if (!text || !user || !customerId) return;
    setBusy(true);
    const r = await exec(db().from("messages").insert({ entity, entity_id: entityId, customer_id: customerId, sender: user.id, from_staff: true, body: text }));
    setBusy(false);
    if (r.error) return toast(r.error, "danger");
    setBody("");
    toast("Message posted to the customer's portal.", "ok");
    void msgs.reload();
  };

  return (
    <section aria-label="Customer messages" className="border border-sky/30 bg-ink-950">
      <h3 className="t-label flex flex-wrap items-center gap-2 border-b border-sky/30 px-4 py-2.5 text-fog-300">Customer messages <span className="border border-sky/40 px-1.5 py-0.5 text-[0.5625rem] text-sky">Visible to the customer</span></h3>
      <div className="p-4">
        <ErrorNote message={msgs.error} onRetry={() => void msgs.reload()} />
        <ul className="flex flex-col gap-2" aria-live="polite">
          {msgs.loading && !msgs.data && <li className="skeleton h-10" />}
          {msgs.data?.map((m) => (
            <li key={m.id} className={clsx("max-w-[85%] border px-3 py-2 text-sm", m.from_staff ? "self-end border-ink-600 bg-ink-850 text-fog-50" : "self-start border-ink-700 bg-ink-900 text-fog-100")}>
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className="t-label mt-1 text-[0.5625rem] text-fog-500">{m.from_staff ? "SPP" : "Customer"} · {formatDateTime(m.created_at)}</p>
            </li>
          ))}
          {msgs.data?.length === 0 && <li className="text-sm text-fog-500">No messages on this thread yet.</li>}
        </ul>
        {customerId ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <textarea aria-label="Message to customer" value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={4000} placeholder="Write to the customer…" className={`${adminInput} resize-y py-2`} />
            <Button size="sm" loading={busy} disabled={!body.trim()} onClick={() => void send()}>Send</Button>
          </div>
        ) : (
          <p className="mt-3 border border-ink-700 px-3 py-2 text-xs text-fog-400">This contact has no My SPP account, so there is no portal thread. Use WhatsApp, phone or email instead.</p>
        )}
      </div>
    </section>
  );
}

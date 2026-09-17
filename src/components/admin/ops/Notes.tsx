"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/backend/auth";
import { useQuery } from "@/lib/backend/hooks";
import type { InternalNotesRow } from "@/lib/backend/db-types";
import { relativeTime } from "@/lib/format";
import { adminInput, ErrorNote } from "../ui";
import { db, exec, useStaff } from "./data";
import { SectionTitle } from "./parts";

type Entity = "lead" | "quote" | "order" | "project" | "design" | "booking" | "consultation" | "job" | "customer";

/** Staff-only commentary. RLS has no customer policy on internal_notes, and author must be the writer. */
export function InternalNotes({ entity, entityId }: { entity: Entity; entityId: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const { name } = useStaff();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const notes = useQuery<InternalNotesRow[]>(() => db().from("internal_notes").select("*").eq("entity", entity).eq("entity_id", entityId).order("created_at", { ascending: false }), [entity, entityId]);

  const add = async () => {
    const text = body.trim();
    if (!text || !user) return;
    setBusy(true);
    const r = await exec(db().from("internal_notes").insert({ entity, entity_id: entityId, body: text, author: user.id }));
    setBusy(false);
    if (r.error) return toast(r.error, "danger");
    setBody("");
    void notes.reload();
  };

  return (
    <section aria-label="Internal notes">
      <SectionTitle><span className="flex items-center gap-2">Internal notes <span className="border border-warn/40 px-1.5 py-0.5 text-[0.5625rem] text-warn">Staff only · never shown to the customer</span></span></SectionTitle>
      <ErrorNote message={notes.error} onRetry={() => void notes.reload()} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <textarea aria-label="New internal note" value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Margin, context, what was said on the phone…" className={`${adminInput} resize-y py-2`} />
        <Button size="sm" variant="outline" loading={busy} disabled={!body.trim()} onClick={() => void add()}>Add note</Button>
      </div>
      <ul className="mt-3 flex flex-col">
        {notes.loading && !notes.data && <li className="skeleton h-10" />}
        {notes.data?.map((n) => (
          <li key={n.id} className="border-b border-ink-800 py-2.5 last:border-0">
            <p className="whitespace-pre-wrap text-sm text-fog-100">{n.body}</p>
            <p className="t-label mt-1 text-[0.625rem] text-fog-500">{name(n.author)} · {relativeTime(n.created_at)}</p>
          </li>
        ))}
        {notes.data?.length === 0 && <li className="py-2 text-sm text-fog-500">No internal notes yet.</li>}
      </ul>
    </section>
  );
}

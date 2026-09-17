"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FormError, Input, Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useQuery } from "@/lib/backend/hooks";
import { db, exec } from "../ops/data";

export function NewProjectDialog({ open, leadId, onClose, onCreated }: { open: boolean; leadId: string | null; onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const leads = useQuery<{ id: string; ref: string; name: string; company_name: string }[]>(() => db().from("leads").select("id,ref,name,company_name").neq("status", "lost").order("created_at", { ascending: false }).limit(300), [], { enabled: open });
  const [f, setF] = useState({ name: "", lead: leadId ?? "", objective: "", scope: "", dueOn: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (f.name.trim().length < 2) return setErr("Give the project a name.");
    setErr(null); setBusy(true);
    const r = await exec<{ id: string; ref: string }>(db().rpc("staff_create_project", { payload: { name: f.name, leadId: f.lead, objective: f.objective, scope: f.scope, dueOn: f.dueOn } }));
    setBusy(false);
    if (r.error || !r.data) return setErr(r.error ?? "The project could not be created.");
    toast(`Project ${r.data.ref} created.`, "ok");
    onCreated(r.data.id);
  };
  return (
    <Dialog open={open} onClose={onClose} title="New project" footer={<><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" loading={busy} onClick={() => void submit()}>Create project</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><FormError message={err} /></div>
        <Input label="Project name" required className="sm:col-span-2" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} />
        <Select label="Lead" className="sm:col-span-2" hint={leads.error ?? "Linking a lead keeps the customer and the commercial history attached."} value={f.lead} onChange={(e) => setF((s) => ({ ...s, lead: e.target.value }))}>
          <option value="">No lead (internal project)</option>{leads.data?.map((l) => <option key={l.id} value={l.id}>{l.name}{l.company_name ? ` · ${l.company_name}` : ""} — {l.ref}</option>)}
        </Select>
        <Textarea label="Objective" className="sm:col-span-2" rows={2} value={f.objective} onChange={(e) => setF((s) => ({ ...s, objective: e.target.value }))} />
        <Textarea label="Scope" className="sm:col-span-2" rows={3} value={f.scope} onChange={(e) => setF((s) => ({ ...s, scope: e.target.value }))} />
        <Input label="Due" type="date" value={f.dueOn} onChange={(e) => setF((s) => ({ ...s, dueOn: e.target.value }))} />
      </div>
    </Dialog>
  );
}

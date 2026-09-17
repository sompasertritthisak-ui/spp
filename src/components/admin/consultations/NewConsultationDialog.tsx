"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FormError, Input, Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { db, exec } from "../ops/data";
import { fromVteInput } from "../ops/vientiane";
import { CHANNELS } from "./shared";

const blank = { name: "", company: "", email: "", phone: "", topic: "", goal: "", at: "", mins: "30", channel: "in_person" };

/** Phone and walk-in bookings. Created as REQUESTED so it still passes through approval. */
export function NewConsultationDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const [f, setF] = useState(blank);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bind = (k: keyof typeof blank) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value })) });
  const submit = async () => {
    const at = fromVteInput(f.at);
    if (f.name.trim().length < 2 || !f.email.trim() || f.topic.trim().length < 2 || !at) return setErr("Name, email, topic and a date/time are required.");
    setErr(null); setBusy(true);
    const r = await exec<{ id: string; ref: string }>(db().rpc("staff_create_consultation", { payload: { contact: { name: f.name, company: f.company, email: f.email, phone: f.phone }, topic: f.topic, goal: f.goal, preferredAt: at, durationMins: Number(f.mins), channel: f.channel } }));
    setBusy(false);
    if (r.error || !r.data) return setErr(r.error ?? "The consultation could not be created.");
    toast(`Consultation ${r.data.ref} created.`, "ok");
    setF(blank);
    onCreated(r.data.id);
  };
  return (
    <Dialog open={open} onClose={onClose} title="New consultation" footer={<><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" loading={busy} onClick={() => void submit()}>Create</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><FormError message={err} /></div>
        <Input label="Name" required autoComplete="off" {...bind("name")} />
        <Input label="Company" autoComplete="off" {...bind("company")} />
        <Input label="Email" required type="email" inputMode="email" autoComplete="off" {...bind("email")} />
        <Input label="Phone" type="tel" inputMode="tel" autoComplete="off" {...bind("phone")} />
        <Input label="Topic" required className="sm:col-span-2" {...bind("topic")} />
        <Input label="Date & time (Asia/Vientiane)" required type="datetime-local" {...bind("at")} />
        <Select label="Length" {...bind("mins")}>{[15, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}</Select>
        <Select label="Channel" {...bind("channel")}>{Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Textarea label="Goal" className="sm:col-span-2" rows={3} {...bind("goal")} />
      </div>
    </Dialog>
  );
}

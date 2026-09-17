"use client";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FormError, Input, Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { titleCase } from "@/lib/format";
import { db, exec, num } from "../ops/data";
import { PRIORITIES } from "./constants";

const schema = z.object({
  name: z.string().trim().min(2, "Enter the contact's name."),
  email: z.union([z.literal(""), z.email("That email address does not look right.")]),
  phone: z.string().trim(),
}).refine((v) => v.email || v.phone, { message: "Add an email address or a phone number.", path: ["phone"] });

const blank = { name: "", company: "", email: "", phone: "", message: "", value: "", priority: "normal", followUp: "" };

/** Walk-ins, phone calls, referrals. The reference number is issued by the database (staff_create_lead). */
export function NewLeadDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const [f, setF] = useState(blank);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bind = (k: keyof typeof blank) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value })) });

  const submit = async () => {
    const p = schema.safeParse(f);
    if (!p.success) return setErrs(Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrs({}); setErr(null); setBusy(true);
    const r = await exec<{ id: string; ref: string }>(db().rpc("staff_create_lead", { payload: { contact: { name: f.name, company: f.company, email: f.email, phone: f.phone }, source: "manual", message: f.message, estimatedValueLak: num(f.value) ?? "", priority: f.priority, followUpOn: f.followUp } }));
    setBusy(false);
    if (r.error || !r.data) return setErr(r.error ?? "The lead could not be created.");
    toast(`Lead ${r.data.ref} created.`, "ok");
    setF(blank);
    onCreated(r.data.id);
  };

  return (
    <Dialog open={open} onClose={onClose} title="New lead" footer={<><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" loading={busy} onClick={() => void submit()}>Create lead</Button></>}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div className="sm:col-span-2"><FormError message={err} /></div>
        <Input label="Contact name" required autoComplete="off" error={errs.name} {...bind("name")} />
        <Input label="Company" autoComplete="off" {...bind("company")} />
        <Input label="Email" type="email" inputMode="email" autoComplete="off" error={errs.email} {...bind("email")} />
        <Input label="Phone / WhatsApp" type="tel" inputMode="tel" autoComplete="off" error={errs.phone} {...bind("phone")} />
        <Input label="Estimated value (LAK)" inputMode="numeric" {...bind("value")} />
        <Select label="Priority" {...bind("priority")}>{PRIORITIES.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}</Select>
        <Input label="Follow up on" type="date" {...bind("followUp")} />
        <p className="self-end pb-3 text-sm text-fog-500">Source is recorded as <span className="text-fog-100">Manual</span> and the lead is assigned to you.</p>
        <Textarea label="What do they need?" className="sm:col-span-2" rows={3} {...bind("message")} />
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}

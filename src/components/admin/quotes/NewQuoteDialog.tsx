"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FormError, Input, Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useQuery } from "@/lib/backend/hooks";
import { db, exec } from "../ops/data";
import { adminInput } from "../ui";

type Line = { key: number; product: string; qty: string; note: string };
type LeadOpt = { id: string; ref: string; name: string; company_name: string };
const KINDS = ["product", "project", "bundle", "campaign"] as const;

/** Staff-drafted quote for a phone / walk-in customer. Starts as DRAFT: price it, then send. */
export function NewQuoteDialog({ open, leadId, onClose, onCreated }: { open: boolean; leadId: string | null; onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const products = useQuery<{ slug: string; name: string }[]>(() => db().from("products").select("slug,name").neq("status", "archived").order("name"), [], { enabled: open });
  const leads = useQuery<LeadOpt[]>(() => db().from("leads").select("id,ref,name,company_name").not("status", "in", "(won,lost)").order("created_at", { ascending: false }).limit(300), [], { enabled: open });
  const [lead, setLead] = useState(leadId ?? "");
  const [contact, setContact] = useState({ name: "", company: "", email: "", phone: "" });
  const [head, setHead] = useState({ kind: "product", neededBy: "", notes: "", help: false });
  const [lines, setLines] = useState<Line[]>([{ key: 1, product: "", qty: "1", note: "" }]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setLine = (key: number, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));

  const submit = async () => {
    const items = lines.filter((l) => l.product);
    if (!items.length) return setErr("Choose at least one product.");
    if (items.some((l) => !(Number(l.qty) >= 1))) return setErr("Every line needs a quantity of at least 1.");
    if (!lead && (contact.name.trim().length < 2 || (!contact.email.trim() && !contact.phone.trim()))) return setErr("Pick an existing lead, or enter a contact name with an email or phone number.");
    setErr(null); setBusy(true);
    const r = await exec<{ id: string; ref: string }>(db().rpc("staff_create_quote", { payload: { leadId: lead, contact, kind: head.kind, neededBy: head.neededBy, notes: head.notes, needsDesignHelp: head.help, items: items.map((l) => ({ product: l.product, qty: Math.floor(Number(l.qty)), note: l.note })) } }));
    setBusy(false);
    if (r.error || !r.data) return setErr(r.error ?? "The quote could not be created.");
    toast(`Draft ${r.data.ref} created — now price it.`, "ok");
    onCreated(r.data.id);
  };

  return (
    <Dialog open={open} onClose={onClose} wide title="New quote" footer={<><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" loading={busy} onClick={() => void submit()}>Create draft quote</Button></>}>
      <div className="flex flex-col gap-5">
        <FormError message={err} />
        <Select label="For lead" value={lead} onChange={(e) => setLead(e.target.value)} hint={leads.error ?? "Choose an open lead, or leave empty to enter a new contact (a lead is created for them)."}>
          <option value="">New contact…</option>
          {leads.data?.map((l) => <option key={l.id} value={l.id}>{l.name}{l.company_name ? ` · ${l.company_name}` : ""} — {l.ref}</option>)}
        </Select>
        {!lead && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Contact name" required autoComplete="off" value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} />
            <Input label="Company" autoComplete="off" value={contact.company} onChange={(e) => setContact((c) => ({ ...c, company: e.target.value }))} />
            <Input label="Email" type="email" inputMode="email" autoComplete="off" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} />
            <Input label="Phone" type="tel" inputMode="tel" autoComplete="off" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} />
          </div>
        )}
        <fieldset>
          <legend className="t-label mb-2 text-fog-400">Items</legend>
          {products.error && <p className="mb-2 text-sm text-danger">{products.error}</p>}
          <ul className="flex flex-col gap-2">
            {lines.map((l, n) => (
              <li key={l.key} className="grid grid-cols-[1fr_5rem] gap-2 sm:grid-cols-[1.5fr_5.5rem_1fr_auto]">
                <select aria-label={`Product, line ${n + 1}`} value={l.product} onChange={(e) => setLine(l.key, { product: e.target.value })} className={adminInput}><option value="">{products.loading ? "Loading products…" : "Choose a product…"}</option>{products.data?.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select>
                <input aria-label={`Quantity, line ${n + 1}`} type="number" min={1} inputMode="numeric" value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value })} className={`${adminInput} t-data`} />
                <input aria-label={`Note, line ${n + 1}`} value={l.note} onChange={(e) => setLine(l.key, { note: e.target.value })} placeholder="Colour, sizes, print…" className={`${adminInput} col-span-2 sm:col-span-1`} />
                <button type="button" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="t-label col-span-2 min-h-10 justify-self-end px-2 text-[0.625rem] text-fog-500 hover:text-danger disabled:opacity-30 sm:col-span-1">Remove</button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setLines((ls) => [...ls, { key: Math.max(...ls.map((x) => x.key)) + 1, product: "", qty: "1", note: "" }])} className="t-label mt-3 min-h-9 border border-ink-600 px-3 text-[0.625rem] text-fog-300 hover:border-yellow hover:text-yellow">Add line</button>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Kind" value={head.kind} onChange={(e) => setHead((h) => ({ ...h, kind: e.target.value }))}>{KINDS.map((k) => <option key={k} value={k}>{k[0]!.toUpperCase() + k.slice(1)}</option>)}</Select>
          <Input label="Needed by" type="date" value={head.neededBy} onChange={(e) => setHead((h) => ({ ...h, neededBy: e.target.value }))} />
          <Textarea label="Notes from the customer" className="sm:col-span-2" rows={3} value={head.notes} onChange={(e) => setHead((h) => ({ ...h, notes: e.target.value }))} />
          <label className="flex items-center gap-2 text-sm text-fog-300 sm:col-span-2"><input type="checkbox" checked={head.help} onChange={(e) => setHead((h) => ({ ...h, help: e.target.checked }))} className="accent-[var(--color-yellow)]" />Customer needs design help</label>
        </div>
      </div>
    </Dialog>
  );
}

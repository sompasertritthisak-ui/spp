"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { backend } from "@/lib/backend/client";
import { canDo, useAuth } from "@/lib/backend/auth";
import { adminNav } from "./nav";

type Item = { id: string; label: string; hint: string; href: string; keywords?: string };

const ACTIONS: (Item & { cap: string | null })[] = [
  { id: "a-lead", label: "Create lead", hint: "Action", href: "/admin/leads/?new=1", cap: "sales" },
  { id: "a-quote", label: "Create quote", hint: "Action", href: "/admin/quotes/?new=1", cap: "sales" },
  { id: "a-project", label: "Create project", hint: "Action", href: "/admin/projects/?new=1", cap: "sales" },
  { id: "a-consult", label: "Create consultation", hint: "Action", href: "/admin/consultations/?new=1", cap: "sales" },
  { id: "a-product", label: "Create product", hint: "Action", href: "/admin/products/?new=1", cap: "catalogue" },
  { id: "a-billboard", label: "Add billboard", hint: "Action", href: "/admin/billboards/?new=1", cap: "billboards" },
  { id: "a-site", label: "View public site", hint: "Open", href: "/", cap: null },
];

/** ⌘K / Ctrl+K. Navigates, runs create actions, and searches records by reference or name. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { profile } = useAuth();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Item[]>([]);
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const base = useMemo<Item[]>(() => {
    const nav = adminNav.flatMap((g) => g.items.filter((i) => !i.cap || canDo(profile?.role, i.cap)).map((i) => ({ id: i.href, label: `Open ${i.label}`, hint: g.label, href: i.href, keywords: i.keywords })));
    return [...nav, ...ACTIONS.filter((a) => !a.cap || canDo(profile?.role, a.cap))];
  }, [profile?.role]);

  useEffect(() => { if (open) { setQ(""); setHits([]); setIdx(0); setTimeout(() => input.current?.focus(), 0); } }, [open]);

  // Record search (debounced). RLS decides what each role can find.
  useEffect(() => {
    const term = q.trim();
    const b = backend();
    if (!open || !b || term.length < 2) return setHits([]);
    const like = `%${term.replace(/[%_,()]/g, "")}%`;
    const t = setTimeout(async () => {
      const found: Item[] = [];
      const add = (rows: { id: string; ref?: string; name?: string; code?: string }[] | null, hint: string, href: (id: string) => string, label: (r: { ref?: string; name?: string; code?: string }) => string) => rows?.forEach((r) => found.push({ id: `${hint}-${r.id}`, hint, href: href(r.id), label: label(r) }));
      const [leads, quotes, orders, designs, boards] = await Promise.all([
        canDo(profile?.role, "sales") ? b.from("leads").select("id,ref,name").or(`ref.ilike.${like},name.ilike.${like},company_name.ilike.${like}`).limit(5) : null,
        canDo(profile?.role, "sales") ? b.from("quotes").select("id,ref").ilike("ref", like).limit(5) : null,
        canDo(profile?.role, "sales") ? b.from("orders").select("id,ref").ilike("ref", like).limit(5) : null,
        canDo(profile?.role, "designs") ? b.from("designs").select("id,ref,name").or(`ref.ilike.${like},name.ilike.${like}`).limit(5) : null,
        canDo(profile?.role, "billboards") ? b.from("billboards").select("id,code,name").or(`code.ilike.${like},name.ilike.${like}`).limit(5) : null,
      ]);
      add(leads?.data ?? null, "Lead", (id) => `/admin/leads/?id=${id}`, (r) => `${r.ref} · ${r.name}`);
      add(quotes?.data ?? null, "Quote", (id) => `/admin/quotes/?id=${id}`, (r) => r.ref ?? "");
      add(orders?.data ?? null, "Order", (id) => `/admin/orders/?id=${id}`, (r) => r.ref ?? "");
      add(designs?.data ?? null, "Design", (id) => `/admin/designs/?id=${id}`, (r) => `${r.ref} · ${r.name}`);
      add(boards?.data ?? null, "Billboard", (id) => `/admin/billboards/?id=${id}`, (r) => `${r.code} · ${r.name}`);
      setHits(found);
    }, 220);
    return () => clearTimeout(t);
  }, [q, open, profile?.role]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const nav = term ? base.filter((i) => `${i.label} ${i.hint} ${i.keywords ?? ""}`.toLowerCase().includes(term)) : base;
    return [...hits, ...nav].slice(0, 14);
  }, [q, base, hits]);
  useEffect(() => setIdx(0), [q]);

  if (!open) return null;
  const go = (i: Item | undefined) => { if (!i) return; onClose(); router.push(i.href); };

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-xl border border-ink-500 bg-ink-900 shadow-2xl shadow-black [animation:register_.2s_var(--ease-press)]">
        <input
          ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search records, jump to a section, or run an action…"
          role="combobox" aria-expanded aria-controls="cmd-list" aria-activedescendant={list[idx] ? `cmd-${idx}` : undefined} aria-label="Command"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, list.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); go(list[idx]); }
            else if (e.key === "Escape") onClose();
          }}
          className="h-14 w-full border-b border-ink-700 bg-transparent px-5 text-base text-fog-50 placeholder:text-fog-500 focus:outline-none"
        />
        <ul id="cmd-list" role="listbox" className="thin-scroll max-h-[50vh] overflow-y-auto py-2">
          {list.map((i, n) => (
            <li key={i.id} id={`cmd-${n}`} role="option" aria-selected={n === idx} onMouseEnter={() => setIdx(n)} onClick={() => go(i)} className={`flex min-h-11 cursor-pointer items-center justify-between gap-4 px-5 text-sm ${n === idx ? "bg-ink-800 text-fog-50" : "text-fog-300"}`}>
              <span className="truncate">{i.label}</span><span className="t-label flex-none text-fog-500">{i.hint}</span>
            </li>
          ))}
          {list.length === 0 && <li className="px-5 py-6 text-sm text-fog-500">No matches.</li>}
        </ul>
        <p className="t-label flex gap-4 border-t border-ink-700 px-5 py-2.5 text-fog-500"><span>↑↓ navigate</span><span>↵ open</span><span>esc close</span></p>
      </div>
    </div>
  );
}

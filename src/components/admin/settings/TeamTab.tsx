"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth, type Role } from "@/lib/backend/auth";
import { backend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import type { ProfilesRow } from "@/lib/backend/db-types";
import { formatDate } from "@/lib/format";
import { useConfirm } from "../resource/Confirm";
import { adminError } from "../resource/errors";
import { inputCls, TextField } from "../resource/fields";
import { DataTable, ErrorNote, Panel, StatusPill } from "../ui";

type Staff = Pick<ProfilesRow, "id" | "email" | "full_name" | "role" | "created_at">;
const ROLE_INFO: Record<Role, string> = {
  super_admin: "Everything, including granting and revoking admin rights.",
  admin: "Everything except granting admin rights: content, catalogue, pricing, sales, production, settings, audit log.",
  sales: "Leads, quotes, orders, consultations, designs, billboards and bookings, catalogue; reads pricing.",
  designer: "Designs and artwork review, production jobs.",
  production: "Production jobs, QC and deliveries.",
  marketing: "CMS content, catalogue, billboards, campaigns and QR codes, analytics.",
  customer: "No staff access — the customer portal only.",
};
const STAFF_ROLES: Role[] = ["sales", "designer", "production", "marketing"];
const label = (r: string) => r.replace("_", " ");

export function TeamTab() {
  const { profile } = useAuth();
  const toast = useToast();
  const isSuper = profile?.role === "super_admin";
  const staff = useQuery<Staff[]>(() => backend()!.from("profiles").select("id,email,full_name,role,created_at").neq("role", "customer").order("role").order("full_name"), []);
  const [confirm, confirmUi] = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const grantable: Role[] = isSuper ? ["super_admin", "admin", ...STAFF_ROLES, "customer"] : [...STAFF_ROLES, "customer"];
  const elevated = (r: string) => r === "admin" || r === "super_admin";

  const change = async (target: Staff, role: Role) => {
    if (role === target.role) return true;
    const who = target.full_name || target.email;
    const ok = await confirm(
      elevated(role) ? { title: `Grant ${label(role)} rights to ${who}?`, danger: true, confirmLabel: `Make ${label(role)}`, body: <>This person will be able to change pricing, settings and other people&apos;s roles, and read the audit log. Only do this for someone who must run the whole system.</> }
      : role === "customer" ? { title: `Remove staff access from ${who}?`, danger: true, confirmLabel: "Remove access", body: "They will be signed out of the Command Center immediately and keep only a customer account. Their past work stays in the records." }
      : { title: `Change ${who} to ${label(role)}?`, confirmLabel: "Change role", body: ROLE_INFO[role] });
    if (!ok) return false;
    setBusy(target.id);
    const r = await backend()!.rpc("set_user_role", { target: target.id, new_role: role });
    setBusy(null);
    if (r.error) { toast(/super admin/i.test(r.error.message ?? "") ? "Only a super admin can grant or remove admin rights." : /own role/i.test(r.error.message ?? "") ? "You cannot change your own role." : adminError(r.error), "danger"); return false; }
    toast(`${who} is now ${label(role)}.`, "ok");
    void staff.reload();
    return true;
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel title="How roles work">
        <ul className="grid gap-x-8 gap-y-1 text-sm leading-relaxed text-fog-400 lg:grid-cols-3">
          <li>Admins manage staff roles: sales, designer, production, marketing — and can remove staff access.</li>
          <li>Only a <strong className="text-fog-200">super admin</strong> can grant or remove admin and super admin rights.</li>
          <li>Nobody can change their own role. The database enforces all of this; this screen only reflects it.</li>
        </ul>
      </Panel>
      <Panel title="Staff" flush>
        <ErrorNote message={staff.error} onRetry={() => void staff.reload()} />
        <DataTable caption="Staff" rows={staff.error ? [] : staff.data} loading={staff.loading} rowKey={(s) => s.id} empty="No staff accounts yet."
          columns={[
            { key: "who", header: "Person", cell: (s) => <span><span className="block text-fog-50">{s.full_name || "—"}{s.id === profile?.id && <span className="t-label ml-2 text-yellow">You</span>}</span><span className="block text-xs text-fog-500">{s.email}</span></span> },
            { key: "role", header: "Role", cell: (s) => <StatusPill status={s.role} /> },
            { key: "since", header: "Since", hideBelow: "md", cell: (s) => <span className="t-data text-fog-400">{formatDate(s.created_at)}</span> },
            { key: "change", header: "Change role", cell: (s) => s.id === profile?.id ? <span className="text-xs text-fog-500">You cannot change your own role.</span> : elevated(s.role) && !isSuper ? <span className="text-xs text-fog-500">Super admin only.</span> : (
              <select aria-label={`Role for ${s.full_name || s.email}`} disabled={busy === s.id} value={s.role} onChange={(e) => void change(s, e.target.value as Role)} className={`${inputCls} w-auto min-w-36 pr-8`}>
                {[...new Set([s.role as Role, ...grantable])].map((r) => <option key={r} value={r}>{r === "customer" ? "Remove staff access" : label(r)}</option>)}
              </select>
            ) },
          ]} />
      </Panel>
      <Promote grantable={grantable.filter((r) => r !== "customer")} onPromote={change} selfId={profile?.id ?? ""} />
      <Panel title="What each role can do">
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">{(Object.keys(ROLE_INFO) as Role[]).map((r) => <div key={r}><dt className="t-label text-fog-300">{label(r)}</dt><dd className="mt-0.5 leading-relaxed text-fog-400">{ROLE_INFO[r]}</dd></div>)}</dl>
      </Panel>
      {confirmUi}
    </div>
  );
}

/** Staff must first create an ordinary account; an admin then finds it by email and assigns a role. */
function Promote({ grantable, onPromote, selfId }: { grantable: Role[]; onPromote: (t: Staff, r: Role) => Promise<boolean>; selfId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("sales");
  const [state, setState] = useState<{ status: "idle" | "searching" | "none" | "error"; match: Staff | null; message?: string }>({ status: "idle", match: null });
  const find = async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return setState({ status: "error", match: null, message: "Enter the full email address of the account." });
    setState({ status: "searching", match: null });
    const r = await backend()!.from("profiles").select("id,email,full_name,role,created_at").eq("email", e).maybeSingle();
    if (r.error) return setState({ status: "error", match: null, message: adminError(r.error) });
    setState(r.data ? { status: "idle", match: r.data as Staff } : { status: "none", match: null });
  };
  const m = state.match;
  return (
    <Panel title="Add a team member">
      <p className="mb-4 max-w-2xl text-sm leading-relaxed text-fog-400">The person first registers a normal account on the site (Register → confirm email). Then find that account here by its exact email address and give it a role.</p>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void find(); }}>
        <TextField className="min-w-0 flex-1 basis-64" label="Account email" type="email" inputMode="email" autoComplete="off" value={email} onChange={(v) => { setEmail(v); setState({ status: "idle", match: null }); }} error={state.status === "error" ? state.message : null} />
        <Button type="submit" variant="outline" size="sm" className="mb-0 min-h-11" loading={state.status === "searching"}>Find account</Button>
      </form>
      <div aria-live="polite" className="mt-4">
        {state.status === "none" && <p className="text-sm text-fog-400">No account uses that email yet. Ask them to register first, then search again.</p>}
        {m && (
          <div className="flex flex-wrap items-center gap-3 border border-ink-700 bg-ink-950 p-3">
            <div className="min-w-0 flex-1 basis-48"><p className="truncate text-sm text-fog-50">{m.full_name || "No name given"}</p><p className="truncate text-xs text-fog-500">{m.email} · currently {label(m.role)}</p></div>
            {m.id === selfId ? <p className="text-sm text-fog-500">That is you — you cannot change your own role.</p> : (m.role === "admin" || m.role === "super_admin") && !grantable.includes("admin") ? <p className="text-sm text-fog-500">Only a super admin can change this account.</p> : (
              <>
                <select aria-label="Role to assign" value={role} onChange={(e) => setRole(e.target.value as Role)} className={`${inputCls} w-auto pr-8`}>{grantable.map((r) => <option key={r} value={r}>{label(r)}</option>)}</select>
                <Button size="sm" className="min-h-11" disabled={role === m.role} onClick={async () => { if (await onPromote(m, role)) { setState({ status: "idle", match: null }); setEmail(""); } }}>Assign role</Button>
              </>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

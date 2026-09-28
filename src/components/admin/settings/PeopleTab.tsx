"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/backend/auth";
import { backend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import type { ProfilesRow } from "@/lib/backend/db-types";
import { formatDate } from "@/lib/format";
import { useConfirm } from "../resource/Confirm";
import { adminError } from "../resource/errors";
import { inputCls, TextField } from "../resource/fields";
import { adminInput, DataTable, ErrorNote, Panel, ViewOnlyTag } from "../ui";
import { RoleChip } from "./RoleChip";
import { capSummary, roleError, useRoles, type RoleRow } from "./roles";

type Person = Pick<ProfilesRow, "id" | "email" | "full_name" | "role" | "role_id" | "created_at">;
const COLS = "id,email,full_name,role,role_id,created_at";
const REMOVE = "customer";
const elevated = (key: string | undefined) => key === "admin" || key === "super_admin";

export function PeopleTab() {
  const { profile, access, canWrite } = useAuth();
  const toast = useToast();
  const mayAssign = canWrite("team");
  const myRank = access.superAdmin ? 100 : access.role?.rank ?? 0;
  const people = useQuery<Person[]>(() => backend()!.from("profiles").select(COLS).neq("role", "customer").order("full_name"), []);
  const { roles, error: rolesError, reload: reloadRoles } = useRoles();
  const [confirm, confirmUi] = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [only, setOnly] = useState("");

  const byId = useMemo(() => new Map((roles ?? []).map((r) => [r.id, r])), [roles]);
  const roleOf = (p: Person) => (p.role_id ? byId.get(p.role_id) : undefined);
  // The same rules assign_role() enforces: strictly below the caller, and admin rights only from a super admin.
  const grantable = useMemo(() => (roles ?? []).filter((r) => access.superAdmin || (r.rank < myRank && !elevated(r.key))), [roles, access.superAdmin, myRank]);
  const whyLocked = (p: Person): string | null => {
    if (p.id === profile?.id) return "You cannot change your own role.";
    if (!mayAssign) return "Your role cannot assign roles.";
    if (access.superAdmin) return null;
    const r = roleOf(p);
    if (elevated(r?.key) || p.role === "admin" || p.role === "super_admin") return "Super admin only.";
    if ((r?.rank ?? 0) >= myRank) return "At or above your rank.";
    return null;
  };

  const change = async (target: Person, key: string) => {
    const from = roleOf(target), to = roles?.find((r) => r.key === key);
    if (key !== REMOVE && (!to || to.id === from?.id)) return true;
    const who = target.full_name || target.email;
    const ok = await confirm(
      key === REMOVE ? { title: `Remove staff access from ${who}?`, danger: true, confirmLabel: "Remove access", body: "They lose the Command Center immediately and keep only a customer account. Their past work stays in the records." }
      : elevated(key) ? { title: `Make ${who} ${to!.name}?`, danger: true, confirmLabel: `Make ${to!.name}`, body: <>This person will be able to change pricing and settings, give roles to other people and read the audit log. Only do this for someone who must run the whole system.</> }
      : { title: `${from ? "Move" : "Add"} ${who} ${from ? "to" : "as"} ${to!.name}?`, confirmLabel: from ? "Change role" : "Give role", body: <><span className="block">{to!.description || "No description has been written for this role."}</span><span className="t-label mt-3 block text-fog-400">Rank {to!.rank} · {capSummary(to!.caps)}</span></> });
    if (!ok) return false;
    setBusy(target.id);
    const r = await backend()!.rpc("assign_role", { target: target.id, p_role_key: key });
    setBusy(null);
    if (r.error) { toast(roleError(r.error), "danger"); return false; }
    toast(key === REMOVE ? `${who} no longer has staff access.` : `${who} is now ${to!.name}.`, "ok");
    void people.reload(); void reloadRoles();
    return true;
  };

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rank = (p: Person) => (p.role_id ? byId.get(p.role_id)?.rank ?? 0 : 0);
    return people.data?.filter((p) => (!only || (p.role_id ? byId.get(p.role_id)?.key : undefined) === only) && (!term || `${p.full_name} ${p.email}`.toLowerCase().includes(term)))
      .sort((a, b) => rank(b) - rank(a) || (a.full_name || a.email).localeCompare(b.full_name || b.email)) ?? null;
  }, [people.data, byId, search, only]);

  return (
    <div className="flex flex-col gap-4">
      <Panel title="How people get access" action={!mayAssign ? <ViewOnlyTag /> : undefined}>
        <ol className="grid gap-x-8 gap-y-2 text-sm leading-relaxed text-fog-400 lg:grid-cols-3">
          <li><span className="t-data mr-2 text-yellow">1</span>The person registers on the site like any customer and confirms their email.</li>
          <li><span className="t-data mr-2 text-yellow">2</span>Someone with the Team capability finds that account below and gives it a role.</li>
          <li><span className="t-data mr-2 text-yellow">3</span>You can only give roles <strong className="text-fog-200">below your own rank</strong>, to people below your rank. Nobody can change their own role.</li>
        </ol>
      </Panel>

      <Panel title={`Staff${people.data ? ` · ${people.data.length}` : ""}`} flush>
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 p-3">
          <input type="search" aria-label="Search people" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email…" className={`${adminInput} max-w-xs`} />
          <select aria-label="Filter by role" value={only} onChange={(e) => setOnly(e.target.value)} className={`${adminInput} w-auto`}>
            <option value="">All roles</option>
            {roles?.map((r) => <option key={r.key} value={r.key}>{r.name} · {r.members}</option>)}
          </select>
          <p className="t-data ml-auto text-xs text-fog-500" aria-live="polite">{shown ? `${shown.length} shown` : ""}</p>
        </div>
        <div className="px-4 pt-4 empty:hidden"><ErrorNote message={people.error ?? rolesError} onRetry={() => { void people.reload(); void reloadRoles(); }} /></div>
        <DataTable caption="Staff" rows={people.error ? [] : shown} loading={people.loading} rowKey={(s) => s.id} empty={search || only ? "Nobody matches that filter." : "No staff accounts yet."}
          columns={[
            { key: "who", header: "Person", cell: (s) => <span className="block min-w-40"><span className="block text-fog-50">{s.full_name || "—"}{s.id === profile?.id && <span className="t-label ml-2 text-yellow">You</span>}</span><span className="block text-xs text-fog-500">{s.email}</span></span> },
            { key: "role", header: "Role", cell: (s) => { const r = roleOf(s); return <RoleChip name={r?.name ?? s.role.replace(/_/g, " ")} colour={r?.colour} />; } },
            { key: "rank", header: "Rank", className: "text-right", hideBelow: "sm", cell: (s) => <span className="t-data text-fog-300">{roleOf(s)?.rank ?? "—"}</span> },
            { key: "since", header: "Since", hideBelow: "md", cell: (s) => <span className="t-data text-xs text-fog-400">{formatDate(s.created_at)}</span> },
            { key: "change", header: "Change role", cell: (s) => {
              const locked = whyLocked(s);
              if (locked) return <span className="text-xs text-fog-500">{locked}</span>;
              const current = roleOf(s);
              return (
                <select aria-label={`Role for ${s.full_name || s.email}`} disabled={busy === s.id || !roles} value={current?.key ?? ""} onChange={(e) => void change(s, e.target.value)} className={`${inputCls} w-auto min-w-44 pr-8`}>
                  {current && !grantable.some((r) => r.id === current.id) && <option value={current.key}>{current.name}</option>}
                  {!current && <option value="">Choose a role…</option>}
                  {grantable.map((r) => <option key={r.key} value={r.key}>{r.name} · {r.rank}</option>)}
                  <option value={REMOVE}>Remove staff access</option>
                </select>
              );
            } },
          ]} />
      </Panel>

      {mayAssign && <AddPerson grantable={grantable} roleOf={roleOf} whyLocked={whyLocked} onAssign={change} />}
      {confirmUi}
    </div>
  );
}

/** A new colleague registers an ordinary account first; it is then found here by its exact email. */
function AddPerson({ grantable, roleOf, whyLocked, onAssign }: { grantable: RoleRow[]; roleOf: (p: Person) => RoleRow | undefined; whyLocked: (p: Person) => string | null; onAssign: (p: Person, key: string) => Promise<boolean> }) {
  const [email, setEmail] = useState("");
  const [key, setKey] = useState("");
  const [state, setState] = useState<{ status: "idle" | "searching" | "none" | "error"; match: Person | null; message?: string }>({ status: "idle", match: null });
  const find = async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return setState({ status: "error", match: null, message: "Enter the full email address of the account." });
    setState({ status: "searching", match: null });
    const r = await backend()!.from("profiles").select(COLS).eq("email", e).maybeSingle();
    if (r.error) return setState({ status: "error", match: null, message: adminError(r.error) });
    setState(r.data ? { status: "idle", match: r.data as Person } : { status: "none", match: null });
  };
  const m = state.match, current = m ? roleOf(m) : undefined, locked = m ? whyLocked(m) : null;
  const chosen = grantable.find((r) => r.key === key);
  return (
    <Panel title="Add a person">
      <p className="mb-4 max-w-2xl text-sm leading-relaxed text-fog-400">The person registers on the site first (Register → confirm email). Then find that account here by its exact email address and give it a role. There are no invitations to send and no passwords to share.</p>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void find(); }}>
        <TextField className="min-w-0 flex-1 basis-64" label="Account email" type="email" inputMode="email" autoComplete="off" value={email} onChange={(v) => { setEmail(v); setState({ status: "idle", match: null }); }} error={state.status === "error" ? state.message : null} />
        <Button type="submit" variant="outline" size="sm" className="mb-0 min-h-11" loading={state.status === "searching"}>Find account</Button>
      </form>
      <div aria-live="polite" className="mt-4">
        {state.status === "none" && <p className="text-sm text-fog-400">No account uses that email yet. Ask them to register first, then search again.</p>}
        {m && (
          <div className="flex flex-wrap items-center gap-3 border border-ink-700 bg-ink-950 p-3">
            <div className="min-w-0 flex-1 basis-48"><p className="truncate text-sm text-fog-50">{m.full_name || "No name given"}</p><p className="truncate text-xs text-fog-500">{m.email} · currently {current?.name ?? (m.role === "customer" ? "a customer" : m.role.replace(/_/g, " "))}</p></div>
            {locked ? <p className="text-sm text-fog-500">{locked}</p> : (
              <>
                <select aria-label="Role to give" value={key} onChange={(e) => setKey(e.target.value)} className={`${inputCls} w-auto pr-8`}><option value="">Choose a role…</option>{grantable.map((r) => <option key={r.key} value={r.key}>{r.name} · {r.rank}</option>)}</select>
                <Button size="sm" className="min-h-11" disabled={!chosen || chosen.id === current?.id} onClick={async () => { if (await onAssign(m, key)) { setState({ status: "idle", match: null }); setEmail(""); setKey(""); } }}>Give role</Button>
              </>
            )}
            {chosen && !locked && <p className="basis-full text-xs leading-relaxed text-fog-500">{chosen.description || "No description."} <span className="t-label ml-1 text-fog-400">{capSummary(chosen.caps)}</span></p>}
          </div>
        )}
      </div>
    </Panel>
  );
}

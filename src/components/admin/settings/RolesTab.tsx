"use client";
import { clsx } from "clsx";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { GRANTABLE_DOMAINS, useAuth } from "@/lib/backend/auth";
import { ErrorNote, Panel, ViewOnlyTag } from "../ui";
import { RoleDrawer } from "./RoleDrawer";
import { capSummary, DOMAIN_INFO, SUPER_RANK, useRoles, type RoleDraft, type RoleRow } from "./roles";

type Editing = { role: RoleRow | null; seed: RoleDraft | null } | null;
const LEVEL = { edit: { mark: "Edit", cls: "text-yellow" }, view: { mark: "View", cls: "text-sky" } } as const;

/** Roles are a ladder: the higher the rank, the more senior. Only the super admin changes it; everyone on staff can read it. */
export function RolesTab({ onDirty }: { onDirty: (d: boolean) => void }) {
  const { access, refreshProfile } = useAuth();
  const canEdit = access.superAdmin;
  const { roles, loading, error, reload } = useRoles();
  const [editing, setEditing] = useState<Editing>(null);

  const duplicate = (r: RoleRow) => setEditing({ role: null, seed: { key: "", name: `${r.name} copy`, description: r.description, colour: r.colour, rank: Math.min(r.rank, SUPER_RANK - 1), caps: { ...r.caps } } });
  const close = () => { setEditing(null); onDirty(false); };
  // the super admin may have just changed the role they are looking through
  const saved = () => { close(); void reload(); void refreshProfile(); };

  return (
    <div className="flex flex-col gap-4">
      <Panel title="How the hierarchy works" action={!canEdit ? <ViewOnlyTag /> : undefined}>
        <ul className="grid gap-x-8 gap-y-2 text-sm leading-relaxed text-fog-400 lg:grid-cols-3">
          <li><strong className="text-fog-200">Rank</strong> runs from 1 to 99; the super admin is always 100. A higher number is more senior. Two roles may share a rank.</li>
          <li>Each role may <strong className="text-sky">view</strong> or <strong className="text-yellow">edit</strong> each area. View shows the screen with every control switched off — and the database refuses the change even if someone tries.</li>
          <li>People with the <strong className="text-fog-200">Team</strong> capability give out roles below their own rank. Only the super admin creates roles, changes them, or grants admin rights.</li>
        </ul>
      </Panel>

      <Panel title={`Roles${roles ? ` · ${roles.length}` : ""}`} flush action={canEdit ? <Button size="sm" onClick={() => setEditing({ role: null, seed: null })}>New role</Button> : undefined}>
        <div className="px-4 pt-4 empty:hidden"><ErrorNote message={error} onRetry={() => void reload()} /></div>
        {loading && !roles && <div className="grid gap-px p-4">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-16" />)}</div>}
        <ol aria-label="Roles, most senior first">
          {roles?.map((r, i) => {
            const tied = roles[i - 1]?.rank === r.rank || roles[i + 1]?.rank === r.rank;
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-ink-800 px-4 py-3.5 last:border-0 hover:bg-ink-850">
                <div className="flex w-16 flex-none flex-col">
                  <span className="t-data text-2xl font-medium leading-none text-fog-50">{r.rank}</span>
                  <span className="t-label mt-1.5 text-[0.5625rem] text-fog-500">{r.rank === SUPER_RANK ? "Top" : tied ? "Shared rank" : "Rank"}</span>
                </div>
                <span aria-hidden className="h-10 w-0.5 flex-none bg-ink-600" style={r.colour ? { backgroundColor: r.colour } : undefined} />
                <div className="min-w-0 flex-1 basis-64">
                  <p className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-fog-50">{r.name}</span>{r.isSystem ? <span className="t-label border border-ink-500 px-1.5 py-0.5 text-[0.5625rem] text-fog-400">Built in</span> : <span className="t-label border border-gold/40 px-1.5 py-0.5 text-[0.5625rem] text-yellow">Custom</span>}<span className="t-data text-xs text-fog-500">{r.key}</span></p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-fog-400">{r.description || "No description."}</p>
                </div>
                <div className="flex-none basis-36"><p className="t-label text-[0.625rem] text-fog-300">{capSummary(r.caps)}</p><p className="mt-1 text-xs text-fog-500">{r.members === 0 ? "Nobody yet" : `${r.members} ${r.members === 1 ? "person" : "people"}`}</p></div>
                <div className="flex flex-none gap-1">
                  <button type="button" onClick={() => setEditing({ role: r, seed: null })} className="t-label min-h-10 px-2 text-fog-300 hover:text-fog-50">{canEdit ? "Edit" : "View"}<span className="sr-only"> {r.name}</span></button>
                  {canEdit && <button type="button" onClick={() => duplicate(r)} className="t-label min-h-10 px-2 text-fog-300 hover:text-fog-50">Duplicate<span className="sr-only"> {r.name}</span></button>}
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>

      {roles && roles.length > 0 && (
        <Panel title="Who can do what" flush>
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Capabilities of every role</caption>
              <thead><tr className="border-b border-ink-700 text-left"><th scope="col" className="t-label sticky left-0 h-10 bg-ink-900 px-4 font-medium text-fog-500">Role</th>{DOMAIN_INFO.map((d) => <th key={d.key} scope="col" title={d.covers} className="t-label h-10 whitespace-nowrap px-3 font-medium text-fog-500">{d.label}</th>)}</tr></thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.id} className="border-b border-ink-800 last:border-0">
                    <th scope="row" className="sticky left-0 whitespace-nowrap bg-ink-900 px-4 py-2.5 text-left font-normal text-fog-100"><span className="t-data mr-2 text-xs text-fog-500">{r.rank}</span>{r.name}</th>
                    {DOMAIN_INFO.map((d) => { const l = r.caps[d.key]; return <td key={d.key} className={clsx("t-label px-3 py-2.5 text-[0.625rem]", l ? LEVEL[l].cls : "text-ink-500")}>{l ? LEVEL[l].mark : "—"}</td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-ink-700 px-4 py-3 text-xs leading-relaxed text-fog-500">{GRANTABLE_DOMAINS.length} areas can be given to a role. <strong className="text-fog-300">Security</strong> — creating roles, the hierarchy itself and admin rights — is never on this list: it belongs to the super admin alone.</p>
        </Panel>
      )}

      {editing && roles && <RoleDrawer key={editing.role?.id ?? `new-${editing.seed?.name ?? ""}`} role={editing.role} seed={editing.seed} roles={roles} canEdit={canEdit} onDirty={onDirty} onClose={close} onSaved={saved} onDuplicate={duplicate} />}
    </div>
  );
}

"use client";
import { clsx } from "clsx";
import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { GRANTABLE_DOMAINS, type CapLevel, type Domain } from "@/lib/backend/auth";
import { backend } from "@/lib/backend/client";
import { DISCARD, useConfirm } from "../resource/Confirm";
import { AreaField, FieldShell, inputCls, NumberField, TextField } from "../resource/fields";
import { Drawer, ErrorNote } from "../ui";
import { DOMAIN_INFO, MAX_RANK, ROLE_COLOURS, ROLE_TEMPLATES, roleError, slugify, SUPER_RANK, validKey, type Caps, type RoleDraft, type RoleRow } from "./roles";

const BLANK: RoleDraft = { key: "", name: "", description: "", rank: 40, colour: null, caps: {} };
const LEVELS: readonly { value: CapLevel | "none"; label: string }[] = [{ value: "none", label: "None" }, { value: "view", label: "View" }, { value: "edit", label: "Edit" }];
const clampRank = (n: number) => Math.max(1, Math.min(MAX_RANK, Math.round(n)));
const tidy = (caps: Caps): Caps => Object.fromEntries(GRANTABLE_DOMAINS.filter((d) => caps[d]).map((d) => [d, caps[d]])) as Caps;

export function RoleDrawer({ role, seed, roles, canEdit, onDirty, onClose, onSaved, onDuplicate }: { role: RoleRow | null; seed: RoleDraft | null; roles: RoleRow[]; canEdit: boolean; onDirty: (d: boolean) => void; onClose: () => void; onSaved: () => void; onDuplicate: (r: RoleRow) => void }) {
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();
  const initial = useMemo<RoleDraft>(() => (role ? { key: role.key, name: role.name, description: role.description, rank: role.rank, colour: role.colour, caps: tidy(role.caps) } : seed ?? BLANK), [role, seed]);
  const [v, setV] = useState<RoleDraft>(initial);
  const [keyTouched, setKeyTouched] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; key?: string; rank?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const matrixId = useId();

  const isNew = !role, isSuper = role?.key === "super_admin";
  const locked = !canEdit;
  const key = isNew ? (keyTouched ? v.key : slugify(v.name)) : v.key;
  const dirty = JSON.stringify({ ...v, key, caps: tidy(v.caps) }) !== JSON.stringify({ ...initial, key: isNew ? slugify(initial.name) : initial.key }) || (isNew && seed !== null);
  useEffect(() => { onDirty(dirty && canEdit); }, [dirty, canEdit, onDirty]);

  const others = roles.filter((r) => r.id !== role?.id && r.key !== "super_admin");
  const above = others.filter((r) => r.rank > v.rank).sort((a, b) => a.rank - b.rank)[0];
  const below = others.filter((r) => r.rank < v.rank).sort((a, b) => b.rank - a.rank)[0];
  const level = others.filter((r) => r.rank === v.rank);
  const setCap = (d: Domain, l: CapLevel | "none") => setV((s) => { const caps = { ...s.caps }; if (l === "none") delete caps[d]; else caps[d] = l; return { ...s, caps }; });
  const setAll = (l: CapLevel | "none") => setV((s) => ({ ...s, caps: l === "none" ? {} : (Object.fromEntries(GRANTABLE_DOMAINS.map((d) => [d, l])) as Caps) }));

  const close = async () => { if (!dirty || locked || (await confirm(DISCARD))) onClose(); };
  const save = async () => {
    const e: typeof errors = {};
    if (v.name.trim().length < 2 || v.name.trim().length > 60) e.name = "Give the role a name of 2–60 characters.";
    if (!validKey(key)) e.key = "2–40 lowercase letters, digits or hyphens, starting with a letter.";
    else if (isNew && roles.some((r) => r.key === key)) e.key = "Another role already uses that key.";
    if (!isSuper && (!Number.isInteger(v.rank) || v.rank < 1 || v.rank > MAX_RANK)) e.rank = "Rank is a whole number from 1 to 99.";
    setErrors(e);
    if (Object.keys(e).length) return;
    if (role && role.members > 0 && JSON.stringify(tidy(v.caps)) !== JSON.stringify(tidy(role.caps))
      && !(await confirm({ title: `Change what ${role.name} can do?`, confirmLabel: "Save changes", body: `${role.members} ${role.members === 1 ? "person is" : "people are"} on this role. The change applies to them the next time they load a screen.` }))) return;
    setBusy("save"); setFailure(null);
    const r = await backend()!.rpc("save_role", { p_key: key, p_name: v.name.trim(), p_description: v.description.trim(), p_rank: isSuper ? SUPER_RANK : v.rank, p_caps: tidy(v.caps), p_colour: v.colour });
    setBusy(null);
    if (r.error) return setFailure(roleError(r.error));
    toast(isNew ? `${v.name.trim()} created. Give it to people under People.` : `${v.name.trim()} saved.`, "ok");
    onSaved();
  };
  const remove = async () => {
    if (!role || !(await confirm({ title: `Delete ${role.name}?`, danger: true, confirmLabel: "Delete role", body: "Nobody is on this role, so nobody loses access. This cannot be undone." }))) return;
    setBusy("delete"); setFailure(null);
    const r = await backend()!.rpc("delete_role", { p_key: role.key });
    setBusy(null);
    if (r.error) return setFailure(roleError(r.error));
    toast(`${role.name} deleted.`, "ok");
    onSaved();
  };
  const whyNoDelete = !role ? null : role.isSystem ? "Built-in roles cannot be deleted." : role.members > 0 ? `${role.members} ${role.members === 1 ? "person is" : "people are"} on this role — move them first.` : null;

  return (
    <Drawer open onClose={() => void close()} title={isNew ? "New role" : role.name}
      sub={<span className="flex flex-wrap items-center gap-2">{role && <span className="t-data">{role.key}</span>}{role?.isSystem && <span className="t-label text-[0.625rem] text-fog-400">Built in</span>}{locked && <span className="t-label text-[0.625rem] text-sky">View only · the super admin edits roles</span>}{dirty && !locked && <span className="t-label text-[0.625rem] text-warn">Unsaved changes</span>}</span>}
      footer={locked ? <Button variant="ghost" onClick={onClose}>Close</Button> : (
        <>
          {role && <span className="mr-auto flex flex-wrap items-center gap-2"><Button variant="danger" size="sm" disabled={Boolean(whyNoDelete) || busy !== null} loading={busy === "delete"} onClick={() => void remove()}>Delete role</Button>{whyNoDelete && <span className="max-w-56 text-xs leading-snug text-fog-500">{whyNoDelete}</span>}</span>}
          {role && <Button variant="ghost" disabled={busy !== null} onClick={async () => { if (!dirty || (await confirm(DISCARD))) onDuplicate(role); }}>Duplicate</Button>}
          <Button variant="ghost" onClick={() => void close()}>Cancel</Button>
          <Button loading={busy === "save"} disabled={busy !== null || (!dirty && !isNew)} onClick={() => void save()}>{isNew ? "Create role" : "Save role"}</Button>
        </>
      )}>
      <ErrorNote message={failure} />
      <fieldset disabled={locked} className="flex min-w-0 flex-col gap-6">
        {isNew && !seed && (
          <section aria-label="Start from a template">
            <p className="t-label mb-2 text-fog-400">Start from a template</p>
            <div className="grid gap-px border border-ink-700 bg-ink-700 sm:grid-cols-2">
              {ROLE_TEMPLATES.map((t) => (
                <button key={t.key} type="button" aria-pressed={v.name === t.name} onClick={() => { setV({ key: t.key, name: t.name, description: t.description, rank: t.rank, colour: t.colour, caps: { ...t.caps } }); setKeyTouched(false); setErrors({}); }} className={clsx("flex min-h-16 flex-col items-start gap-1 bg-ink-950 p-3 text-left transition-colors hover:bg-ink-850", v.name === t.name && "bg-ink-850")}>
                  <span className="text-sm text-fog-50">{t.name}</span><span className="t-label text-[0.5625rem] text-fog-500">{t.blurb}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-fog-500">A template only fills in this form. Nothing is created until you save.</p>
          </section>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" required maxLength={60} value={v.name} onChange={(x) => setV((s) => ({ ...s, name: x }))} error={errors.name} placeholder="e.g. Accounts" />
          <TextField label="Key" required disabled={!isNew} maxLength={40} value={key} onChange={(x) => { setKeyTouched(true); setV((s) => ({ ...s, key: x.toLowerCase().replace(/[^a-z0-9_-]/g, "") })); }} error={errors.key} hint={isNew ? "Used in the audit log. It cannot be changed after the role is created." : "Fixed when the role was created."} />
          <AreaField label="Description" className="sm:col-span-2" rows={2} maxLength={500} value={v.description} onChange={(x) => setV((s) => ({ ...s, description: x }))} hint="What this role is for — shown when a role is given to someone." />
        </div>

        <FieldShell id={`${matrixId}-colour`} as="legend" label="Colour" hint="Marks the role on people lists. The name is always shown as well.">
          <div role="radiogroup" aria-labelledby={`${matrixId}-colour-lbl`} className="flex flex-wrap gap-1.5">
            {[{ value: "", label: "None" }, ...ROLE_COLOURS, ...(v.colour && !ROLE_COLOURS.some((c) => c.value === v.colour) ? [{ value: v.colour, label: "Current" }] : [])].map((c) => (
              <button key={c.value || "none"} type="button" role="radio" aria-checked={(v.colour ?? "") === c.value} aria-label={c.label} title={c.label} onClick={() => setV((s) => ({ ...s, colour: c.value || null }))}
                className={clsx("flex h-10 w-10 items-center justify-center border transition-colors disabled:opacity-50", (v.colour ?? "") === c.value ? "border-yellow" : "border-ink-600 hover:border-ink-500")}>
                {c.value ? <span aria-hidden className="h-4 w-4 rounded-full" style={{ backgroundColor: c.value }} /> : <span aria-hidden className="t-label text-[0.5625rem] text-fog-500">Off</span>}
              </button>
            ))}
          </div>
        </FieldShell>

        <section aria-label="Rank">
          {isSuper ? (
            <p className="border border-ink-700 bg-ink-950 px-3 py-2.5 text-sm text-fog-300"><span className="t-data mr-2 text-fog-50">Rank 100</span>The super admin is always at the top, with every capability including security. Only its name, description and colour can change.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
              <NumberField label="Rank" required min={1} max={MAX_RANK} step={1} value={v.rank} onChange={(x) => setV((s) => ({ ...s, rank: x ?? 0 }))} error={errors.rank} />
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="t-label text-fog-400">Place it on the ladder</span>
                <div className="flex flex-wrap gap-2">
                  <select aria-label="Move just above another role" value="" onChange={(e) => { const r = others.find((o) => o.id === e.target.value); if (r) setV((s) => ({ ...s, rank: clampRank(r.rank + 1) })); }} className={`${inputCls} w-auto min-w-0 flex-1 pr-8`}><option value="">Move above…</option>{others.filter((r) => r.rank < MAX_RANK).map((r) => <option key={r.id} value={r.id}>{r.name} · {r.rank}</option>)}</select>
                  <select aria-label="Move just below another role" value="" onChange={(e) => { const r = others.find((o) => o.id === e.target.value); if (r) setV((s) => ({ ...s, rank: clampRank(r.rank - 1) })); }} className={`${inputCls} w-auto min-w-0 flex-1 pr-8`}><option value="">Move below…</option>{others.filter((r) => r.rank > 1).map((r) => <option key={r.id} value={r.id}>{r.name} · {r.rank}</option>)}</select>
                </div>
                <p className="text-xs leading-relaxed text-fog-500" aria-live="polite">
                  {above ? <>Below <span className="text-fog-300">{above.name} ({above.rank})</span></> : <>Below only the <span className="text-fog-300">super admin (100)</span></>}
                  {level.length > 0 && <>, level with <span className="text-fog-300">{level.map((r) => r.name).join(", ")}</span></>}
                  {below ? <>, above <span className="text-fog-300">{below.name} ({below.rank})</span>.</> : <>, at the bottom of the ladder.</>}
                </p>
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby={`${matrixId}-h`}>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <h3 id={`${matrixId}-h`} className="t-label text-fog-400">What this role can do</h3>
            {!isSuper && !locked && <span className="flex gap-1"><button type="button" onClick={() => setAll("view")} className="t-label min-h-9 px-2 text-[0.625rem] text-fog-400 hover:text-fog-50">View everything</button><button type="button" onClick={() => setAll("none")} className="t-label min-h-9 px-2 text-[0.625rem] text-fog-400 hover:text-fog-50">Clear</button></span>}
          </div>
          <ul className="border border-ink-700">
            {DOMAIN_INFO.map((d) => {
              const cur: CapLevel | "none" = isSuper ? "edit" : v.caps[d.key] ?? "none";
              return (
                <li key={d.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ink-800 px-3 py-2.5 last:border-0">
                  <div className="min-w-0 flex-1 basis-56">
                    <p id={`${matrixId}-${d.key}`} className="text-sm text-fog-50">{d.label}</p>
                    <p className="text-xs leading-relaxed text-fog-500">{d.covers}{cur === "edit" && d.key !== "analytics" && <span className="text-fog-400"> Edit: {d.edit.charAt(0).toLowerCase() + d.edit.slice(1)}</span>}</p>
                  </div>
                  <div role="radiogroup" aria-labelledby={`${matrixId}-${d.key}`} className="flex flex-none">
                    {LEVELS.map((l) => (
                      <button key={l.value} type="button" role="radio" aria-checked={cur === l.value} disabled={isSuper} onClick={() => setCap(d.key, l.value)}
                        className={clsx("t-label -ml-px min-h-10 min-w-14 border px-2.5 text-[0.625rem] transition-colors first:ml-0 disabled:cursor-not-allowed", cur === l.value ? (l.value === "edit" ? "z-10 border-yellow bg-yellow/15 text-yellow" : l.value === "view" ? "z-10 border-sky bg-sky/15 text-sky" : "z-10 border-fog-500 bg-ink-800 text-fog-100") : "border-ink-600 text-fog-500 hover:text-fog-200 disabled:hover:text-fog-500")}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
            <li className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-ink-950 px-3 py-2.5">
              <div className="min-w-0 flex-1 basis-56"><p className="text-sm text-fog-300">Security</p><p className="text-xs leading-relaxed text-fog-500">Creating roles, the hierarchy, admin rights. Never given to a role.</p></div>
              <span className="t-label text-[0.625rem] text-fog-500">{isSuper ? "Super admin" : "Super admin only"}</span>
            </li>
          </ul>
          {!isSuper && v.caps.team === "edit" && <p role="status" className="mt-3 border border-warn/40 bg-warn/10 px-3 py-2.5 text-xs leading-relaxed text-fog-100">People on this role will be able to give any role ranked below {v.rank || "their own"} to other people, remove staff access from people below them, and read the audit log.</p>}
          {!isSuper && v.caps.settings === "edit" && <p role="status" className="mt-3 border border-warn/40 bg-warn/10 px-3 py-2.5 text-xs leading-relaxed text-fog-100">Settings: edit lets this role switch whole features of the site on and off.</p>}
        </section>
      </fieldset>
      {confirmUi}
    </Drawer>
  );
}

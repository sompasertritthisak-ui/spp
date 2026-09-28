"use client";
import { useCallback, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/lib/backend/auth";
import { PublishSite } from "../cms/PublishSite";
import { DISCARD, useConfirm } from "../resource/Confirm";
import { useParam } from "../resource/useSelection";
import { PageHeader, Tabs } from "../ui";
import { AuditTab } from "./AuditTab";
import { BackupsTab } from "./BackupsTab";
import { CompanyTab } from "./CompanyTab";
import { EmailTab } from "./EmailTab";
import { FlagsTab } from "./FlagsTab";
import { PeopleTab } from "./PeopleTab";
import { RolesTab } from "./RolesTab";

/** `needs`: settings = the Settings capability; team = Team or Settings; admin = whoever the database lets read the audit log and outbox. */
const TABS = [
  { value: "company", label: "Company & contact", needs: "settings" }, { value: "flags", label: "Feature flags", needs: "settings" },
  { value: "people", label: "People", needs: "team" }, { value: "roles", label: "Roles & hierarchy", needs: "team" },
  { value: "audit", label: "Audit log", needs: "admin" }, { value: "email", label: "Email outbox", needs: "admin" },
  { value: "backups", label: "Backups", needs: "settings" }, { value: "publishing", label: "Publishing", needs: "settings" },
] as const;
type Tab = (typeof TABS)[number]["value"];

export function SettingsScreen() {
  const { profile, access, can, canWrite } = useAuth();
  const [param, setTab] = useParam<Tab | "team">("tab", "company");
  const [dirty, setDirty] = useState(false);
  const [confirm, confirmUi] = useConfirm();
  const onDirty = useCallback((d: boolean) => setDirty(d), []);

  const settings = can("settings"), team = settings || can("team");
  // mirrors SQL is_admin(): the audit log and the outbox are readable by admins and by roles that manage the team
  const admin = access.superAdmin || profile?.role === "admin" || canWrite("team");
  const tabs = TABS.filter((t) => (t.needs === "settings" ? settings : t.needs === "team" ? team : admin && team));
  const wanted = param === "team" ? "people" : param; // links written before the tab was split
  const active = tabs.find((t) => t.value === wanted)?.value ?? tabs[0]?.value;
  const change = async (t: Tab) => { if (!dirty || (await confirm(DISCARD))) { setDirty(false); setTab(t); } };
  const readOnly = active === "people" ? !canWrite("team") : active === "roles" ? !access.superAdmin : active === "audit" || active === "email" || active === "backups" ? false : !canWrite("settings");

  return (
    <div>
      <PageHeader title="Settings" viewOnly={Boolean(active) && readOnly} sub="Company details, feature switches, people and their roles, the audit trail, backups and publishing." />
      {!active ? <EmptyState title="Not part of your role." body="Settings, people and roles need the Settings or Team capability. A super admin can add it to your role under Settings → Roles & hierarchy." /> : (
        <>
          <Tabs label="Settings sections" tabs={tabs.map(({ value, label }) => ({ value, label }))} value={active} onChange={(t) => void change(t)} />
          {active === "company" && <fieldset disabled={!canWrite("settings")} className="min-w-0"><CompanyTab onDirty={onDirty} /></fieldset>}
          {active === "flags" && <fieldset disabled={!canWrite("settings")} className="min-w-0"><FlagsTab /></fieldset>}
          {active === "people" && <PeopleTab />}
          {active === "roles" && <RolesTab onDirty={onDirty} />}
          {active === "audit" && <AuditTab />}
          {active === "email" && <EmailTab />}
          {active === "backups" && <BackupsTab />}
          {active === "publishing" && <PublishSite />}
        </>
      )}
      {confirmUi}
    </div>
  );
}

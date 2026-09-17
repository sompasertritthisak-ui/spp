"use client";
import { useCallback, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { canDo, useAuth } from "@/lib/backend/auth";
import { PublishSite } from "../cms/PublishSite";
import { DISCARD, useConfirm } from "../resource/Confirm";
import { useParam } from "../resource/useSelection";
import { PageHeader, Tabs } from "../ui";
import { AuditTab } from "./AuditTab";
import { CompanyTab } from "./CompanyTab";
import { EmailTab } from "./EmailTab";
import { FlagsTab } from "./FlagsTab";
import { TeamTab } from "./TeamTab";

const TABS = [{ value: "company", label: "Company & contact" }, { value: "flags", label: "Feature flags" }, { value: "team", label: "Team & roles" }, { value: "audit", label: "Audit log" }, { value: "email", label: "Email outbox" }, { value: "publishing", label: "Publishing" }] as const;
type Tab = (typeof TABS)[number]["value"];

export function SettingsScreen() {
  const { profile } = useAuth();
  const [tab, setTab] = useParam<Tab>("tab", "company");
  const [dirty, setDirty] = useState(false);
  const [confirm, confirmUi] = useConfirm();
  const onDirty = useCallback((d: boolean) => setDirty(d), []);
  const active = TABS.some((t) => t.value === tab) ? tab : "company";
  const change = async (t: Tab) => { if (!dirty || (await confirm(DISCARD))) setTab(t); };

  return (
    <div>
      <PageHeader title="Settings" sub="Company details, feature switches, staff access, the audit trail and publishing." />
      {!canDo(profile?.role, "settings") ? <EmptyState title="Administrators only." body="Settings, staff roles and the audit log are managed by SPP administrators. Your role does not include them." /> : (
        <>
          <Tabs label="Settings sections" tabs={[...TABS]} value={active} onChange={(t) => void change(t)} />
          {active === "company" && <CompanyTab onDirty={onDirty} />}
          {active === "flags" && <FlagsTab />}
          {active === "team" && <TeamTab />}
          {active === "audit" && <AuditTab />}
          {active === "email" && <EmailTab />}
          {active === "publishing" && <PublishSite />}
        </>
      )}
      {confirmUi}
    </div>
  );
}

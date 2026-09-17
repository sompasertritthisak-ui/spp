"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useQuery } from "@/lib/backend/hooks";
import { db, exec, write } from "../ops/data";
import { InternalNotes } from "../ops/Notes";
import { Confirm, Labeled, SectionTitle, SkeletonRows } from "../ops/parts";
import { fromVteInput, toVteInput, vteDateTime } from "../ops/vientiane";
import { adminInput, Drawer, ErrorNote, Meta, StatusPill } from "../ui";
import { CHANNELS, type Consultation } from "./shared";

type Ask = "approve" | "alternative" | "decline" | "complete" | "convert" | null;

function Actions({ c, onChanged }: { c: Consultation; onChanged: () => void }) {
  const toast = useToast();
  const [ask, setAsk] = useState<Ask>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pick, setPick] = useState<"preferred" | "alternative" | "custom">("preferred");
  const [custom, setCustom] = useState(toVteInput(c.preferred_at));
  const [alt, setAlt] = useState(toVteInput(c.alternative_at));
  const [project, setProject] = useState(`${c.topic} — ${c.company_name || c.name}`.slice(0, 160));

  /** Portal notice is best-effort: the status change is the source of truth, and staff are told if the notice failed. */
  const tell = async (title: string, body: string) => {
    if (!c.customer_id) return " This contact has no My SPP account — let them know directly.";
    const r = await exec(db().rpc("notify_customer", { target: c.customer_id, k: "consultation", ttl: title, bdy: body, link: "/account/" }));
    return r.error ? " The portal notice could not be sent — let the customer know directly." : " The customer was notified in My SPP.";
  };
  const run = async (fn: () => Promise<string | null>, done: () => Promise<string> | string) => {
    setBusy(true); setErr(null);
    const e = await fn();
    if (e) { setBusy(false); setErr(e); return; }
    const msg = await done();
    setBusy(false); setAsk(null);
    toast(msg, "ok");
    onChanged();
  };
  const update = (patch: Partial<Consultation>) => async () => (await write(db().from("consultations").update(patch).eq("id", c.id).select("id"))).error;

  const approve = () => {
    const at = pick === "preferred" ? c.preferred_at : pick === "alternative" ? c.alternative_at : fromVteInput(custom);
    if (!at) return setErr("Choose a valid date and time.");
    void run(update({ status: "approved", confirmed_at: at }), async () => `Consultation confirmed for ${vteDateTime(at)}.${await tell(`Consultation ${c.ref} confirmed`, vteDateTime(at))}`);
  };
  const suggest = () => {
    const at = fromVteInput(alt);
    if (!at) return setErr("Choose the alternative date and time.");
    void run(update({ status: "alternative_suggested", alternative_at: at, confirmed_at: null }), async () => `Alternative time recorded.${await tell(`New time suggested for ${c.ref}`, `Could you do ${vteDateTime(at)} instead?`)}`);
  };
  const convert = () => {
    if (project.trim().length < 2) return setErr("Give the project a name.");
    void run(async () => (await exec(db().rpc("convert_consultation_to_project", { consultation: c.id, project_name: project.trim() }))).error, () => "Project created. Internal notes were carried across.");
  };

  const open = c.status === "requested" || c.status === "alternative_suggested";
  return (
    <div className="flex flex-wrap items-center gap-2 border border-ink-700 bg-ink-950 p-3">
      <p className="t-label mr-auto text-[0.625rem] text-fog-500">Decide</p>
      {(open || c.status === "approved") && <Button size="sm" variant={open ? "primary" : "outline"} onClick={() => { setErr(null); setAsk("approve"); }}>{c.status === "approved" ? "Change time" : "Approve"}</Button>}
      {(open || c.status === "approved") && <Button size="sm" variant="outline" onClick={() => { setErr(null); setAsk("alternative"); }}>Suggest alternative</Button>}
      {open && <Button size="sm" variant="danger" onClick={() => { setErr(null); setAsk("decline"); }}>Decline</Button>}
      {c.status === "approved" && <Button size="sm" variant="outline" onClick={() => { setErr(null); setAsk("complete"); }}>Mark completed</Button>}
      {!c.project_id && c.status !== "declined" && <Button size="sm" variant={c.status === "completed" ? "primary" : "outline"} onClick={() => { setErr(null); setAsk("convert"); }}>Convert to project</Button>}
      {c.project_id && <Button size="sm" href={`/admin/projects/?id=${c.project_id}`} arrow>Open project</Button>}

      <Confirm open={ask === "approve"} title="Confirm this consultation" confirmLabel="Confirm time" pending={busy} onClose={() => setAsk(null)} onConfirm={approve} body="All times are Asia/Vientiane (ICT, UTC+7).">
        <ErrorNote message={err} />
        <fieldset className="flex flex-col gap-2 text-sm text-fog-100">
          <legend className="sr-only">Which time?</legend>
          <label className="flex min-h-10 items-center gap-2"><input type="radio" name="when" checked={pick === "preferred"} onChange={() => setPick("preferred")} className="accent-[var(--color-yellow)]" />Customer&apos;s preferred time — <span className="t-data">{vteDateTime(c.preferred_at)}</span></label>
          {c.alternative_at && <label className="flex min-h-10 items-center gap-2"><input type="radio" name="when" checked={pick === "alternative"} onChange={() => setPick("alternative")} className="accent-[var(--color-yellow)]" />Alternative — <span className="t-data">{vteDateTime(c.alternative_at)}</span></label>}
          <label className="flex min-h-10 flex-wrap items-center gap-2"><input type="radio" name="when" checked={pick === "custom"} onChange={() => setPick("custom")} className="accent-[var(--color-yellow)]" />Another time <input type="datetime-local" aria-label="Another time, Vientiane" value={custom} onChange={(e) => { setCustom(e.target.value); setPick("custom"); }} className={`${adminInput} w-auto`} /></label>
        </fieldset>
      </Confirm>
      <Confirm open={ask === "alternative"} title="Suggest an alternative time" confirmLabel="Record suggestion" pending={busy} onClose={() => setAsk(null)} onConfirm={suggest} body="The request moves to “alternative suggested” until the customer agrees and you approve it.">
        <ErrorNote message={err} />
        <Labeled label="Alternative time (Asia/Vientiane)">{(id) => <input id={id} type="datetime-local" value={alt} onChange={(e) => setAlt(e.target.value)} className={adminInput} />}</Labeled>
      </Confirm>
      <Confirm open={ask === "decline"} danger title="Decline this consultation?" confirmLabel="Decline" pending={busy} onClose={() => setAsk(null)} onConfirm={() => void run(update({ status: "declined" }), async () => `Consultation declined.${await tell(`Consultation ${c.ref}`, "We are unable to offer this consultation. Please contact SPP to arrange another time.")}`)} body={<>Decline {c.ref} with {c.name}? Add an internal note explaining why, and consider suggesting an alternative instead.</>}><ErrorNote message={err} /></Confirm>
      <Confirm open={ask === "complete"} title="Mark as completed?" confirmLabel="Mark completed" pending={busy} onClose={() => setAsk(null)} onConfirm={() => void run(update({ status: "completed" }), () => "Consultation completed. Convert it to a project when there is work to scope.")} body="Use this once the conversation has taken place."><ErrorNote message={err} /></Confirm>
      <Confirm open={ask === "convert"} title="Convert to project" confirmLabel="Create project" pending={busy} onClose={() => setAsk(null)} onConfirm={convert} body="Creates a project linked to this consultation and its lead. Goal, contact details and internal notes are carried across.">
        <ErrorNote message={err} />
        <Labeled label="Project name">{(id) => <input id={id} value={project} onChange={(e) => setProject(e.target.value)} maxLength={160} className={adminInput} />}</Labeled>
      </Confirm>
    </div>
  );
}

export function ConsultationDrawer({ id, canEdit, onClose, onChanged }: { id: string | null; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const q = useQuery<Consultation | null>(() => db().from("consultations").select("*").eq("id", id ?? "").maybeSingle(), [id], { enabled: Boolean(id) });
  const c = q.data;
  return (
    <Drawer open={Boolean(id)} onClose={onClose} title={c ? `${c.name} · ${c.topic}` : "Consultation"} sub={c && <span className="flex flex-wrap items-center gap-2"><span className="t-data">{c.ref}</span><StatusPill status={c.status} /></span>}>
      <ErrorNote message={q.error} onRetry={() => void q.reload()} />
      {q.loading && !c && <SkeletonRows n={5} />}
      {!q.loading && !q.error && !c && <p className="text-sm text-fog-400">This consultation could not be found, or your role cannot view it.</p>}
      {c && (
        <>
          {canEdit && <Actions key={`${c.id}-${c.updated_at}`} c={c} onChanged={() => { void q.reload(); onChanged(); }} />}
          <SectionTitle>When <span className="text-fog-500">· Asia/Vientiane</span></SectionTitle>
          <Meta items={[
            { label: "Confirmed", value: c.confirmed_at ? <span className="t-data text-ok">{vteDateTime(c.confirmed_at)}</span> : "Not confirmed yet" },
            { label: "Preferred", value: <span className="t-data">{vteDateTime(c.preferred_at)}</span> }, { label: "Alternative", value: <span className="t-data">{vteDateTime(c.alternative_at)}</span> },
            { label: "Length", value: `${c.duration_mins} minutes` }, { label: "Channel", value: CHANNELS[c.channel] ?? c.channel },
          ]} />
          <SectionTitle>Who &amp; why</SectionTitle>
          <Meta items={[
            { label: "Name", value: <>{c.name}{c.company_name ? ` · ${c.company_name}` : ""}</> },
            { label: "Reach", value: <span className="flex flex-wrap gap-x-3"><a href={`mailto:${c.email}`} className="underline decoration-ink-500 underline-offset-4">{c.email}</a>{c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="underline decoration-ink-500 underline-offset-4">{c.phone}</a>}</span> },
            { label: "Topic", value: c.topic }, { label: "Goal", value: c.goal || "—" }, { label: "Background", value: c.info || "—" },
            { label: "Lead", value: c.lead_id ? <Link href={`/admin/leads/?id=${c.lead_id}`} className="underline decoration-ink-500 underline-offset-4 hover:decoration-yellow">Open lead</Link> : "—" },
          ]} />
          <div className="mt-8"><InternalNotes entity="consultation" entityId={c.id} /></div>
        </>
      )}
    </Drawer>
  );
}

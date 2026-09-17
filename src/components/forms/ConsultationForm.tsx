"use client";
import { useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Checkbox, FormError, Honeypot, Input, Textarea } from "@/components/ui/Field";
import { Plate } from "@/components/ui/Plate";
import { track } from "@/lib/backend/analytics";
import { api, contactSchema } from "@/lib/backend/api";
import { BackendError } from "@/lib/backend/client";
import { backendConfigured } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { whatsappHref } from "@/lib/whatsapp";
import { ContactFields, rememberContact, useContactState } from "./ContactFields";
import { Group, Segmented } from "./controls";
import { OfflineHandOff } from "./OfflineHandOff";
import { focusFirstInvalid, zodErrors, type Errors } from "./validation";
import { WhatsAppLink } from "./WhatsAppLink";

const DURATIONS = [{ value: 15, label: "15 min", hint: "A quick question" }, { value: 30, label: "30 min", hint: "One product" }, { value: 45, label: "45 min", hint: "A project" }, { value: 60, label: "60 min", hint: "A campaign" }] as const;
const CHANNELS = [{ value: "in_person", label: "In person" }, { value: "phone", label: "Phone" }, { value: "whatsapp", label: "WhatsApp" }, { value: "video", label: "Video call" }] as const;
type Duration = (typeof DURATIONS)[number]["value"];
type Channel = (typeof CHANNELS)[number]["value"];

const HOUR = 3_600_000;
/** datetime-local wants local wall-clock time, not UTC. */
const toLocalInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const time = (v: string) => new Date(v).getTime();
/* submit_consultation: strictly more than 2 hours ahead and within 120 days. A 10-minute margin covers the time spent filling in the form. */
const inWindow = (v: string) => { const t = time(v); return Number.isFinite(t) && t > Date.now() + 2 * HOUR + 10 * 60_000 && t < Date.now() + 120 * 24 * HOUR; };

const schema = z.object({
  contact: contactSchema.refine((c) => Boolean(c.email), { message: "We need an email address to confirm your consultation.", path: ["email"] }),
  topic: z.string().trim().min(2, "Tell us what you would like to talk about.").max(160),
  goal: z.string().max(1000, "Keep this under 1,000 characters."),
  preferredAt: z.string().min(1, "Choose a preferred date and time.").refine(inWindow, "Choose a time at least two hours from now and within the next 120 days."),
  alternativeAt: z.union([z.literal(""), z.string().refine(inWindow, "The alternative must also be at least two hours from now and within 120 days.")]),
  info: z.string().max(2000, "Keep this under 2,000 characters."),
});

const focusOnMount = (el: HTMLElement | null) => el?.focus();

export function ConsultationForm({ email, whatsapp, hours }: { email: string; whatsapp: string; hours: { days: string; time: string }[] }) {
  const [contact, setContact, fromProfile] = useContactState();
  const [duration, setDuration] = useState<Duration>(30);
  const [channel, setChannel] = useState<Channel>("in_person");
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState("");
  const [preferredAt, setPreferredAt] = useState("");
  const [alternativeAt, setAlternativeAt] = useState("");
  const [info, setInfo] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [bounds] = useState(() => ({ min: toLocalInput(new Date(Date.now() + 3 * HOUR)), max: toLocalInput(new Date(Date.now() + 119 * 24 * HOUR)), zone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
  const hoursHint = `SPP is open ${hours.map((h) => `${h.days} ${h.time}`).join("; ")} (Vientiane time). Your device is set to ${bounds.zone}.`;
  const channelLabel = CHANNELS.find((c) => c.value === channel)?.label ?? channel;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = schema.safeParse({ contact, topic, goal, preferredAt, alternativeAt, info });
    if (!parsed.success) {
      setErrors(zodErrors(parsed.error));
      setFormError("A few details need attention before this can be sent.");
      focusFirstInvalid(formRef.current);
      return;
    }
    setErrors({});
    rememberContact(contact);
    const preferredIso = new Date(preferredAt).toISOString();
    const alternativeIso = alternativeAt ? new Date(alternativeAt).toISOString() : undefined;
    if (!backendConfigured) {
      setOffline([
        "CONSULTATION REQUEST FOR SPP", "", `Topic: ${parsed.data.topic}`, `Length: ${duration} minutes · ${channelLabel}`, `Preferred: ${formatDateTime(preferredIso)} (${bounds.zone})`,
        ...(alternativeIso ? [`Alternative: ${formatDateTime(alternativeIso)}`] : []), ...(goal.trim() ? ["", `Goal: ${goal.trim()}`] : []), ...(info.trim() ? [`More: ${info.trim()}`] : []),
        "", `From: ${[contact.name, contact.company].filter(Boolean).join(", ")}`, `Email: ${contact.email}`, ...(contact.phone ? [`Phone: ${contact.phone}`] : []),
      ].join("\n"));
      return;
    }
    setBusy(true);
    try {
      const res = await api.submitConsultation({ contact: parsed.data.contact, topic: parsed.data.topic, goal: goal.trim(), durationMins: duration, preferredAt: preferredIso, alternativeAt: alternativeIso, channel, info: info.trim(), consent, website });
      setDone(res.ref);
      track("consultation_requested", { ref: res.ref });
    } catch (err) {
      setFormError(err instanceof BackendError ? err.message : "Something went wrong sending your request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const wa = whatsappHref(whatsapp, { kind: "consultation", topic: topic.trim() });
    return (
      <div role="status" tabIndex={-1} ref={focusOnMount} className="crop border border-ink-700 bg-ink-900 p-8 focus:outline-none sm:p-12">
        <Plate>Request received</Plate>
        <h2 className="t-title mt-5 text-fog-50">We will confirm or suggest another time.</h2>
        <p className="mt-4 max-w-xl text-fog-300">
          Your reference is <span className="t-data text-yellow">{done}</span>. You asked for {duration} minutes on {formatDateTime(new Date(preferredAt).toISOString())} — {channelLabel.toLowerCase()}.
          This is a request, not yet an appointment: a person at SPP checks the diary and replies to {contact.email}.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {wa && <WhatsAppLink href={wa} label="Message us on WhatsApp" source="consultation_success" />}
          <Button href="/solutions/?build=1#builder" variant="outline" arrow>Build my project meanwhile</Button>
          <Button href="/products/" variant="ghost">Explore the catalogue</Button>
        </div>
      </div>
    );
  }
  if (offline) {
    return (
      <div>
        <OfflineHandOff email={email} whatsapp={whatsapp} subject="Consultation request" summary={offline} source="consultation_offline" />
        <Button variant="ghost" className="mt-6" onClick={() => setOffline(null)}>Back to edit the request</Button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="relative flex flex-col gap-14">
      <Honeypot value={website} onChange={setWebsite} />
      <Group n="01" legend="The conversation">
        <Segmented label="How long do you need?" value={duration} onChange={setDuration} options={DURATIONS} />
        <Input label="What would you like to talk about?" required maxLength={160} value={topic} onChange={(e) => setTopic(e.target.value)} error={errors.topic} placeholder="e.g. Uniforms for a new hotel, a billboard campaign, shop signage" />
        <Textarea label="What is the project trying to achieve?" maxLength={1000} rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} error={errors.goal} hint="Optional — it helps us bring the right person." />
      </Group>
      <Group n="02" legend="When and how" hint={hoursHint}>
        <div className="grid gap-6 sm:grid-cols-2">
          <Input label="Preferred date and time" type="datetime-local" required min={bounds.min} max={bounds.max} step={900} value={preferredAt} onChange={(e) => setPreferredAt(e.target.value)} error={errors.preferredAt} />
          <Input label="An alternative" type="datetime-local" min={bounds.min} max={bounds.max} step={900} value={alternativeAt} onChange={(e) => setAlternativeAt(e.target.value)} error={errors.alternativeAt} hint="Optional, but it speeds things up." />
        </div>
        <Segmented label="How should we meet?" value={channel} onChange={setChannel} options={CHANNELS} />
        <Textarea label="Anything else?" maxLength={2000} rows={3} value={info} onChange={(e) => setInfo(e.target.value)} error={errors.info} hint="Optional — links, sizes, site address, who will join." />
      </Group>
      <Group n="03" legend="Who are we meeting?" hint={fromProfile ? "Filled in from your account." : undefined}>
        <ContactFields value={contact} onChange={setContact} errors={errors} emailRequired />
        <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} label="Send me occasional SPP news and offers. Optional." />
        <FormError message={formError} />
        <div className="flex flex-wrap items-center gap-5">
          <Button type="submit" size="lg" arrow loading={busy}>Request this time</Button>
          <p className="max-w-sm text-sm text-fog-500">Free, no obligation. We will confirm or suggest another time.</p>
        </div>
      </Group>
    </form>
  );
}

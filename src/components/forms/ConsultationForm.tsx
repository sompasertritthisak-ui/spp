"use client";
import { useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Checkbox, FormError, Honeypot, Input, Textarea } from "@/components/ui/Field";
import { Plate } from "@/components/ui/Plate";
import { track } from "@/lib/backend/analytics";
import { api, contactSchema } from "@/lib/backend/api";
import { BackendError } from "@/lib/backend/client";
import { backendConfigured } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { useLiteral, useT, type TFn } from "@/lib/i18n";
import { whatsappHref } from "@/lib/whatsapp";
import { ContactFields, rememberContact, useContactState } from "./ContactFields";
import { Group, Segmented } from "./controls";
import { OfflineHandOff } from "./OfflineHandOff";
import { focusFirstInvalid, zodErrors, type Errors } from "./validation";
import { WhatsAppLink } from "./WhatsAppLink";

const DURATIONS = [{ value: 15, hint: "cons.d15" }, { value: 30, hint: "cons.d30" }, { value: 45, hint: "cons.d45" }, { value: 60, hint: "cons.d60" }] as const;
/* `label` is the English that travels to SPP in the offline hand-off; `key` is what the customer reads. */
const CHANNELS = [{ value: "in_person", label: "In person", key: "cons.inPerson" }, { value: "phone", label: "Phone", key: "cons.phone" }, { value: "whatsapp", label: "WhatsApp", key: "cons.whatsapp" }, { value: "video", label: "Video call", key: "cons.video" }] as const;
type Duration = (typeof DURATIONS)[number]["value"];
type Channel = (typeof CHANNELS)[number]["value"];

const HOUR = 3_600_000;
/** datetime-local wants local wall-clock time, not UTC. */
const toLocalInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const time = (v: string) => new Date(v).getTime();
/* submit_consultation: strictly more than 2 hours ahead and within 120 days. A 10-minute margin covers the time spent filling in the form. */
const inWindow = (v: string) => { const t = time(v); return Number.isFinite(t) && t > Date.now() + 2 * HOUR + 10 * 60_000 && t < Date.now() + 120 * 24 * HOUR; };

const makeSchema = (t: TFn) => z.object({
  contact: contactSchema.refine((c) => Boolean(c.email), { message: t("cons.errEmail"), path: ["email"] }),
  topic: z.string().trim().min(2, t("cons.errTopic")).max(160),
  goal: z.string().max(1000, t("cons.errGoal")),
  preferredAt: z.string().min(1, t("cons.errPreferred")).refine(inWindow, t("cons.errWindow")),
  alternativeAt: z.union([z.literal(""), z.string().refine(inWindow, t("cons.errAlt"))]),
  info: z.string().max(2000, t("cons.errInfo")),
});

const focusOnMount = (el: HTMLElement | null) => el?.focus();

export function ConsultationForm({ email, whatsapp, hours }: { email: string; whatsapp: string; hours: { days: string; time: string }[] }) {
  const t = useT();
  const say = useLiteral();
  const schema = useMemo(() => makeSchema(t), [t]);
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
  const hoursHint = t("cons.hoursHint", { hours: hours.map((h) => `${h.days} ${h.time}`).join("; "), zone: bounds.zone });
  const chosen = CHANNELS.find((c) => c.value === channel);
  const channelLabel = chosen?.label ?? channel;
  const durations = DURATIONS.map((d) => ({ value: d.value, label: t("cons.min", { n: d.value }), hint: t(d.hint) }));
  const channels = CHANNELS.map((c) => ({ value: c.value, label: t(c.key) }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = schema.safeParse({ contact, topic, goal, preferredAt, alternativeAt, info });
    if (!parsed.success) {
      setErrors(zodErrors(parsed.error, say));
      setFormError(t("form.attention"));
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
      setFormError(err instanceof BackendError ? err.message : t("form.sendFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const wa = whatsappHref(whatsapp, { kind: "consultation", topic: topic.trim() });
    return (
      <div role="status" tabIndex={-1} ref={focusOnMount} className="crop border border-ink-700 bg-ink-900 p-8 focus:outline-none sm:p-12">
        <Plate>{t("cons.received")}</Plate>
        <h2 className="t-title mt-5 text-fog-50">{t("cons.doneTitle")}</h2>
        <p className="mt-4 max-w-xl text-fog-300">
          {t("cons.yourRef")} <span className="t-data text-yellow">{done}</span>.{" "}
          {t("cons.doneBody", { mins: duration, when: formatDateTime(new Date(preferredAt).toISOString()), channel: (chosen ? t(chosen.key) : channel).toLowerCase(), email: contact.email })}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {wa && <WhatsAppLink href={wa} label={t("cons.waMsg")} source="consultation_success" />}
          <Button href="/solutions/?build=1#builder" variant="outline" arrow>{t("cons.buildMeanwhile")}</Button>
          <Button href="/products/" variant="ghost">{t("common.exploreCatalogue")}</Button>
        </div>
      </div>
    );
  }
  if (offline) {
    return (
      <div>
        <OfflineHandOff email={email} whatsapp={whatsapp} subject="Consultation request" summary={offline} source="consultation_offline" />
        <Button variant="ghost" className="mt-6" onClick={() => setOffline(null)}>{t("offline.backRequest")}</Button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="relative flex flex-col gap-14">
      <Honeypot value={website} onChange={setWebsite} />
      <Group n="01" legend={t("cons.g1")}>
        <Segmented label={t("cons.howLong")} value={duration} onChange={setDuration} options={durations} />
        <Input label={t("cons.topic")} required maxLength={160} value={topic} onChange={(e) => setTopic(e.target.value)} error={errors.topic} placeholder={t("cons.topicPh")} />
        <Textarea label={t("cons.goal")} maxLength={1000} rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} error={errors.goal} hint={t("cons.goalHint")} />
      </Group>
      <Group n="02" legend={t("cons.g2")} hint={hoursHint}>
        <div className="grid gap-6 sm:grid-cols-2">
          <Input label={t("cons.preferred")} type="datetime-local" required min={bounds.min} max={bounds.max} step={900} value={preferredAt} onChange={(e) => setPreferredAt(e.target.value)} error={errors.preferredAt} />
          <Input label={t("cons.alternative")} type="datetime-local" min={bounds.min} max={bounds.max} step={900} value={alternativeAt} onChange={(e) => setAlternativeAt(e.target.value)} error={errors.alternativeAt} hint={t("cons.altHint")} />
        </div>
        <Segmented label={t("cons.how")} value={channel} onChange={setChannel} options={channels} />
        <Textarea label={t("cons.else")} maxLength={2000} rows={3} value={info} onChange={(e) => setInfo(e.target.value)} error={errors.info} hint={t("cons.elseHint")} />
      </Group>
      <Group n="03" legend={t("cons.g3")} hint={fromProfile ? t("cons.fromAccount") : undefined}>
        <ContactFields value={contact} onChange={setContact} errors={errors} emailRequired />
        <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} label={t("form.consent")} />
        <FormError message={formError} />
        <div className="flex flex-wrap items-center gap-5">
          <Button type="submit" size="lg" arrow loading={busy}>{t("cons.submit")}</Button>
          <p className="max-w-sm text-sm text-fog-500">{t("cons.free")}</p>
        </div>
      </Group>
    </form>
  );
}

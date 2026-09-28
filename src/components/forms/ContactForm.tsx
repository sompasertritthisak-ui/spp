"use client";
import { useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Checkbox, FormError, Honeypot, Textarea } from "@/components/ui/Field";
import { Plate } from "@/components/ui/Plate";
import { track } from "@/lib/backend/analytics";
import { api, contactSchema } from "@/lib/backend/api";
import { BackendError } from "@/lib/backend/client";
import { backendConfigured } from "@/lib/env";
import { useLiteral, useT, type TFn } from "@/lib/i18n";
import { ContactFields, rememberContact, useContactState } from "./ContactFields";
import { OfflineHandOff } from "./OfflineHandOff";
import { focusFirstInvalid, zodErrors, type Errors } from "./validation";

/* Mirrors submit_contact: parse_contact + a message of 5–4000 characters. */
const makeSchema = (t: TFn) => z.object({
  contact: contactSchema,
  message: z.string().trim().min(5, t("contact.errShort")).max(4000, t("contact.errLong")),
});

const focusOnMount = (el: HTMLElement | null) => el?.focus();

export function ContactForm({ email, whatsapp }: { email: string; whatsapp: string }) {
  const t = useT();
  const say = useLiteral();
  const schema = useMemo(() => makeSchema(t), [t]);
  const [contact, setContact] = useContactState();
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = schema.safeParse({ contact, message });
    if (!parsed.success) {
      setErrors(zodErrors(parsed.error, say));
      focusFirstInvalid(formRef.current);
      return;
    }
    setErrors({});
    rememberContact(contact);
    if (!backendConfigured) {
      setOffline([parsed.data.message, "", `From: ${[contact.name, contact.company].filter(Boolean).join(", ")}`, ...(contact.email ? [`Email: ${contact.email}`] : []), ...(contact.phone ? [`Phone: ${contact.phone}`] : [])].join("\n"));
      return;
    }
    setBusy(true);
    try {
      const res = await api.submitContact({ contact: parsed.data.contact, message: parsed.data.message, consent, website });
      setRef(res.ref);
      track("contact_submitted", { ref: res.ref });
    } catch (err) {
      setFormError(err instanceof BackendError ? err.message : t("form.messageFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (ref) {
    return (
      <div role="status" tabIndex={-1} ref={focusOnMount} className="crop border border-ink-700 bg-ink-900 p-8 focus:outline-none sm:p-10">
        <Plate>{t("contact.received")}</Plate>
        <h2 className="t-title mt-5 text-fog-50">{t("contact.thanks", { name: contact.name.split(" ")[0] ?? "" })}</h2>
        <p className="mt-4 text-fog-300">{t("contact.yourRef")} <span className="t-data text-yellow">{ref}</span>. {t("contact.replyBody")}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/products/" variant="outline" arrow>{t("common.exploreCatalogue")}</Button>
          <Button href="/request-quote/" variant="ghost">{t("common.requestQuote")}</Button>
        </div>
      </div>
    );
  }
  if (offline) {
    return (
      <div>
        <OfflineHandOff email={email} whatsapp={whatsapp} subject="Message from the SPP website" summary={offline} source="contact_offline" />
        <Button variant="ghost" className="mt-6" onClick={() => setOffline(null)}>{t("offline.backMessage")}</Button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="relative flex flex-col gap-6">
      <Honeypot value={website} onChange={setWebsite} />
      <ContactFields value={contact} onChange={setContact} errors={errors} />
      <Textarea label={t("contact.message")} required rows={6} maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} error={errors.message} placeholder={t("contact.messagePh")} />
      <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} label={t("form.consent")} />
      <FormError message={formError} />
      <div><Button type="submit" size="lg" arrow loading={busy}>{t("contact.send")}</Button></div>
    </form>
  );
}

"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Checkbox, FormError, Honeypot, Input } from "@/components/ui/Field";
import { useAuth } from "@/lib/backend/auth";
import { BackendError } from "@/lib/backend/client";
import { useT, type TFn } from "@/lib/i18n";
import { NotSwitchedOn, type AuthContact } from "./NotSwitchedOn";
import { MIN_PASSWORD, PasswordField } from "./PasswordField";
import { homeFor, safeNext, stashPendingSignup } from "./safe-next";

const makeSchema = (t: TFn) => z.object({
  fullName: z.string().trim().min(2, t("auth.errName")).max(120, t("auth.errNameLong")),
  company: z.string().trim().max(160, t("auth.errCompanyLong")),
  email: z.email(t("auth.errEmail")).max(254),
  phone: z.union([z.literal(""), z.string().trim().regex(/^[0-9+()\-\s]{6,40}$/, t("auth.errPhone"))]),
  password: z.string().min(MIN_PASSWORD, t("auth.errPwMin", { n: MIN_PASSWORD })).max(128, t("auth.errPwMax")),
});
type Values = z.infer<ReturnType<typeof makeSchema>>;
type Errors = Partial<Record<keyof Values, string>>;

export function RegisterForm({ contact }: { contact: AuthContact }) {
  const { ready, configured, user, isGuest, profile, isStaff, signUp } = useAuth();
  const router = useRouter();
  const t = useT();
  const schema = useMemo(() => makeSchema(t), [t]);
  const next = safeNext(useSearchParams().get("next"));
  const [v, setV] = useState<Values>({ fullName: "", company: "", email: "", phone: "", password: "" });
  const [marketing, setMarketing] = useState(false);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const set = (k: keyof Values) => (val: string) => setV((s) => ({ ...s, [k]: val }));

  const signedIn = Boolean(user && !isGuest);
  useEffect(() => {
    // also covers projects with email confirmation switched off: the session is live straight away
    if (ready && signedIn && profile) router.replace(next ?? homeFor(isStaff));
  }, [ready, signedIn, profile, isStaff, next, router]);

  if (!configured) return <NotSwitchedOn contact={contact} />;

  const loginHref = next ? `/login/?next=${encodeURIComponent(next)}` : "/login/";
  if (confirmFor)
    return (
      <div className="flex flex-col gap-6" role="status">
        <h1 className="t-title text-fog-50">{t("auth.confirmTitle")}</h1>
        <p className="text-fog-300">{t("auth.confirmBody1")} <span className="break-all text-fog-50">{confirmFor}</span>{t("auth.confirmBody2")}</p>
        {isGuest && <p className="border border-ink-600 p-4 text-sm text-fog-300">{t("auth.confirmGuest")}</p>}
        <p className="text-fog-400">{t("auth.confirmNothing")}</p>
        <div className="flex flex-wrap gap-3"><Button href={loginHref} arrow>{t("auth.goSignIn")}</Button><Button href="/spp-studio/" variant="outline">{t("common.openStudio")}</Button></div>
      </div>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (website) return; // honeypot: bots fill it, people never see it
    const parsed = schema.safeParse(v);
    if (!parsed.success) {
      const f = z.flattenError(parsed.error).fieldErrors;
      return setErrors({ fullName: f.fullName?.[0], company: f.company?.[0], email: f.email?.[0], phone: f.phone?.[0], password: f.password?.[0] });
    }
    setErrors({});
    setBusy(true);
    try {
      const d = parsed.data;
      const { needsConfirmation } = await signUp({ email: d.email, password: d.password, fullName: d.fullName, phone: d.phone || undefined });
      // Auth stores name + phone only. Company and consent are applied to the customer's own rows on first portal visit.
      if (d.company || marketing) stashPendingSignup({ email: d.email.toLowerCase(), company: d.company, marketing });
      setV((s) => ({ ...s, password: "" }));
      if (needsConfirmation) setConfirmFor(d.email);
      // otherwise the session is live and the redirect effect takes over
    } catch (err) {
      setFormError(err instanceof BackendError ? err.message : t("auth.regFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div>
        <h1 className="t-title text-fog-50">{t("auth.regTitle")}</h1>
        <p className="mt-3 text-fog-400">{t("auth.regBody")}</p>
      </div>
      {isGuest && (
        <p className="flex items-start gap-3 border border-gold/60 bg-gold/10 p-4 text-sm text-fog-50">
          <span aria-hidden className="reg mt-0.5 text-gold" />{t("auth.regGuest")}
        </p>
      )}
      <FormError message={formError} />
      <Honeypot value={website} onChange={setWebsite} />
      <Input label={t("auth.fullName")} name="name" autoComplete="name" required value={v.fullName} onChange={(e) => set("fullName")(e.target.value)} error={errors.fullName} />
      <Input label={t("auth.companyOpt")} name="organization" autoComplete="organization" value={v.company} onChange={(e) => set("company")(e.target.value)} error={errors.company} hint={t("auth.companyHint")} />
      <Input label={t("auth.email")} type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required value={v.email} onChange={(e) => set("email")(e.target.value)} error={errors.email} />
      <Input label={t("auth.phoneOpt")} type="tel" name="tel" autoComplete="tel" inputMode="tel" value={v.phone} onChange={(e) => set("phone")(e.target.value)} error={errors.phone} hint={t("auth.phoneHint")} />
      <PasswordField label={t("auth.password")} value={v.password} onChange={set("password")} autoComplete="new-password" strength avoid={[v.email.split("@")[0] ?? "", ...v.fullName.split(/\s+/)]} error={errors.password} />
      <Checkbox checked={marketing} onChange={(e) => setMarketing(e.target.checked)} label={t("form.consentEmail")} />
      <p className="text-sm text-fog-500">
        {t("auth.agree1")} <Link href="/terms/" className="text-fog-300 underline underline-offset-4 hover:text-yellow">{t("auth.terms")}</Link> {t("auth.agree2")} <Link href="/privacy/" className="text-fog-300 underline underline-offset-4 hover:text-yellow">{t("auth.privacy")}</Link>.
      </p>
      <div><Button type="submit" size="lg" arrow loading={busy}>{t("auth.create")}</Button></div>
      <p className="rule-t pt-6 text-fog-400">{t("auth.already")} <Link href={loginHref} className="text-fog-50 underline decoration-gold underline-offset-4 transition-colors hover:text-gold">{t("auth.signIn")}</Link></p>
    </form>
  );
}

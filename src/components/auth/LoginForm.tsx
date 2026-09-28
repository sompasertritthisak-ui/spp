"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { FormError, Input } from "@/components/ui/Field";
import { useAuth } from "@/lib/backend/auth";
import { BackendError } from "@/lib/backend/client";
import { useT, type TFn } from "@/lib/i18n";
import { NotSwitchedOn, type AuthContact } from "./NotSwitchedOn";
import { PasswordField } from "./PasswordField";
import { ForgotPasswordForm, NewPasswordForm } from "./ResetForms";
import { homeFor, safeNext } from "./safe-next";

const makeSchema = (t: TFn) => z.object({
  email: z.email(t("auth.errEmail")),
  password: z.string().min(1, t("auth.errPassword")),
});

export function LoginForm({ contact }: { contact: AuthContact }) {
  const { ready, configured, user, isGuest, profile, isStaff, signIn } = useAuth();
  const router = useRouter();
  const t = useT();
  const schema = useMemo(() => makeSchema(t), [t]);
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const recovering = params.get("reset") === "1";
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signedIn = Boolean(user && !isGuest);
  // Staff land in the Command Center, customers in My SPP — unless a safe ?next= says otherwise.
  useEffect(() => {
    if (!ready || !signedIn || recovering) return;
    if (profile) return void router.replace(next ?? homeFor(isStaff));
    // the profile row loads a tick after the session; do not strand the user if it never arrives
    const t = setTimeout(() => router.replace(next ?? "/account/"), 3500);
    return () => clearTimeout(t);
  }, [ready, signedIn, recovering, profile, isStaff, next, router]);

  if (!configured) return <NotSwitchedOn contact={contact} />;
  if (recovering) return <NewPasswordForm onDone={() => router.replace(next ?? homeFor(isStaff))} />;
  if (mode === "forgot") return <ForgotPasswordForm initialEmail={email} onBack={() => setMode("signin")} />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = schema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      const f = z.flattenError(parsed.error).fieldErrors;
      return setErrors({ email: f.email?.[0], password: f.password?.[0] });
    }
    setErrors({});
    setBusy(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
      // the redirect effect takes over once the session lands
    } catch (err) {
      setPassword("");
      setFormError(err instanceof BackendError ? err.message : t("auth.signInFailed"));
      setBusy(false);
    }
  };

  const registerHref = next ? `/register/?next=${encodeURIComponent(next)}` : "/register/";
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6" aria-busy={busy || signedIn}>
      <div>
        <h1 className="t-title text-fog-50">{t("auth.signInTitle")}</h1>
        <p className="mt-3 text-fog-400">{t("auth.signInBody")}</p>
      </div>
      {isGuest && (
        <p className="border border-warn/40 bg-warn/10 p-4 text-sm text-fog-100">
          {t("auth.guestWarn")} <Link href={registerHref} className="text-yellow underline underline-offset-4">{t("auth.guestWarnLink")}</Link> {t("auth.guestWarnEnd")}
        </p>
      )}
      <FormError message={formError} />
      <Input label={t("auth.email")} type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
      <PasswordField label={t("auth.password")} value={password} onChange={setPassword} autoComplete="current-password" error={errors.password} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button type="submit" size="lg" arrow loading={busy || (ready && signedIn)}>{t("auth.signIn")}</Button>
        <button type="button" onClick={() => setMode("forgot")} className="t-label min-h-11 text-fog-400 underline-offset-4 transition-colors hover:text-gold hover:underline">{t("auth.forgot")}</button>
      </div>
      <p className="rule-t pt-6 text-fog-400">
        {t("auth.newTo")} <Link href={registerHref} className="text-fog-50 underline decoration-gold underline-offset-4 transition-colors hover:text-gold">{t("auth.createLink")}</Link> {t("auth.createFree")}
      </p>
    </form>
  );
}

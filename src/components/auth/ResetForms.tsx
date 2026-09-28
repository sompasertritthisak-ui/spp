"use client";
import { useMemo, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { FormError, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/backend/auth";
import { backend, BackendError } from "@/lib/backend/client";
import { useT, type TFn } from "@/lib/i18n";
import { MIN_PASSWORD, PasswordField } from "./PasswordField";

const makeEmailSchema = (t: TFn) => z.email(t("auth.errEmail"));

export function ForgotPasswordForm({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const { sendReset } = useAuth();
  const t = useT();
  const emailSchema = useMemo(() => makeEmailSchema(t), [t]);
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setError(undefined);
    setFormError(null);
    setBusy(true);
    try {
      await sendReset(parsed.data);
      setSent(true);
    } catch (err) {
      // Only transport problems are reported. Anything else gets the same neutral
      // answer, so this form can never be used to test which emails have accounts.
      if (err instanceof BackendError && (err.code === "network" || err.code === "rate_limited")) setFormError(err.message);
      else setSent(true);
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <div className="flex flex-col gap-6" role="status">
        <h1 className="t-title text-fog-50">{t("auth.inboxTitle")}</h1>
        <p className="text-fog-300">{t("auth.inboxBody1")} <span className="break-all text-fog-50">{email.trim()}</span>{t("auth.inboxBody2")}</p>
        <p className="text-fog-400">{t("auth.inboxNote")}</p>
        <div><Button variant="outline" onClick={onBack}>{t("auth.backToSignIn")}</Button></div>
      </div>
    );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div>
        <h1 className="t-title text-fog-50">{t("auth.resetTitle")}</h1>
        <p className="mt-3 text-fog-400">{t("auth.resetBody")}</p>
      </div>
      <FormError message={formError} />
      <Input label={t("auth.email")} type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" arrow loading={busy}>{t("auth.sendReset")}</Button>
        <Button variant="ghost" onClick={onBack}>{t("auth.backToSignIn")}</Button>
      </div>
    </form>
  );
}

const makeNewPasswordSchema = (t: TFn) => z
  .object({ password: z.string().min(MIN_PASSWORD, t("auth.errPwMin", { n: MIN_PASSWORD })).max(128, t("auth.errPwMax")), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: t("auth.errMatch") });

/** Shown on /login/?reset=1 — Supabase has already turned the emailed link into a recovery session. */
export function NewPasswordForm({ onDone }: { onDone: () => void }) {
  const { ready, user, isGuest } = useAuth();
  const toast = useToast();
  const t = useT();
  const newPasswordSchema = useMemo(() => makeNewPasswordSchema(t), [t]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!ready) return <div className="flex flex-col gap-4" aria-busy="true"><div className="skeleton h-10 w-2/3" /><div className="skeleton h-12 w-full" /><div className="skeleton h-12 w-full" /></div>;
  if (!user || isGuest)
    return (
      <div className="flex flex-col gap-6">
        <h1 className="t-title text-fog-50">{t("auth.invalidTitle")}</h1>
        <p className="text-fog-300">{t("auth.invalidBody")}</p>
        <div><Button href="/login/" arrow>{t("auth.backToSignIn")}</Button></div>
      </div>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = newPasswordSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      const f = z.flattenError(parsed.error).fieldErrors;
      return setErrors({ password: f.password?.[0], confirm: f.confirm?.[0] });
    }
    setErrors({});
    setBusy(true);
    const { error } = await backend()!.auth.updateUser({ password: parsed.data.password });
    if (error) {
      setBusy(false);
      // Supabase's password-policy messages are written for end users; everything else stays generic.
      return setFormError(/password/i.test(error.message) ? error.message : t("auth.saveFailed"));
    }
    toast(t("auth.updated"), "ok");
    onDone();
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div>
        <h1 className="t-title text-fog-50">{t("auth.newTitle")}</h1>
        <p className="mt-3 break-all text-fog-400">{t("auth.for")} {user.email}</p>
      </div>
      <FormError message={formError} />
      <PasswordField label={t("auth.newPassword")} value={password} onChange={setPassword} autoComplete="new-password" strength avoid={[user.email?.split("@")[0] ?? ""]} error={errors.password} />
      <PasswordField label={t("auth.repeatPassword")} name="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" error={errors.confirm} />
      <div><Button type="submit" size="lg" arrow loading={busy}>{t("auth.saveNew")}</Button></div>
    </form>
  );
}

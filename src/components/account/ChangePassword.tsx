"use client";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { MIN_PASSWORD, PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/backend/auth";
import { BackendError, requireBackend } from "@/lib/backend/client";
import { Block } from "./ui";

const schema = z
  .object({ current: z.string().min(1, "Enter your current password."), next: z.string().min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters.`).max(128, "That is longer than we can store.") })
  .refine((v) => v.current !== v.next, { path: ["next"], message: "Choose a password you have not just used." });

export function ChangePassword({ email }: { email: string }) {
  const { signIn } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = schema.safeParse({ current, next });
    if (!parsed.success) {
      const f = z.flattenError(parsed.error).fieldErrors;
      return setErrors({ current: f.current?.[0], next: f.next?.[0] });
    }
    setErrors({});
    setBusy(true);
    try {
      // Re-prove the current password first, so an unattended signed-in browser cannot be used to take the account over.
      await signIn(email, parsed.data.current);
    } catch (err) {
      setBusy(false);
      return err instanceof BackendError && err.message.includes("do not match") ? setErrors({ current: "That is not your current password." }) : setFormError(err instanceof BackendError ? err.message : "We could not verify your password. Please try again.");
    }
    const { error } = await requireBackend().auth.updateUser({ password: parsed.data.next });
    setBusy(false);
    if (error) return setFormError(/password/i.test(error.message) ? error.message : "We could not change the password. Please try again.");
    setCurrent("");
    setNext("");
    toast("Password changed.", "ok");
  };

  return (
    <Block title="Change password">
      <form onSubmit={submit} noValidate className="flex max-w-xl flex-col gap-6">
        {/* lets password managers attach the new password to the right account */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <PasswordField label="Current password" name="current-password" value={current} onChange={setCurrent} autoComplete="current-password" error={errors.current} />
        <PasswordField label="New password" name="new-password" value={next} onChange={setNext} autoComplete="new-password" strength avoid={[email.split("@")[0] ?? ""]} error={errors.next} />
        <FormError message={formError} />
        <div><Button type="submit" variant="outline" loading={busy} disabled={!current || !next}>Change password</Button></div>
      </form>
    </Block>
  );
}

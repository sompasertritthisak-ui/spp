"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Checkbox, FormError, Honeypot, Input } from "@/components/ui/Field";
import { useAuth } from "@/lib/backend/auth";
import { BackendError } from "@/lib/backend/client";
import { NotSwitchedOn, type AuthContact } from "./NotSwitchedOn";
import { MIN_PASSWORD, PasswordField } from "./PasswordField";
import { homeFor, safeNext, stashPendingSignup } from "./safe-next";

const schema = z.object({
  fullName: z.string().trim().min(2, "Please tell us your name.").max(120, "That name is too long."),
  company: z.string().trim().max(160, "That company name is too long."),
  email: z.email("That email address does not look right.").max(254),
  phone: z.union([z.literal(""), z.string().trim().regex(/^[0-9+()\-\s]{6,40}$/, "That phone number does not look right.")]),
  password: z.string().min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters.`).max(128, "That is longer than we can store."),
});
type Values = z.infer<typeof schema>;
type Errors = Partial<Record<keyof Values, string>>;

export function RegisterForm({ contact }: { contact: AuthContact }) {
  const { ready, configured, user, isGuest, profile, isStaff, signUp } = useAuth();
  const router = useRouter();
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
        <h1 className="t-title text-fog-50">Check your email to confirm.</h1>
        <p className="text-fog-300">We sent a confirmation link to <span className="break-all text-fog-50">{confirmFor}</span>. Open it on this device and your account is ready.</p>
        {isGuest && <p className="border border-ink-600 p-4 text-sm text-fog-300">Your saved designs stay attached to this account — they will be in My Designs once you confirm.</p>}
        <p className="text-fog-400">Nothing after a few minutes? Check spam, or register again with the correct address.</p>
        <div className="flex flex-wrap gap-3"><Button href={loginHref} arrow>Go to sign in</Button><Button href="/spp-studio/" variant="outline">Open SPP Studio</Button></div>
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
      setFormError(err instanceof BackendError ? err.message : "We could not create the account. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div>
        <h1 className="t-title text-fog-50">Create your My SPP account</h1>
        <p className="mt-3 text-fog-400">Save designs, follow quotes and orders, and reorder later without starting again.</p>
      </div>
      {isGuest && (
        <p className="flex items-start gap-3 border border-yellow/50 bg-yellow/5 p-4 text-sm text-fog-50">
          <span aria-hidden className="reg mt-0.5 text-yellow" />Your saved designs will move into your new account.
        </p>
      )}
      <FormError message={formError} />
      <Honeypot value={website} onChange={setWebsite} />
      <Input label="Full name" name="name" autoComplete="name" required value={v.fullName} onChange={(e) => set("fullName")(e.target.value)} error={errors.fullName} />
      <Input label="Company (optional)" name="organization" autoComplete="organization" value={v.company} onChange={(e) => set("company")(e.target.value)} error={errors.company} hint="Becomes your brand name in My Brand. You can change it any time." />
      <Input label="Email" type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required value={v.email} onChange={(e) => set("email")(e.target.value)} error={errors.email} />
      <Input label="Phone (optional)" type="tel" name="tel" autoComplete="tel" inputMode="tel" value={v.phone} onChange={(e) => set("phone")(e.target.value)} error={errors.phone} hint="So SPP can reach you about an order. Include the country code." />
      <PasswordField label="Password" value={v.password} onChange={set("password")} autoComplete="new-password" strength avoid={[v.email.split("@")[0] ?? "", ...v.fullName.split(/\s+/)]} error={errors.password} />
      <Checkbox checked={marketing} onChange={(e) => setMarketing(e.target.checked)} label="Send me occasional SPP news and offers by email. Optional — you can change this in your profile." />
      <p className="text-sm text-fog-500">
        By creating an account you agree to the <Link href="/terms/" className="text-fog-300 underline underline-offset-4 hover:text-yellow">Terms</Link> and confirm you have read the <Link href="/privacy/" className="text-fog-300 underline underline-offset-4 hover:text-yellow">Privacy Policy</Link>.
      </p>
      <div><Button type="submit" size="lg" arrow loading={busy}>Create account</Button></div>
      <p className="rule-t pt-6 text-fog-400">Already have an account? <Link href={loginHref} className="text-fog-50 underline underline-offset-4 hover:text-yellow">Sign in</Link></p>
    </form>
  );
}

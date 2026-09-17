"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { ErrorNote } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { Checkbox, FormError, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/backend/auth";
import { requireBackend, toBackendError } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { ChangePassword } from "./ChangePassword";
import { usePortal } from "./PortalShell";
import { Block, PortalHeader, RowsSkeleton } from "./ui";

const schema = z.object({
  full_name: z.string().trim().min(2, "Please tell us your name.").max(120, "That name is too long."),
  phone: z.union([z.literal(""), z.string().trim().regex(/^[0-9+()\-\s]{6,40}$/, "That phone number does not look right.")]),
});

export function ProfilePage() {
  const { uid, profile, contact } = usePortal();
  const { user, signOut, refreshProfile } = useAuth();
  const email = user?.email ?? profile.email; // Auth is the source of truth for the sign-in address
  const router = useRouter();
  const toast = useToast();
  const q = useQuery<{ marketing_consent: boolean; companies: { name: string } | { name: string }[] | null } | null>(() => requireBackend().from("profiles").select("marketing_consent,companies(name)").eq("id", uid).maybeSingle(), [uid]);
  const [name, setName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone);
  const [marketingEdit, setMarketing] = useState<boolean | null>(null); // null = untouched, show the stored value
  const [errors, setErrors] = useState<{ full_name?: string; phone?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const marketing = marketingEdit ?? q.data?.marketing_consent ?? false;
  const company = Array.isArray(q.data?.companies) ? q.data?.companies[0]?.name : q.data?.companies?.name;
  const dirty = name !== profile.full_name || phone !== profile.phone || (q.data ? marketing !== q.data.marketing_consent : false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = schema.safeParse({ full_name: name, phone });
    if (!parsed.success) {
      const f = z.flattenError(parsed.error).fieldErrors;
      return setErrors({ full_name: f.full_name?.[0], phone: f.phone?.[0] });
    }
    setErrors({});
    setSaving(true);
    // Only the three fields a customer may change. Role, email and company are guarded by a database trigger.
    const { error } = await requireBackend().from("profiles").update({ full_name: parsed.data.full_name, phone: parsed.data.phone, marketing_consent: marketing }).eq("id", uid);
    setSaving(false);
    if (error) return setFormError(toBackendError(error).message);
    setName(parsed.data.full_name);
    setPhone(parsed.data.phone);
    toast("Profile saved.", "ok");
    void refreshProfile();
    void q.reload();
  };

  const leave = async () => {
    setLeaving(true);
    try { await signOut(); router.replace("/"); } catch { setLeaving(false); toast("We could not sign you out. Please try again.", "danger"); }
  };

  const deleteHref = contact.email ? `mailto:${contact.email}?subject=${encodeURIComponent("Delete my My SPP account")}&body=${encodeURIComponent(`Hello SPP,\n\nPlease delete my My SPP account and the personal data attached to it.\n\nAccount email: ${email}\n\nThank you.`)}` : null;

  return (
    <>
      <PortalHeader title="Profile" sub="How SPP addresses you and reaches you about your work." />
      <ErrorNote message={q.error} onRetry={q.reload} />

      <Block title="Your details">
        {q.loading && !q.data ? <RowsSkeleton rows={3} /> : (
          <form onSubmit={save} noValidate className="flex max-w-xl flex-col gap-6">
            <Input label="Full name" name="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} error={errors.full_name} />
            <Input label="Email" type="email" value={email} readOnly disabled hint="Your sign-in email cannot be changed here. Ask SPP if it needs updating." />
            <Input label="Phone" type="tel" name="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} hint="Include the country code, e.g. +856." />
            {company && <p className="text-sm text-fog-400"><span className="t-label mr-2 text-fog-500">Company</span>{company} — linked by SPP.</p>}
            <Checkbox checked={marketing} onChange={(e) => setMarketing(e.target.checked)} label="Send me occasional SPP news and offers by email. Order and quote messages are always sent." />
            <FormError message={formError} />
            <div><Button type="submit" loading={saving} disabled={!dirty}>Save profile</Button></div>
          </form>
        )}
      </Block>

      <ChangePassword email={email} />

      <Block title="Session">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-fog-400">Signed in as <span className="break-all text-fog-50">{email}</span>.</p>
          <Button variant="outline" loading={leaving} onClick={() => void leave()}>Sign out</Button>
        </div>
      </Block>

      <Block title="Delete my account">
        <p className="max-w-2xl text-fog-400">There is no self-service delete button: accounts are tied to quotes, orders and production records, so a person at SPP removes them by hand. Send the request and SPP will confirm by email what is deleted and what must be kept for accounting.</p>
        <div className="mt-4">
          {deleteHref ? <Button href={deleteHref} variant="danger">Email a deletion request</Button> : <Button href="/contact/" variant="danger">Contact SPP to delete my account</Button>}
        </div>
      </Block>
    </>
  );
}

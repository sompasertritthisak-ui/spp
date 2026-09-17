import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthSplit } from "@/components/auth/AuthSplit";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { getContent } from "@/lib/content";
import { whatsappHref } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Create an account", description: "Create a My SPP account.", robots: { index: false, follow: false } };

export default async function RegisterPage() {
  const { settings } = await getContent();
  const contact = { email: settings.email, whatsappHref: whatsappHref(settings.whatsapp, { kind: "general" }) };
  return (
    <AuthSplit plate="Create account">
      <Suspense fallback={<div className="flex flex-col gap-4" aria-busy="true"><div className="skeleton h-10 w-2/3" /><div className="skeleton h-12 w-full" /><div className="skeleton h-12 w-full" /><div className="skeleton h-12 w-full" /></div>}>
        <RegisterForm contact={contact} />
      </Suspense>
    </AuthSplit>
  );
}

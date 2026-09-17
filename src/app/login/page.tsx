import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthSplit } from "@/components/auth/AuthSplit";
import { LoginForm } from "@/components/auth/LoginForm";
import { getContent } from "@/lib/content";
import { whatsappHref } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Sign in", description: "Sign in to My SPP.", robots: { index: false, follow: false } };

export default async function LoginPage() {
  const { settings } = await getContent();
  const contact = { email: settings.email, whatsappHref: whatsappHref(settings.whatsapp, { kind: "general" }) };
  return (
    <AuthSplit plate="Sign in">
      <Suspense fallback={<div className="flex flex-col gap-4" aria-busy="true"><div className="skeleton h-10 w-2/3" /><div className="skeleton h-12 w-full" /><div className="skeleton h-12 w-full" /></div>}>
        <LoginForm contact={contact} />
      </Suspense>
    </AuthSplit>
  );
}

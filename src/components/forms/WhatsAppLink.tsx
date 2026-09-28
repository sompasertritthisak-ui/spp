"use client";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/backend/analytics";
import { useT } from "@/lib/i18n";

/** WhatsApp hand-off. Callers pass an href from whatsappHref() and render nothing when it is null. */
export function WhatsAppLink({ href, label, source, size = "md", variant = "outline" }: { href: string; label?: string; source: string; size?: "sm" | "md" | "lg"; variant?: "outline" | "ghost" | "primary" }) {
  const t = useT();
  return (
    <span onClickCapture={() => track("whatsapp_click", { source })} className="inline-flex">
      <Button href={href} external variant={variant} size={size}>{label ?? t("common.whatsappSpp")}</Button>
    </span>
  );
}

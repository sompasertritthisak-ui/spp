"use client";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/backend/analytics";

/** WhatsApp hand-off. Callers pass an href from whatsappHref() and render nothing when it is null. */
export function WhatsAppLink({ href, label = "WhatsApp SPP", source, size = "md", variant = "outline" }: { href: string; label?: string; source: string; size?: "sm" | "md" | "lg"; variant?: "outline" | "ghost" | "primary" }) {
  return (
    <span onClickCapture={() => track("whatsapp_click", { source })} className="inline-flex">
      <Button href={href} external variant={variant} size={size}>{label}</Button>
    </span>
  );
}

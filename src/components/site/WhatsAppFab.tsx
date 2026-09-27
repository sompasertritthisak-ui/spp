"use client";
import { clsx } from "clsx";
import { track } from "@/lib/backend/analytics";
import { whatsappHref } from "@/lib/whatsapp";
import { SocialIcon } from "./SocialIcons";

/**
 * Floating WhatsApp button — bottom-right, follows the scroll, opens a chat
 * with SPP's number with a greeting pre-filled. Renders nothing until a
 * WhatsApp number is set in Settings (never a dead button).
 * Pages with their own bottom bar set `data-bottom-bar` on <body> so the
 * button rides above it (see globals.css).
 */
export function WhatsAppFab({ number, className }: { number: string; className?: string }) {
  const href = whatsappHref(number, { kind: "general" });
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("whatsapp_click", { source: "fab" })}
      aria-label="Chat with SPP on WhatsApp"
      className={clsx(
        "site-fab group fixed right-4 z-40 flex h-14 items-center gap-0 rounded-full bg-[#25d366] pl-0 pr-0 text-white shadow-2xl shadow-black/40 transition-[padding,transform] duration-300 ease-[var(--ease-press)] hover:pr-5 hover:shadow-[#25d366]/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25d366] motion-safe:hover:-translate-y-0.5",
        className,
      )}
    >
      <span className="flex h-14 w-14 flex-none items-center justify-center">
        <SocialIcon platform="whatsapp" className="h-7 w-7" />
      </span>
      <span className="t-label max-w-0 overflow-hidden whitespace-nowrap text-[0.6875rem] text-white opacity-0 transition-[max-width,opacity] duration-300 group-hover:max-w-40 group-hover:opacity-100 group-focus-visible:max-w-40 group-focus-visible:opacity-100">Chat on WhatsApp</span>
      <span aria-hidden className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-gold" />
    </a>
  );
}

"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "@/components/brand/Logo";
import { api } from "@/lib/backend/api";

/** Only same-site paths are followed — a QR code must never become an open redirect. */
const safePath = (d: unknown) => (typeof d === "string" && /^\/(?!\/)/.test(d) ? d : "/");

export function QrRedirect() {
  const router = useRouter();
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("c") ?? "";
    if (!/^[A-Za-z0-9]{6,16}$/.test(code)) return router.replace("/");
    let alive = true;
    // Never leave someone staring at a logo: a slow network falls back to the home page.
    const timer = setTimeout(() => { if (alive) { alive = false; router.replace("/"); } }, 4000);
    api.trackQr(code).then(
      (r) => {
        if (!alive) return;
        const dest = safePath(r?.destination);
        const [path = "/", hash = ""] = dest.split("#");
        router.replace(`${path}${path.includes("?") ? "&" : "?"}qr=${encodeURIComponent(r?.code ?? code)}${hash ? `#${hash}` : ""}`);
      },
      () => { if (alive) router.replace("/"); },
    ).finally(() => { alive = false; clearTimeout(timer); });
    return () => { alive = false; clearTimeout(timer); };
  }, [router]);

  return (
    <div role="status" aria-label="Opening SPP" className="fixed inset-0 z-[200] flex items-center justify-center bg-ink-950">
      <Logo animate className="h-14 w-auto" />
    </div>
  );
}

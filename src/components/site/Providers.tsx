"use client";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { track } from "@/lib/backend/analytics";
import { AuthProvider } from "@/lib/backend/auth";

function PageViews() {
  const path = usePathname();
  useEffect(() => {
    // remember the first campaign source of the visit for attribution
    const src = new URLSearchParams(location.search).get("utm_source");
    if (src) try { sessionStorage.setItem("spp.src", src.slice(0, 120)); } catch {}
    track("page_view");
  }, [path]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <PageViews />
        {children}
      </ToastProvider>
    </AuthProvider>
  );
}

"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { canDo, useAuth } from "@/lib/backend/auth";
import { backend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { relativeTime } from "@/lib/format";
import { CommandPalette } from "./CommandPalette";
import { adminNav } from "./nav";

type Note = { id: string; kind: string; title: string; body: string; href: string; read_at: string | null; created_at: string };

function Gate({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="grain flex min-h-dvh items-center justify-center p-6">
      <div className="crop w-full max-w-lg border border-ink-600 bg-ink-900 p-8">
        <Logo className="mb-8 h-7" />
        <p className="t-label mb-3 text-yellow">SPP Command Center</p>
        <h1 className="t-title text-fog-50">{title}</h1>
        <p className="mt-4 text-fog-300">{body}</p>
        {action && <div className="mt-8 flex flex-wrap gap-3">{action}</div>}
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { ready, configured, user, profile, isStaff, isGuest, signOut } = useAuth();
  const [palette, setPalette] = useState(false);
  const [menu, setMenu] = useState(false);
  const [bell, setBell] = useState(false);

  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); } };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  useEffect(() => { setMenu(false); setBell(false); }, [path]);
  useEffect(() => { if (ready && configured && (!user || isGuest)) router.replace(`/login/?next=${encodeURIComponent(path)}`); }, [ready, configured, user, isGuest, path, router]);

  const notes = useQuery<Note[]>(() => backend()!.from("notifications").select("id,kind,title,body,href,read_at,created_at").order("created_at", { ascending: false }).limit(20), [path], { enabled: Boolean(isStaff) });
  const unread = notes.data?.filter((n) => !n.read_at).length ?? 0;

  if (!configured)
    return <Gate title="Back-end not connected yet." body="The Command Center reads and writes live business data, so it needs the Supabase project. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see docs/DEPLOY.md), then restart." action={<Button href="/" variant="outline">Back to the site</Button>} />;
  if (!ready || !user || isGuest || (user && !profile)) return <div className="flex min-h-dvh items-center justify-center"><Logo animate className="h-8" /></div>;
  if (!isStaff)
    return <Gate title="This area is for the SPP team." body={`You are signed in as ${profile?.email}. That account does not have staff access. If it should, ask an SPP administrator to assign you a role.`} action={<><Button href="/account/">Go to My SPP</Button><Button variant="outline" onClick={() => void signOut()}>Sign out</Button></>} />;

  const markAllRead = async () => {
    const ids = notes.data?.filter((n) => !n.read_at).map((n) => n.id) ?? [];
    if (ids.length) await backend()!.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    void notes.reload();
  };

  const sidebar = (
    <nav aria-label="Command Center" className="thin-scroll flex h-full flex-col overflow-y-auto">
      <Link href="/admin/dashboard/" className="flex h-16 flex-none items-center gap-3 border-b border-ink-700 px-5"><Logo className="h-5" /><span className="t-label text-fog-500">Command</span></Link>
      <div className="flex-1 py-4">
        {adminNav.map((g) => {
          const items = g.items.filter((i) => !i.cap || canDo(profile?.role, i.cap));
          if (!items.length) return null;
          return (
            <div key={g.label} className="mb-4">
              <p className="t-label px-5 pb-1.5 text-[0.625rem] text-fog-500">{g.label}</p>
              <ul>
                {items.map((i) => {
                  const on = path.startsWith(i.href);
                  return (
                    <li key={i.href}>
                      <Link href={i.href} aria-current={on ? "page" : undefined} className={clsx("relative flex min-h-10 items-center px-5 text-sm transition-colors", on ? "bg-ink-800 text-fog-50" : "text-fog-400 hover:bg-ink-850 hover:text-fog-50")}>
                        {on && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-yellow" />}
                        {i.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="flex-none border-t border-ink-700 p-4">
        <p className="truncate text-sm text-fog-100">{profile?.full_name || profile?.email}</p>
        <p className="t-label mt-1 text-fog-500">{profile?.role.replace("_", " ")}</p>
        <div className="mt-3 flex gap-3"><Link href="/" className="t-label text-fog-400 hover:text-fog-50">Site</Link><button type="button" onClick={() => void signOut()} className="t-label text-fog-400 hover:text-danger">Sign out</button></div>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-dvh bg-ink-950">
      <aside className="sticky top-0 hidden h-dvh w-60 flex-none border-r border-ink-700 bg-ink-900 lg:block">{sidebar}</aside>
      {menu && (
        <div className="fixed inset-0 z-[90] lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setMenu(false)} className="absolute inset-0 cursor-default bg-black/70" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-ink-600 bg-ink-900">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 flex-none items-center gap-3 border-b border-ink-700 bg-ink-950/90 px-4 backdrop-blur-md lg:px-6">
          <button type="button" onClick={() => setMenu(true)} aria-label="Open menu" className="flex h-10 w-10 items-center justify-center text-fog-300 lg:hidden">
            <svg aria-hidden viewBox="0 0 18 12" className="h-3 w-[1.125rem]" stroke="currentColor" strokeWidth="1.5"><path d="M0 1h18M0 6h18M0 11h18" /></svg>
          </button>
          <button type="button" onClick={() => setPalette(true)} className="flex h-10 min-w-0 flex-1 items-center justify-between gap-3 border border-ink-700 bg-ink-900 px-3.5 text-left text-sm text-fog-500 transition-colors hover:border-ink-500 sm:max-w-md">
            <span className="truncate">Search or run a command…</span><kbd className="t-label hidden flex-none border border-ink-600 px-1.5 py-0.5 sm:block">⌘K</kbd>
          </button>
          <div className="relative ml-auto">
            <button type="button" onClick={() => setBell((b) => !b)} aria-expanded={bell} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative flex h-10 w-10 items-center justify-center text-fog-300 hover:text-fog-50">
              <svg aria-hidden viewBox="0 0 16 18" className="h-[1.125rem] w-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1a5 5 0 00-5 5v4l-2 3h14l-2-3V6a5 5 0 00-5-5zM6 16a2 2 0 004 0" /></svg>
              {unread > 0 && <span className="t-data absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center bg-yellow px-1 text-[0.625rem] font-semibold text-ink-950">{unread}</span>}
            </button>
            {bell && (
              <div className="absolute right-0 top-12 w-[min(24rem,calc(100vw-2rem))] border border-ink-600 bg-ink-900 shadow-2xl shadow-black">
                <div className="flex items-center justify-between border-b border-ink-700 px-4 py-3"><p className="t-label text-fog-300">Notifications</p>{unread > 0 && <button type="button" onClick={() => void markAllRead()} className="t-label text-yellow">Mark all read</button>}</div>
                <ul className="thin-scroll max-h-96 overflow-y-auto">
                  {notes.data?.map((n) => (
                    <li key={n.id} className="border-b border-ink-800 last:border-0">
                      <Link href={n.href || "/admin/dashboard/"} className="flex gap-3 px-4 py-3 hover:bg-ink-850">
                        <span aria-hidden className={clsx("mt-1.5 h-1.5 w-1.5 flex-none", n.read_at ? "bg-ink-600" : "bg-yellow")} />
                        <span className="min-w-0"><span className="block truncate text-sm text-fog-50">{n.title}</span><span className="block truncate text-xs text-fog-400">{n.body}</span><span className="t-label mt-1 block text-[0.625rem] text-fog-500">{relativeTime(n.created_at)}</span></span>
                      </Link>
                    </li>
                  ))}
                  {notes.data?.length === 0 && <li className="px-4 py-8 text-center text-sm text-fog-500">You are all caught up.</li>}
                </ul>
              </div>
            )}
          </div>
        </header>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 p-4 focus:outline-none lg:p-6">{children}</main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}

"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import type { HomeConfig, HomeSection, HomeSectionKey } from "@/content/types";
import { canDo, useAuth } from "@/lib/backend/auth";
import { backend } from "@/lib/backend/client";
import type { Json } from "@/lib/backend/db-types";
import { useQuery } from "@/lib/backend/hooks";
import { HOME_PAGE_SLUG } from "@/lib/cms-pages";
import { absoluteUrl } from "@/lib/env";
import { relativeTime } from "@/lib/format";
import { HOME_SECTION_KEYS, parseHome, validateHome } from "@/lib/home";
import { DISCARD, useConfirm } from "../../resource/Confirm";
import { adminError } from "../../resource/errors";
import { useParam } from "../../resource/useSelection";
import { ErrorNote, PageHeader } from "../../ui";
import { PublishSite } from "../PublishSite";
import { useHomeData } from "./data";
import { isEditorItem, type EditorItem } from "./meta";
import { AnnouncementPanel, BlocksCard, HeroPanel, SectionPanel, SeoPanel } from "./panels";
import { SectionNav } from "./SectionNav";

type Stored = { value: unknown; updated_at: string } | null;

/** Command Center → CMS → Home page. `?section=` keeps the part being edited in the URL. */
export function HomeEditor() {
  const { profile } = useAuth();
  const stored = useQuery<Stored>(() => backend()!.from("settings").select("value,updated_at").eq("key", "home").maybeSingle(), []);

  if (!canDo(profile?.role, "content"))
    return (
      <div>
        <PageHeader title="Home page" sub="The landing page of the public site." />
        <EmptyState title="Not part of your role." body="The landing page is managed by content managers and administrators. Ask an administrator if you need access." action={<Button href="/admin/cms/" variant="outline" size="sm">Back to the CMS</Button>} />
      </div>
    );
  if (stored.loading && !stored.data) return <div aria-busy="true" aria-label="Loading"><div className="skeleton mb-6 h-9 w-56" /><div className="grid gap-5 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]"><div className="skeleton h-[32rem]" /><div className="skeleton h-[32rem]" /></div></div>;
  if (stored.error) return <div><PageHeader title="Home page" /><ErrorNote message={stored.error} onRetry={() => void stored.reload()} /></div>;
  // keyed on the saved value: after a save the form starts again from what the database now holds
  return <Editor key={stored.data?.updated_at ?? "new"} stored={stored.data} onSaved={() => void stored.reload()} />;
}

function Editor({ stored, onSaved }: { stored: Stored; onSaved: () => void }) {
  const router = useRouter();
  const auth = useAuth();
  const toast = useToast();
  const canWrite = auth.canWrite("content");
  const initial = useMemo(() => parseHome(stored?.value), [stored]);
  const [config, setConfig] = useState<HomeConfig>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(false);
  const [confirm, confirmUi] = useConfirm();
  const home = useHomeData();
  const [param, setParam] = useParam<string>("section", "hero");
  const selected: EditorItem = isEditorItem(param, HOME_SECTION_KEYS) ? param : "hero";
  const dirty = JSON.stringify(config) !== JSON.stringify(initial);
  const panel = useRef<HTMLDivElement>(null);

  // Unsaved-changes guard: closing the tab, and any link that would leave this screen.
  const dirtyRef = useRef(dirty);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const leave = useCallback(async (href: string) => { if (!dirtyRef.current || (await confirm(DISCARD))) { dirtyRef.current = false; router.push(href); } }, [confirm, router]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download") || a.origin !== location.origin) return;
      if (a.pathname === location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      void leave(`${a.pathname}${a.search}${a.hash}`.replace(new RegExp(`^${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}`), "") || "/");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [leave]);

  const clear = (prefix: string) => setErrors((e) => (Object.keys(e).some((k) => k.startsWith(prefix)) ? Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith(prefix))) : e));
  const setSection = (s: HomeSection) => { setConfig((c) => ({ ...c, sections: c.sections.map((x) => (x.key === s.key ? s : x)) })); clear(`sections.${s.key}`); };
  const move = (key: HomeSectionKey, by: -1 | 1) => setConfig((c) => {
    const i = c.sections.findIndex((s) => s.key === key);
    const j = i + by;
    if (i < 0 || j < 0 || j >= c.sections.length) return c;
    const next = [...c.sections];
    [next[i], next[j]] = [next[j]!, next[i]!];
    return { ...c, sections: next };
  });
  const toggle = (key: HomeSectionKey) => setConfig((c) => ({ ...c, sections: c.sections.map((s) => (s.key === key ? { ...s, visible: !s.visible } : s)) }));
  const select = (item: EditorItem) => { setParam(item); requestAnimationFrame(() => panel.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })); };

  const save = async () => {
    const found = validateHome(config);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      const [area, key] = first.split(".");
      const where = area === "sections" && key && isEditorItem(key, HOME_SECTION_KEYS) ? key : area === "announcement" || area === "seo" ? area : "hero";
      setParam(where);
      toast(`${Object.keys(found).length === 1 ? "One field needs" : "Some fields need"} attention before this can be saved.`, "danger");
      return;
    }
    setSaving(true);
    // parseHome trims and normalises, so what is stored is exactly what the site build will read
    const value = parseHome(config) as unknown as Json;
    const res = await backend()!.from("settings").upsert({ key: "home", value, is_public: true, updated_by: auth.user?.id ?? null });
    setSaving(false);
    if (res.error) return toast(`Not saved. ${adminError(res.error)}`, "danger");
    toast("Saved — press Publish site to put it live.", "ok");
    onSaved();
  };

  const reset = async () => {
    if (await confirm({ title: "Undo your unsaved changes?", body: "Everything goes back to the last saved version of the home page.", confirmLabel: "Undo changes", danger: true })) { setConfig(initial); setErrors({}); }
  };

  const openBlocks = async () => {
    if (dirty && !(await confirm({ title: "Leave without saving?", body: "The page builder opens on another screen. Save your home page changes first, or they will be lost.", confirmLabel: "Leave without saving", danger: true }))) return;
    let id = home.data?.blocks?.id ?? null;
    if (!id) {
      setOpening(true);
      const b = backend()!;
      // somebody may have created it a moment ago
      const existing = await b.from("pages").select("id").eq("slug", HOME_PAGE_SLUG).maybeSingle();
      id = (existing.data?.id as string | undefined) ?? null;
      if (!id) {
        const made = await b.from("pages").insert({ slug: HOME_PAGE_SLUG, title: "Home page — custom blocks", status: "published", seo: {}, created_by: auth.user?.id ?? null }).select("id").single();
        if (made.error || !made.data) { setOpening(false); return toast(`The page builder could not be opened. ${adminError(made.error)}`, "danger"); }
        id = made.data.id as string;
      }
      setOpening(false);
    }
    dirtyRef.current = false;
    router.push(`/admin/cms/?id=${id}`);
  };

  const common = { errors, disabled: !canWrite || saving, options: home.options, loading: home.loading };
  const section = config.sections.find((s) => s.key === selected);
  const blocks = <BlocksCard data={home.data} loading={home.loading} canWrite={canWrite} busy={opening} onOpen={() => void openBlocks()} />;
  const problems = Object.keys(errors).length;

  return (
    <div>
      <PageHeader title="Home page" sub="The landing page of the public site: what it says, which sections it shows and in what order. Saving keeps your work; the site changes when you publish." actions={<PublishSite compact />} />

      <div className="sticky top-16 z-10 -mx-4 mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-ink-700 bg-ink-950/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
        <Button variant="ghost" size="sm" href="/admin/cms/">← CMS</Button>
        <p className="mr-auto flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fog-500" aria-live="polite">
          {dirty ? <span className="t-label flex items-center gap-2 text-warn"><span aria-hidden className="h-2 w-2 bg-warn" />Unsaved changes</span> : <span className="t-label flex items-center gap-2 text-ok"><span aria-hidden className="h-2 w-2 bg-ok" />All changes saved</span>}
          <span>{stored?.updated_at ? `Last saved ${relativeTime(stored.updated_at)}` : "Not saved yet — the page uses its designed defaults"}</span>
          {problems > 0 && <span className="text-danger">{problems} field{problems === 1 ? "" : "s"} to check</span>}
        </p>
        <Button variant="outline" size="sm" className="min-h-11" href={absoluteUrl("/")} external title="Opens the landing page that is live now, in a new tab">Preview live page</Button>
        {canWrite ? (
          <>
            <Button variant="ghost" size="sm" className="min-h-11" disabled={!dirty || saving} onClick={() => void reset()}>Undo changes</Button>
            <Button size="sm" className="min-h-11" loading={saving} disabled={!dirty} onClick={() => void save()}>Save home page</Button>
          </>
        ) : <span className="t-label text-fog-500">Read-only for your role</span>}
      </div>

      <ErrorNote message={home.error && `The lists for the pickers could not be loaded: ${home.error}`} onRetry={() => void home.reload()} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div className="grid gap-4 xl:sticky xl:top-36 xl:max-h-[calc(100dvh-10rem)] xl:overflow-y-auto thin-scroll">
          <SectionNav config={config} data={home.data} errors={errors} selected={selected} onSelect={select} onMove={move} onToggle={toggle} canWrite={canWrite && !saving} />
          {selected !== "blocks" && blocks}
        </div>
        <div ref={panel} className="min-w-0 scroll-mt-40">
          {selected === "announcement" && <AnnouncementPanel {...common} value={config.announcement} onChange={(v) => { setConfig((c) => ({ ...c, announcement: v })); clear("announcement"); }} />}
          {selected === "hero" && <HeroPanel {...common} value={config.hero} onChange={(v) => { setConfig((c) => ({ ...c, hero: v })); clear("hero"); }} />}
          {selected === "seo" && <SeoPanel value={config.seo} onChange={(v) => { setConfig((c) => ({ ...c, seo: v })); clear("seo"); }} disabled={common.disabled} data={home.data} />}
          {section && <SectionPanel key={section.key} {...common} value={section} onChange={setSection} data={home.data} blocks={blocks} />}
          <p className="mt-4 text-xs leading-relaxed text-fog-500">Step by step: <span className="text-fog-300">1 · edit</span> → <span className="text-fog-300">2 · Save home page</span> → <span className="text-fog-300">3 · Publish site</span> (top right). The public site shows the change about 2–3 minutes after publishing.</p>
        </div>
      </div>
      {confirmUi}
    </div>
  );
}

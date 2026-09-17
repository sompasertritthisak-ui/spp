"use client";
import { clsx } from "clsx";
import { parseBlocks } from "@/app/(site)/blog/_lib/markdown-lite";
import type { PageSectionsRow } from "@/lib/backend/db-types";
import { useMediaByIds } from "../../media/MediaField";
import { MediaThumb } from "../../media/MediaPicker";
import { EMBED_PROVIDERS, SECTION_KINDS, SECTION_META, validateSection, type SectionKind, type SectionProps } from "../section-kinds";

const Data = ({ children }: { children: React.ReactNode }) => <p className="t-label border border-dashed border-current/30 px-3 py-4 text-center text-[0.6875rem] opacity-70">{children}</p>;

/**
 * Structural preview of a draft page: real copy, images and order; data-backed
 * sections are shown as labelled placeholders. It is a layout check, not a
 * pixel-perfect render — the live design comes from the public site's renderer.
 */
export function PagePreview({ sections }: { sections: PageSectionsRow[] }) {
  const parsed = sections.flatMap((s) => { const kind = (SECTION_KINDS as readonly string[]).includes(s.kind) ? (s.kind as SectionKind) : null; const r = kind ? validateSection(kind, s.props) : null; return kind && r ? [{ id: s.id, kind, ok: r.ok, props: (r.ok ? r.props : {}) as Record<string, unknown> }] : []; });
  const ids = parsed.flatMap((s) => [s.props.mediaId, s.props.posterMediaId, ...(Array.isArray(s.props.mediaIds) ? s.props.mediaIds : [])]).filter((x): x is string => typeof x === "string" && x.length > 0);
  const media = useMediaByIds([...new Set(ids)]);
  const img = (id: unknown, cls: string) => { const m = typeof id === "string" ? media.get(id) : undefined; return m ? <MediaThumb media={m} className={cls} /> : null; };

  return (
    <div>
      <p className="mb-4 text-sm text-fog-400">A structural preview of the saved sections, in order. Sections marked incomplete are skipped on the live site.</p>
      <div className="border border-ink-700">
        {parsed.map((s) => {
          if (!s.ok) return <div key={s.id} className="border-b border-ink-700 bg-warn/10 p-4 text-sm text-warn">{SECTION_META[s.kind].label}: incomplete — skipped on the site.</div>;
          const paper = s.props.tone === "paper";
          const wrap = clsx("border-b border-ink-700 p-6 last:border-0", paper ? "bg-paper text-paper-ink" : "bg-ink-900 text-fog-50");
          const p = s.props;
          const heading = typeof p.heading === "string" && p.heading ? <h3 className="t-heading mb-3">{p.heading}</h3> : null;
          switch (s.kind) {
            case "hero": { const h = p as SectionProps["hero"]; return <div key={s.id} className={clsx(wrap, "grid gap-4 sm:grid-cols-[1fr_auto]")}><div>{h.eyebrow && <p className="t-label mb-2 opacity-70">{h.eyebrow}</p>}<p className="t-title">{h.title}</p>{h.lede && <p className="mt-3 max-w-prose text-sm opacity-80">{h.lede}</p>}<p className="mt-4 flex flex-wrap gap-2">{h.ctaLabel && <span className="t-label bg-yellow px-3 py-2 text-ink-950">{h.ctaLabel}</span>}{h.secondaryLabel && <span className="t-label border border-current px-3 py-2">{h.secondaryLabel}</span>}</p></div>{img(h.mediaId, "h-32 w-44")}</div>; }
            case "text": { const t = p as SectionProps["text"]; return <div key={s.id} className={wrap}>{heading}<div className={t.width === "narrow" ? "max-w-prose" : ""}>{parseBlocks(t.body).map((b, i) => b.type === "h2" ? <p key={i} className="t-heading mb-2 mt-4">{b.text}</p> : b.type === "ul" ? <ul key={i} className="mb-3 list-inside list-[square] text-sm opacity-85">{b.items.map((x, n) => <li key={n}>{x}</li>)}</ul> : <p key={i} className="mb-3 text-sm leading-relaxed opacity-85">{b.text}</p>)}</div></div>; }
            case "image": return <figure key={s.id} className={wrap}>{img(p.mediaId, "max-h-72 w-full")}{typeof p.caption === "string" && p.caption && <figcaption className="mt-2 text-xs opacity-70">{p.caption}</figcaption>}</figure>;
            case "video": return <div key={s.id} className={wrap}>{img(p.posterMediaId, "max-h-56 w-full") ?? <Data>MP4 video</Data>}{typeof p.caption === "string" && p.caption && <p className="mt-2 text-xs opacity-70">{p.caption}</p>}</div>;
            case "gallery": return <div key={s.id} className={wrap}>{heading}<div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Number(p.columns) || 3}, minmax(0, 1fr))` }}>{(p.mediaIds as string[]).map((id) => <div key={id}>{img(id, "aspect-square w-full")}</div>)}</div></div>;
            case "cta": { const c = p as SectionProps["cta"]; return <div key={s.id} className={wrap}><p className="t-title">{c.title}</p>{c.body && <p className="mt-2 max-w-prose text-sm opacity-80">{c.body}</p>}<p className="mt-4 flex flex-wrap gap-2"><span className="t-label bg-yellow px-3 py-2 text-ink-950">{c.ctaLabel}</span>{c.secondaryLabel && <span className="t-label border border-current px-3 py-2">{c.secondaryLabel}</span>}</p></div>; }
            case "embed": { const e = p as SectionProps["embed"]; return <div key={s.id} className={wrap}><Data>{EMBED_PROVIDERS[e.provider]} · {e.title} · {e.aspect} — loads after the visitor clicks</Data></div>; }
            default: return <div key={s.id} className={wrap}>{heading}<Data>{SECTION_META[s.kind].label} — filled from live {s.kind === "billboard_map" ? "billboard" : s.kind.replace("_", " ")} data at publish</Data></div>;
          }
        })}
      </div>
    </div>
  );
}

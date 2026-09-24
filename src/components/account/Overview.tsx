"use client";
import Link from "next/link";
import { useMemo } from "react";
import { ErrorNote, StatusPill } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import type { ArtworkPreflightsRow, NotificationsRow, QuotesRow } from "@/lib/backend/db-types";
import { requireBackend } from "@/lib/backend/client";
import { useQuery } from "@/lib/backend/hooks";
import { formatDate, formatLak, relativeTime } from "@/lib/format";
import { DESIGN_COLS, DesignPreview, useDesignImages, type DesignLite } from "./designs/shared";
import { canReorder, inProgress, ORDER_COLS, ORDER_STEPS, type OrderLite } from "./orders/shared";
import { usePortal } from "./PortalShell";
import { Block, internalHref, PortalEmpty, PortalHeader, RowLink, RowsSkeleton, Stepper } from "./ui";

type SentQuote = Pick<QuotesRow, "id" | "ref" | "total_lak" | "valid_until" | "sent_at">;
type Preflight = Pick<ArtworkPreflightsRow, "design_id" | "verdict" | "review_verdict" | "created_at">;
type Note = Pick<NotificationsRow, "id" | "title" | "body" | "href" | "created_at">;

type Data = { quotes: SentQuote[]; designs: DesignLite[]; preflights: Preflight[]; orders: OrderLite[]; notes: Note[] };

async function load(uid: string): Promise<Data> {
  const b = requireBackend();
  // Every table is filtered by RLS as well; the explicit owner filters keep staff accounts from seeing everyone's rows here.
  const [quotes, designs, orders, notes] = await Promise.all([
    b.from("quotes").select("id,ref,total_lak,valid_until,sent_at").eq("customer_id", uid).eq("status", "sent").order("sent_at", { ascending: false }).limit(10),
    b.from("designs").select(DESIGN_COLS).eq("owner_id", uid).neq("status", "archived").order("updated_at", { ascending: false }).limit(8),
    b.from("orders").select(ORDER_COLS).eq("customer_id", uid).order("created_at", { ascending: false }).limit(25),
    b.from("notifications").select("id,title,body,href,created_at").eq("user_id", uid).is("read_at", null).order("created_at", { ascending: false }).limit(5),
  ]);
  const failed = [quotes, designs, orders, notes].find((r) => r.error);
  if (failed?.error) throw failed.error;
  const ids = (designs.data ?? []).map((d) => d.id);
  const pre = ids.length ? await b.from("artwork_preflights").select("design_id,verdict,review_verdict,created_at").in("design_id", ids).order("created_at", { ascending: false }).limit(80) : { data: [] as Preflight[] };
  return { quotes: quotes.data ?? [], designs: (designs.data ?? []) as DesignLite[], preflights: pre.data ?? [], orders: (orders.data ?? []) as OrderLite[], notes: notes.data ?? [] };
}

export function Overview() {
  const { uid, profile } = usePortal();
  const q = useQuery<Data>(async () => {
    try { return { data: await load(uid), error: null }; } catch (e) { return { data: null, error: e }; }
  }, [uid]);
  const d = q.data;
  const imageUrl = useDesignImages(d?.designs);

  const issues = useMemo(() => {
    if (!d) return [];
    const latest = new Map<string, Preflight>();
    for (const p of d.preflights) if (!latest.has(p.design_id)) latest.set(p.design_id, p);
    return d.designs.flatMap((des) => {
      const p = latest.get(des.id);
      const verdict = p ? p.review_verdict ?? p.verdict : null;
      return verdict === "attention" || verdict === "blocked" ? [{ design: des, verdict }] : [];
    });
  }, [d]);
  const active = d?.orders.filter((o) => inProgress(o.status)) ?? [];
  const lastReorderable = d?.orders.find((o) => canReorder(o.status));
  const first = profile.full_name.trim().split(/\s+/)[0];
  const attention = (d?.quotes.length ?? 0) + issues.length;

  return (
    <>
      <PortalHeader
        glow
        title={first ? `Welcome back, ${first}.` : "Welcome back."}
        sub="Your designs, quotes and orders are already here — pick up where you left off."
      />
      <ErrorNote message={q.error} onRetry={q.reload} />

      <div className="mb-10 grid gap-3 sm:grid-cols-3">
        <Button href="/spp-studio/" size="lg" arrow className="w-full">Open SPP Studio</Button>
        <Button href="/request-quote/" size="lg" variant="outline" arrow className="w-full">Request a quote</Button>
        {lastReorderable
          ? <Button href={`/account/orders/?id=${lastReorderable.id}&reorder=1`} size="lg" variant="outline" arrow className="w-full">Reorder last order</Button>
          : <Button size="lg" variant="outline" disabled className="w-full" title="Available once an order has been fulfilled">Reorder last order</Button>}
      </div>
      {!q.loading && !lastReorderable && <p className="-mt-7 mb-10 text-sm text-fog-500">Reorder becomes available once your first order is ready or delivered.</p>}

      <Block title={<>Needs your attention{d && <> · <span className="text-gold">{attention}</span></>}</>}>
        {q.loading && !d ? <RowsSkeleton rows={2} /> : attention === 0 ? (
          <p className="border border-dashed border-gold/40 p-5 text-fog-400">Nothing is waiting on you. When SPP sends a quotation or flags artwork, it appears here first.</p>
        ) : (
          <ul>
            {d?.quotes.map((x) => (
              <li key={x.id}>
                <RowLink href={`/account/quotes/?id=${x.id}`} className="border-l-2 border-l-gold pl-3">
                  <span aria-hidden className="h-2 w-2 flex-none bg-gold" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-fog-50">Quotation ready for your decision</span>
                    <span className="t-data block truncate text-sm text-fog-400"><span className="text-gold">{x.ref}</span> · {formatLak(x.total_lak)}{x.valid_until ? ` · valid until ${formatDate(x.valid_until)}` : ""}</span>
                  </span>
                </RowLink>
              </li>
            ))}
            {issues.map(({ design, verdict }) => (
              <li key={design.id}>
                <RowLink href={`/design/?id=${design.id}`} className="border-l-2 border-l-warn pl-3">
                  <span aria-hidden className="h-2 w-2 flex-none bg-warn" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-fog-50">{verdict === "blocked" ? "Artwork needs fixing before print" : "Artwork check raised a warning"}</span>
                    <span className="t-data block truncate text-sm text-fog-400"><span className="text-gold">{design.ref}</span> · {design.name}</span>
                  </span>
                </RowLink>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="Orders in progress" action={<Link href="/account/orders/" className="t-label flex min-h-11 items-center text-fog-400 hover:text-gold">All orders</Link>}>
        {q.loading && !d ? <RowsSkeleton rows={2} tall /> : active.length === 0 ? (
          <p className="border border-dashed border-gold/40 p-5 text-fog-400">No orders in production right now. Accepted quotes become orders here, with every stage visible.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {active.slice(0, 4).map((o) => (
              <li key={o.id} className="border border-ink-700 p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <Link href={`/account/orders/?id=${o.id}`} className="t-data text-gold underline-offset-4 hover:text-fog-50 hover:underline">{o.ref}</Link>
                  <span className="flex items-center gap-3 text-sm text-fog-400">{o.due_on && <span>Due {formatDate(o.due_on)}</span>}<StatusPill status={o.status} /></span>
                </div>
                <Stepper steps={ORDER_STEPS} current={o.status} label={`Order ${o.ref}`} />
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="Recent designs" action={<Link href="/account/designs/" className="t-label flex min-h-11 items-center text-fog-400 hover:text-gold">All designs</Link>}>
        {q.loading && !d ? <div className="flex gap-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-48 w-40 flex-none" />)}</div> : d && d.designs.length === 0 ? (
          <PortalEmpty title="No designs yet." body="Design a T-shirt, polo, cap or tote in SPP Studio. Everything you save lands here, ready to quote or reorder." action={<Button href="/spp-studio/" arrow>Open SPP Studio</Button>} />
        ) : (
          <ul className="thin-scroll -mx-[var(--gutter)] flex snap-x gap-3 overflow-x-auto px-[var(--gutter)] pb-3 lg:mx-0 lg:px-0">
            {d?.designs.map((des) => (
              <li key={des.id} className="w-40 flex-none snap-start sm:w-44">
                <Link href={`/design/?id=${des.id}`} className="group block">
                  <div className="border border-ink-700 bg-ink-850 p-2 transition-colors group-hover:border-yellow"><DesignPreview design={des} imageUrl={imageUrl} className="h-auto w-full" /></div>
                  <span className="mt-2 block truncate text-sm text-fog-50">{des.name}</span>
                  <span className="t-data block truncate text-xs text-fog-500"><span className="text-gold">{des.ref}</span> · {relativeTime(des.updated_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="Unread notifications" action={<Link href="/account/notifications/" className="t-label flex min-h-11 items-center text-fog-400 hover:text-gold">All notifications</Link>}>
        {q.loading && !d ? <RowsSkeleton rows={2} /> : d && d.notes.length === 0 ? (
          <p className="border border-dashed border-gold/40 p-5 text-fog-400">You are up to date.</p>
        ) : (
          <ul>
            {d?.notes.map((n) => (
              <li key={n.id}>
                <RowLink href={internalHref(n.href)}>
                  <span className="min-w-0 flex-1"><span className="block truncate text-fog-50">{n.title}</span><span className="block truncate text-sm text-fog-400">{n.body || relativeTime(n.created_at)}</span></span>
                </RowLink>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </>
  );
}

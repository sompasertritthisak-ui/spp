// GOOGLE SHEETS BACKUP — Supabase Edge Function (Deno).
// Mirrors leads, quotes (+items), orders (+items), billboard bookings and
// consultations into a Google Sheet that SPP owns, as a running backup.
// Invoked on a schedule (GitHub Actions → this URL) with the shared CRON_SECRET.
//
// Secrets:
//   CRON_SECRET            caller sends it as  x-cron-secret
//   GOOGLE_SA_EMAIL        service-account email (…@…iam.gserviceaccount.com)
//   GOOGLE_SA_PRIVATE_KEY  the service account's PEM private key (PKCS#8, "-----BEGIN PRIVATE KEY-----")
//   SHEETS_BACKUP_ID       the spreadsheet id from its URL; share the Sheet with the SA email as Editor
//
// One tab per entity, header row created on first run, upsert by the ref in
// column A. The JWT for Google is signed here with WebCrypto (RS256) — no SDK.
// The service-role key is used only to READ business rows and to write the
// per-entity watermark in public.backup_sync. Until the three Google secrets
// exist the function answers 503 and changes nothing.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@^2";

type Cell = string | number | boolean | null;
type Row = Record<string, unknown>;
type Entity = {
  name: string; tab: string; columns: string[];
  /** Rows changed since the watermark, oldest first; `stamp` is the watermark field. */
  fetch: (db: SupabaseClient, since: string, limit: number) => Promise<{ rows: Row[]; error: string | null }>;
  stamp: (r: Row) => string;
  map: (r: Row) => Cell[];
};

const LIMIT = 400; // rows per entity per run; the watermark makes the next run continue
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";

const s = (v: unknown): Cell => (v == null ? null : typeof v === "object" ? JSON.stringify(v) : typeof v === "number" || typeof v === "boolean" ? v : String(v));
const n = (v: unknown): Cell => (v == null || v === "" ? null : Number(v));
const contact = (j: unknown) => { const c = (j && typeof j === "object" && !Array.isArray(j) ? j : {}) as Record<string, unknown>; return [s(c.name), s(c.company), s(c.email), s(c.phone), s(c.social)]; };
const cfg = (c: unknown) => {
  if (!c || typeof c !== "object" || Array.isArray(c)) return null;
  return Object.entries(c as Record<string, unknown>).flatMap(([k, v]) => (v == null || v === "" || (Array.isArray(v) && !v.length) ? [] : [`${k} ${Array.isArray(v) ? v.join(" + ") : typeof v === "object" ? JSON.stringify(v) : String(v)}`])).join(" · ") || null;
};
const wrap = (p: PromiseLike<{ data: unknown; error: { message: string } | null }>) => p.then((r) => ({ rows: (r.data ?? []) as Row[], error: r.error?.message ?? null }));
/** Line items carry no timestamp: take the parents changed since the watermark (oldest first), then all their lines, each tagged with its parent. */
async function lines(db: SupabaseClient, parent: "quotes" | "orders", child: string, fk: string, since: string, limit: number) {
  const p = await db.from(parent).select("id,ref,updated_at").gt("updated_at", since).order("updated_at").limit(Math.max(1, Math.floor(limit / 8)));
  if (p.error) return { rows: [], error: p.error.message };
  const parents = (p.data ?? []) as { id: string; ref: string; updated_at: string }[];
  if (!parents.length) return { rows: [], error: null };
  const c = await db.from(child).select("*").in(fk, parents.map((x) => x.id)).order("sort");
  if (c.error) return { rows: [], error: c.error.message };
  const byId = new Map(parents.map((x) => [x.id, x]));
  return { rows: ((c.data ?? []) as Row[]).map((r) => ({ ...r, [parent]: byId.get(String(r[fk])) })), error: null };
}

const CONTACT = ["Name", "Company", "Email", "Phone", "Social"];
const ENTITIES: Entity[] = [
  {
    name: "leads", tab: "Leads", columns: ["Ref", "Status", "Source", "Source detail", ...CONTACT, "Interest", "Message", "Est. value LAK", "Priority", "Follow up", "Consent", "Created", "Updated", "Lost reason"],
    fetch: (db, since, limit) => wrap(db.from("leads").select("*").gt("updated_at", since).order("updated_at").limit(limit)),
    stamp: (r) => String(r.updated_at),
    map: (r) => [s(r.ref), s(r.status), s(r.source), s(r.source_detail), s(r.name), s(r.company_name), s(r.email), s(r.phone), s(r.social_contact), Array.isArray(r.product_interest) ? r.product_interest.join(", ") : null, s(r.message), n(r.estimated_value_lak), s(r.priority), s(r.follow_up_on), Boolean(r.marketing_consent), s(r.created_at), s(r.updated_at), s(r.lost_reason)],
  },
  {
    name: "quotes", tab: "Quotes", columns: ["Ref", "Status", "Kind", ...CONTACT, "Needed by", "Design help", "Estimate low LAK", "Estimate high LAK", "Quoted total LAK", "Valid until", "Terms", "Customer notes", "Sent", "Decided", "Created", "Updated"],
    fetch: (db, since, limit) => wrap(db.from("quotes").select("*").gt("updated_at", since).order("updated_at").limit(limit)),
    stamp: (r) => String(r.updated_at),
    map: (r) => [s(r.ref), s(r.status), s(r.kind), ...contact(r.contact), s(r.needed_by), Boolean(r.needs_design_help), n(r.estimate_low_lak), n(r.estimate_high_lak), n(r.total_lak), s(r.valid_until), s(r.terms), s(r.customer_notes), s(r.sent_at), s(r.decided_at), s(r.created_at), s(r.updated_at)],
  },
  {
    // Items have no timestamp of their own: they ride on the parent quote's updated_at (pricing saves touch the header too).
    name: "quote_items", tab: "Quote lines", columns: ["Line id", "Quote", "Product", "Specification", "Qty", "Unit LAK", "Line total LAK", "Note", "Design id", "Design version", "Quote updated"],
    fetch: (db, since, limit) => lines(db, "quotes", "quote_items", "quote_id", since, limit),
    stamp: (r) => String((r.quotes as Row).updated_at),
    map: (r) => [s(r.id), s((r.quotes as Row).ref), s(r.product_name), cfg(r.config), n(r.qty), n(r.unit_price_lak), n(r.line_total_lak), s(r.note), s(r.design_id), n(r.design_version), s((r.quotes as Row).updated_at)],
  },
  {
    name: "orders", tab: "Orders", columns: ["Ref", "Status", "Payment", ...CONTACT, "Total LAK", "Due", "Delivery", "Address", "Customer confirmed", "Completed", "Reorder of", "Created", "Updated"],
    fetch: (db, since, limit) => wrap(db.from("orders").select("*").gt("updated_at", since).order("updated_at").limit(limit)),
    stamp: (r) => String(r.updated_at),
    map: (r) => [s(r.ref), s(r.status), s(r.payment_status), ...contact(r.contact), n(r.total_lak), s(r.due_on), s(r.delivery_method), s(r.delivery_address), s(r.customer_confirmed_at), s(r.completed_at), s(r.reorder_of), s(r.created_at), s(r.updated_at)],
  },
  {
    name: "order_items", tab: "Order lines", columns: ["Line id", "Order", "Product", "Specification", "Qty", "Unit LAK", "Line total LAK", "Design id", "Design version", "Order updated"],
    fetch: (db, since, limit) => lines(db, "orders", "order_items", "order_id", since, limit),
    stamp: (r) => String((r.orders as Row).updated_at),
    map: (r) => [s(r.id), s((r.orders as Row).ref), s(r.product_name), cfg(r.config), n(r.qty), n(r.unit_price_lak), n(r.line_total_lak), s(r.design_id), n(r.design_version), s((r.orders as Row).updated_at)],
  },
  {
    name: "billboard_bookings", tab: "Billboard requests", columns: ["Ref", "Status", "Billboard", ...CONTACT, "Starts", "Ends", "Needs design", "Needs print/install", "Notes", "Quoted USD", "Created", "Updated"],
    fetch: (db, since, limit) => wrap(db.from("billboard_bookings").select("*,billboards(name)").gt("updated_at", since).order("updated_at").limit(limit)),
    stamp: (r) => String(r.updated_at),
    map: (r) => [s(r.ref), s(r.status), s((r.billboards as Row | null)?.name ?? r.billboard_id), ...contact(r.contact), s(r.starts_on), s(r.ends_on), Boolean(r.needs_design), Boolean(r.needs_print_install), s(r.notes), n(r.quoted_usd), s(r.created_at), s(r.updated_at)],
  },
  {
    name: "consultations", tab: "Consultations", columns: ["Ref", "Status", "Name", "Company", "Email", "Phone", "Topic", "Goal", "Minutes", "Preferred", "Alternative", "Confirmed", "Channel", "Info", "Created", "Updated"],
    fetch: (db, since, limit) => wrap(db.from("consultations").select("*").gt("updated_at", since).order("updated_at").limit(limit)),
    stamp: (r) => String(r.updated_at),
    map: (r) => [s(r.ref), s(r.status), s(r.name), s(r.company_name), s(r.email), s(r.phone), s(r.topic), s(r.goal), n(r.duration_mins), s(r.preferred_at), s(r.alternative_at), s(r.confirmed_at), s(r.channel), s(r.info), s(r.created_at), s(r.updated_at)],
  },
];

/* ── Google auth: service-account JWT → access token (RS256 via WebCrypto) ── */
const b64url = (buf: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof buf === "string" ? new TextEncoder().encode(buf) : buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/\\n/g, "\n").replace(/-----(BEGIN|END) [A-Z ]*PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function accessToken(email: string, pem: string): Promise<string> {
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(pem), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`));
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claims}.${b64url(sig)}` }) });
  if (!res.ok) throw new Error(`Google token ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

/* ── Sheets API ─────────────────────────────────────────────────────────── */
class Sheets {
  constructor(private id: string, private token: string) {}
  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${SHEETS}/${this.id}${path}`, { ...init, headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
    if (!res.ok) throw new Error(`Sheets ${res.status} ${path.split("?")[0]}: ${(await res.text()).slice(0, 300)}`);
    return (await res.json()) as T;
  }
  async tabs(): Promise<string[]> {
    const meta = await this.call<{ sheets: { properties: { title: string } }[] }>("?fields=sheets.properties.title");
    return meta.sheets.map((x) => x.properties.title);
  }
  addTabs(titles: string[]) { return titles.length ? this.call("/:batchUpdate", { method: "POST", body: JSON.stringify({ requests: titles.map((t) => ({ addSheet: { properties: { title: t, gridProperties: { frozenRowCount: 1 } } } })) }) }) : Promise.resolve(); }
  async column(tab: string): Promise<string[]> {
    const r = await this.call<{ values?: string[][] }>(`/values/${encodeURIComponent(`'${tab}'!A:A`)}?majorDimension=COLUMNS`);
    return r.values?.[0] ?? [];
  }
  update(data: { range: string; values: Cell[][] }[]) { return data.length ? this.call("/values:batchUpdate", { method: "POST", body: JSON.stringify({ valueInputOption: "RAW", data }) }) : Promise.resolve(); }
  append(tab: string, values: Cell[][]) { return values.length ? this.call(`/values/${encodeURIComponent(`'${tab}'!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: "POST", body: JSON.stringify({ values }) }) : Promise.resolve(); }
}

/** Upsert rows into one tab keyed on column A. Returns how many rows were written. */
async function syncTab(sh: Sheets, e: Entity, rows: Row[]): Promise<number> {
  const col = await sh.column(e.tab);
  const updates: { range: string; values: Cell[][] }[] = [];
  if (col[0] !== e.columns[0]) updates.push({ range: `'${e.tab}'!A1`, values: [e.columns] });
  const index = new Map<string, number>();
  col.forEach((v, i) => { if (i > 0 && v) index.set(v, i + 1); });
  const fresh: Cell[][] = [];
  let next = Math.max(col.length, 1) + 1;
  for (const r of rows) {
    const values = e.map(r);
    const key = String(values[0] ?? "");
    const at = index.get(key);
    if (at) updates.push({ range: `'${e.tab}'!A${at}`, values: [values] });
    else { fresh.push(values); index.set(key, next++); }
  }
  await sh.update(updates);
  await sh.append(e.tab, fresh);
  return rows.length;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return new Response("forbidden", { status: 403 });
  const email = Deno.env.get("GOOGLE_SA_EMAIL"), pem = Deno.env.get("GOOGLE_SA_PRIVATE_KEY"), sheetId = Deno.env.get("SHEETS_BACKUP_ID");
  if (!email || !pem || !sheetId) return Response.json({ error: "Google Sheets backup is not configured. Set GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY and SHEETS_BACKUP_ID (docs/DEPLOY.md → Google Sheets backup)." }, { status: 503 });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const startedAt = new Date().toISOString();
  let sh: Sheets;
  try {
    sh = new Sheets(sheetId, await accessToken(email, pem));
    const have = new Set(await sh.tabs());
    await sh.addTabs(ENTITIES.map((e) => e.tab).filter((t) => !have.has(t)));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("sheets-backup auth/setup", msg);
    await db.from("backup_sync").upsert(ENTITIES.map((e) => ({ entity: e.name, last_run_at: startedAt, last_error: msg.slice(0, 500) })));
    return Response.json({ error: "Could not reach Google Sheets. Check the service account, its key and that the Sheet is shared with it." }, { status: 502 });
  }

  const { data: marks } = await db.from("backup_sync").select("entity,last_synced_at");
  const since = new Map(((marks ?? []) as { entity: string; last_synced_at: string }[]).map((m) => [m.entity, m.last_synced_at]));
  const report: Record<string, { synced: number; error?: string }> = {};
  for (const e of ENTITIES) {
    const from = since.get(e.name) ?? "1970-01-01T00:00:00Z";
    try {
      const { rows, error } = await e.fetch(db, from, LIMIT);
      if (error) throw new Error(error);
      const count = rows.length ? await syncTab(sh, e, rows) : 0;
      // Watermark = newest stamp we actually wrote, so a partial page is picked up next time.
      const mark = rows.reduce((m, r) => (e.stamp(r) > m ? e.stamp(r) : m), from);
      await db.from("backup_sync").upsert({ entity: e.name, last_synced_at: mark, last_run_at: startedAt, rows_synced: count, last_error: null });
      report[e.name] = { synced: count };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`sheets-backup ${e.name}`, msg);
      await db.from("backup_sync").upsert({ entity: e.name, last_run_at: startedAt, last_error: msg.slice(0, 500) });
      report[e.name] = { synced: 0, error: "sync failed — see function logs" };
    }
  }
  return Response.json({ at: startedAt, entities: report });
});

/**
 * Database audit. Boots a throw-away PostgreSQL, stubs the parts of Supabase
 * the migrations depend on (auth schema, anon/authenticated roles), applies
 * every migration + the seed, then attacks the result.
 *
 *   npm run db:test
 *
 * Each check connects the way PostgREST does: as the `anon` or `authenticated`
 * role with request.jwt.claims set — so RLS is genuinely in force.
 */
import EmbeddedPostgres from "embedded-postgres";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";

const root = new URL("..", import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), "spp-pg-"));
const port = 54329;
const server = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port, persistent: false, onLog: () => {}, onError: () => {} });

const SUPABASE_STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'sub', '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
`;
// What Supabase grants by default on the public schema. RLS is the real gate.
const SUPABASE_GRANTS = `
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage on all sequences in schema public to anon, authenticated;
`;

type Who = { sub: string | null };
let admin: pg.Client;
let passed = 0;
const failures: string[] = [];

async function as<T>(who: Who, fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ host: "localhost", port, user: "postgres", password: "postgres", database: "spp" });
  await c.connect();
  try {
    await c.query("begin");
    await c.query(`select set_config('request.jwt.claims', $1, true), set_config('request.headers', $2, true)`, [
      JSON.stringify(who.sub ? { sub: who.sub, role: "authenticated" } : { role: "anon" }),
      JSON.stringify({ "x-forwarded-for": `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` }),
    ]);
    await c.query(`set local role ${who.sub ? "authenticated" : "anon"}`);
    const r = await fn(c);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
}

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(`${name} — ${(e as Error).message}`);
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}
const eq = (a: unknown, b: unknown, msg = "") => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (v: unknown, msg: string) => {
  if (!v) throw new Error(msg);
};
async function denied(p: Promise<unknown>, pattern: RegExp, msg: string) {
  try {
    await p;
  } catch (e) {
    if (pattern.test((e as Error).message)) return;
    throw new Error(`${msg}: wrong error "${(e as Error).message}"`);
  }
  throw new Error(`${msg}: was ALLOWED`);
}

async function mkUser(email: string, role?: string) {
  const { rows } = await admin.query(`insert into auth.users(email, raw_user_meta_data) values ($1, '{"full_name":"Test"}') returning id`, [email]);
  const id = rows[0].id as string;
  if (role) {
    await admin.query(`select set_config('spp.privileged','on',false)`);
    await admin.query(`update profiles set role = $2 where id = $1`, [id, role]);
    await admin.query(`select set_config('spp.privileged','',false)`);
  }
  return { sub: id };
}

async function main() {
  console.log("Booting PostgreSQL…");
  await server.initialise();
  await server.start();
  await server.createDatabase("spp");
  admin = new pg.Client({ host: "localhost", port, user: "postgres", password: "postgres", database: "spp" });
  admin.on("error", () => {}); // server shutdown closes this socket; not a test failure
  await admin.connect();
  const ver = (await admin.query("show server_version")).rows[0].server_version;
  console.log(`PostgreSQL ${ver}\n\nMIGRATIONS`);

  await admin.query(`create extension if not exists pgcrypto`);
  await admin.query(SUPABASE_STUB);
  const files = readdirSync(join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (f.includes("storage")) {
      console.log(`  – ${f} (needs Supabase Storage; skipped locally)`);
      continue;
    }
    await check(`apply ${f}`, async () => void (await admin.query(readFileSync(join(root, "supabase/migrations", f), "utf8"))));
  }
  await admin.query(SUPABASE_GRANTS);
  await check("apply seed.sql", async () => void (await admin.query(readFileSync(join(root, "supabase/seed.sql"), "utf8"))));
  await check("seed.sql is idempotent (second run)", async () => void (await admin.query(readFileSync(join(root, "supabase/seed.sql"), "utf8"))));
  if (failures.length) throw new Error("migrations failed");

  const anon: Who = { sub: null };
  const alice = await mkUser("alice@example.com");
  const bob = await mkUser("bob@example.com");
  const sales = await mkUser("sales@spp.test", "sales");
  const designer = await mkUser("designer@spp.test", "designer");
  const production = await mkUser("production@spp.test", "production");
  const marketing = await mkUser("marketing@spp.test", "marketing");
  const adminU = await mkUser("admin@spp.test", "admin");
  const superU = await mkUser("super@spp.test", "super_admin");

  console.log("\nSCHEMA HYGIENE");
  await check("every public table has RLS enabled", async () => {
    const { rows } = await admin.query(`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    eq(rows.map((r) => r.relname), [], "tables without RLS:");
  });
  await check("every SECURITY DEFINER function pins search_path", async () => {
    const { rows } = await admin.query(`select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`);
    eq(rows.map((r) => r.proname), [], "unpinned:");
  });
  await check("internal helpers are not callable by anon/authenticated", async () => {
    for (const fn of ["next_ref('x')", "rate_limit('x',1,'1 minute')", "notify_staff('sales','k','t','b','/')", "queue_email('a@b.co','t','s','{}')"]) {
      await denied(as(alice, (c) => c.query(`select ${fn}`)), /permission denied/, fn);
      await denied(as(anon, (c) => c.query(`select ${fn}`)), /permission denied/, fn);
    }
  });

  console.log("\nPUBLIC CONTENT");
  await check("anon reads published products, not drafts", async () => {
    await admin.query(`update products set status = 'draft' where slug = 'umbrella'`);
    const n = await as(anon, (c) => c.query(`select count(*)::int n, count(*) filter (where slug = 'umbrella')::int d from products`));
    ok(n.rows[0].n >= 15, "published products visible");
    eq(n.rows[0].d, 0, "draft leaked:");
    await admin.query(`update products set status = 'published' where slug = 'umbrella'`);
  });
  await check("anon CANNOT read pricing rules", async () => eq((await as(anon, (c) => c.query(`select count(*)::int n from pricing_rules`))).rows[0].n, 0));
  await check("customer CANNOT read pricing rules", async () => eq((await as(alice, (c) => c.query(`select count(*)::int n from pricing_rules`))).rows[0].n, 0));
  await check("designer CANNOT read pricing rules (financial)", async () => eq((await as(designer, (c) => c.query(`select count(*)::int n from pricing_rules`))).rows[0].n, 0));
  await check("anon cannot write content", async () => {
    const r = await as(anon, (c) => c.query(`update products set name = 'pwned' where slug = 'polo-shirt'`));
    eq(r.rowCount, 0);
    await denied(as(anon, (c) => c.query(`insert into faqs(q,a) values ('x','y')`)), /row-level security/, "faq insert");
  });
  await check("anon reads only public settings", async () => {
    await admin.query(`insert into settings(key, value, is_public) values ('internal', '{"secret":1}', false) on conflict do nothing`);
    eq((await as(anon, (c) => c.query(`select key from settings order by key`))).rows.map((r) => r.key), ["site"]);
  });
  await check("testimonial cannot be published without recorded consent", async () => {
    await denied(admin.query(`insert into testimonials(quote,name,status) values ('Great','A','published')`), /check constraint/, "consent");
  });

  console.log("\nPRICING ENGINE");
  await check("estimate returns a band, volume lowers the unit price, no rule amounts leak", async () => {
    const a = (await as(anon, (c) => c.query(`select estimate_price('polo-shirt', 12) e`))).rows[0].e;
    const b = (await as(anon, (c) => c.query(`select estimate_price('polo-shirt', 500) e`))).rows[0].e;
    eq(a.mode, "estimated");
    ok(a.unitLow < a.unitHigh, "band");
    ok(b.unitHigh < a.unitLow, `500 pcs (${b.unitHigh}) should undercut 12 pcs (${a.unitLow})`);
    ok(!JSON.stringify(b).match(/percent|amount|seed:/), "leaked rule internals");
  });
  await check("quote-only products return no figure", async () => eq((await as(anon, (c) => c.query(`select estimate_price('led-signage', 1) e`))).rows[0].e.mode, "quote"));
  await check("extra locations + embroidery + rush raise the price", async () => {
    const base = (await as(anon, (c) => c.query(`select estimate_price('polo-shirt', 100) e`))).rows[0].e;
    const soon = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
    const up = (await as(anon, (c) => c.query(`select estimate_price('polo-shirt', 100, $1) e`, [JSON.stringify({ method: "embroidery", locations: ["front", "back", "left-sleeve"], neededBy: soon })]))).rows[0].e;
    ok(up.unitLow > base.unitHigh, `${up.unitLow} vs ${base.unitHigh}`);
    ok(up.lines.some((l: { label: string }) => l.label === "Rush production"), "rush line");
  });
  await check("ONLINE_PRICING flag off hides every figure", async () => {
    await admin.query(`update feature_flags set enabled = false where key = 'ONLINE_PRICING'`);
    eq((await as(anon, (c) => c.query(`select estimate_price('polo-shirt', 100) e`))).rows[0].e.mode, "quote");
    await admin.query(`update feature_flags set enabled = true where key = 'ONLINE_PRICING'`);
  });

  console.log("\nDESIGNS · customer isolation");
  let aliceDesign = "", aliceRef = "";
  await check("customer creates a design; server assigns the ref (client value ignored)", async () => {
    const r = await as(alice, (c) => c.query(`insert into designs(ref, owner_id, product_slug, garment, sides, status) values ('SPP-DESIGN-HACK', $1, 'polo-shirt', 'polo', '{"front":[]}', 'approved') returning id, ref, status, version`, [alice.sub]));
    aliceDesign = r.rows[0].id; aliceRef = r.rows[0].ref;
    ok(/^SPP-DESIGN-\d{4}-\d{5}$/.test(aliceRef), aliceRef);
    eq(r.rows[0].status, "draft", "self-approved on insert:");
  });
  await check("cannot create a design owned by someone else", async () =>
    denied(as(alice, (c) => c.query(`insert into designs(ref, owner_id, product_slug, garment) values ('x', $1, 'polo-shirt', 'polo')`, [bob.sub])), /row-level security/, "forged owner"));
  await check("IDOR: Bob cannot read, update or delete Alice's design", async () => {
    eq((await as(bob, (c) => c.query(`select id from designs where id = $1`, [aliceDesign]))).rowCount, 0, "read");
    eq((await as(bob, (c) => c.query(`update designs set name = 'x' where id = $1`, [aliceDesign]))).rowCount, 0, "update");
    eq((await as(bob, (c) => c.query(`delete from designs where id = $1`, [aliceDesign]))).rowCount, 0, "delete");
    eq((await as(anon, (c) => c.query(`select id from designs`))).rowCount, 0, "anon read");
  });
  await check("customer cannot self-approve artwork or transfer ownership", async () => {
    await denied(as(alice, (c) => c.query(`update designs set status = 'approved' where id = $1`, [aliceDesign])), /only SPP can approve/, "self-approve");
    await denied(as(alice, (c) => c.query(`update designs set owner_id = $2 where id = $1`, [aliceDesign, bob.sub])), /row-level security|protected/, "transfer");
  });
  await check("editing a design bumps the version and snapshots history", async () => {
    await as(alice, (c) => c.query(`update designs set sides = '{"front":[{"type":"text","text":"hi"}]}' where id = $1`, [aliceDesign]));
    const r = await as(alice, (c) => c.query(`select version, (select count(*)::int from design_versions where design_id = d.id) n from designs d where id = $1`, [aliceDesign]));
    eq([r.rows[0].version, r.rows[0].n], [2, 2]);
  });
  await check("share link: unguessable token, exposes design but not the owner", async () => {
    const tok = (await as(alice, (c) => c.query(`select set_design_sharing($1, true) t`, [aliceDesign]))).rows[0].t as string;
    eq(tok.length, 36);
    const d = (await as(anon, (c) => c.query(`select get_shared_design($1) d`, [tok]))).rows[0].d;
    eq(d.ref, aliceRef);
    ok(!("owner_id" in d) && !("ownerId" in d), "owner leaked");
    eq((await as(anon, (c) => c.query(`select get_shared_design('nope') d`))).rows[0].d, null);
    await denied(as(bob, (c) => c.query(`select set_design_sharing($1, true)`, [aliceDesign])), /not found/, "bob shares alice's");
  });
  await check("designer can see customer designs; production can read; marketing cannot", async () => {
    eq((await as(designer, (c) => c.query(`select id from designs where id = $1`, [aliceDesign]))).rowCount, 1);
    eq((await as(production, (c) => c.query(`select id from designs where id = $1`, [aliceDesign]))).rowCount, 1);
    eq((await as(marketing, (c) => c.query(`select id from designs where id = $1`, [aliceDesign]))).rowCount, 0);
  });

  console.log("\nQUOTE → LEAD → ORDER → PRODUCTION → QC  (traceability)");
  let quoteRef = "", quoteId = "", orderId = "";
  const contact = { name: "Alice Tester", company: "Riverside Café", email: "alice@example.com", phone: "+856 20 5555 0101" };
  await check("submit_quote validates input", async () => {
    await denied(as(anon, (c) => c.query(`select submit_quote($1)`, [JSON.stringify({ contact: { name: "A" }, items: [{ product: "polo-shirt", qty: 10 }] })])), /your name/, "short name");
    await denied(as(anon, (c) => c.query(`select submit_quote($1)`, [JSON.stringify({ contact: { name: "Al" }, items: [{ product: "polo-shirt", qty: 10 }] })])), /one way to reach/, "no contact");
    await denied(as(anon, (c) => c.query(`select submit_quote($1)`, [JSON.stringify({ contact: { ...contact, email: "nope" }, items: [{ product: "polo-shirt", qty: 10 }] })])), /email/, "bad email");
    await denied(as(anon, (c) => c.query(`select submit_quote($1)`, [JSON.stringify({ contact, items: [] })])), /at least one item/, "no items");
    await denied(as(anon, (c) => c.query(`select submit_quote($1)`, [JSON.stringify({ contact, items: [{ product: "nope", qty: 1 }] })])), /no longer available/, "bad product");
    await denied(as(anon, (c) => c.query(`select submit_quote($1)`, [JSON.stringify({ contact, website: "http://spam", items: [{ product: "polo-shirt", qty: 1 }] })])), /Rejected/, "honeypot");
  });
  await check("IDOR: Bob cannot attach Alice's design to his quote", async () =>
    denied(as(bob, (c) => c.query(`select submit_quote($1)`, [JSON.stringify({ contact, items: [{ product: "polo-shirt", qty: 50, designRef: aliceRef }] })])), /could not be found on your account/, "foreign design"));
  await check("Alice submits a quote with her design → quote + lead + estimate created atomically", async () => {
    const r = (await as(alice, (c) => c.query(`select submit_quote($1) r`, [JSON.stringify({ contact, neededBy: "2027-03-01", notes: "Front + back", items: [{ product: "polo-shirt", qty: 250, designRef: aliceRef, config: { colour: "Navy", method: "embroidery", locations: ["front", "back"] } }] })]))).rows[0].r;
    quoteRef = r.ref;
    ok(/^SPP-QUOTE-/.test(r.ref) && /^SPP-LEAD-/.test(r.leadRef), JSON.stringify(r));
    ok(r.estimateLow > 0 && r.estimateHigh > r.estimateLow, "estimate band");
    const q = (await admin.query(`select q.id, q.lead_id, l.status, l.source, (select design_id from quote_items where quote_id = q.id) d, (select status from designs where id = $2) ds from quotes q join leads l on l.id = q.lead_id where q.ref = $1`, [quoteRef, aliceDesign])).rows[0];
    quoteId = q.id;
    eq([q.status, q.source, q.d, q.ds], ["quote", "quote", aliceDesign, "submitted"]);
  });
  await check("staff are notified and a branded email is queued", async () => {
    ok((await as(sales, (c) => c.query(`select 1 from notifications where kind = 'quote_new'`))).rowCount! >= 1, "notification");
    ok((await admin.query(`select 1 from email_outbox where template = 'quote_submitted' and to_email = 'alice@example.com'`)).rowCount! >= 1, "email");
    eq((await as(alice, (c) => c.query(`select 1 from email_outbox`))).rowCount, 0, "customer can read outbox");
  });
  await check("customer sees own quote; Bob and anon do not; nobody but staff sees leads", async () => {
    eq((await as(alice, (c) => c.query(`select ref from quotes`))).rows.map((r) => r.ref), [quoteRef]);
    eq((await as(bob, (c) => c.query(`select ref from quotes`))).rowCount, 0);
    eq((await as(anon, (c) => c.query(`select ref from quotes`))).rowCount, 0);
    eq((await as(alice, (c) => c.query(`select 1 from leads`))).rowCount, 0, "customer read leads");
    eq((await as(production, (c) => c.query(`select 1 from leads`))).rowCount, 0, "production read leads");
    ok((await as(sales, (c) => c.query(`select 1 from leads`))).rowCount! >= 1, "sales read leads");
  });
  await check("customer cannot edit a quote's price or status directly", async () => {
    eq((await as(alice, (c) => c.query(`update quotes set total_lak = 1, status = 'accepted' where id = $1`, [quoteId]))).rowCount, 0);
    eq((await as(alice, (c) => c.query(`update quote_items set unit_price_lak = 1 where quote_id = $1`, [quoteId]))).rowCount, 0);
  });
  await check("internal notes are invisible to customers", async () => {
    await as(sales, (c) => c.query(`insert into internal_notes(entity, entity_id, body, author) values ('quote', $1, 'Margin is thin — do not discount', $2)`, [quoteId, sales.sub]));
    eq((await as(alice, (c) => c.query(`select 1 from internal_notes`))).rowCount, 0);
    await denied(as(alice, (c) => c.query(`insert into internal_notes(entity, entity_id, body, author) values ('quote', $1, 'x', $2)`, [quoteId, alice.sub])), /row-level security/, "customer wrote note");
  });
  await check("order cannot be created until every line is priced; customers cannot convert", async () => {
    await denied(as(alice, (c) => c.query(`select convert_quote_to_order($1)`, [quoteId])), /forbidden/, "customer convert");
    await as(sales, (c) => c.query(`update quotes set status = 'sent', total_lak = 27500000, valid_until = current_date + 14 where id = $1`, [quoteId]));
    await denied(as(sales, (c) => c.query(`select convert_quote_to_order($1)`, [quoteId])), /Price every line/, "unpriced");
  });
  await check("customer accepts; Bob cannot respond to Alice's quote", async () => {
    await denied(as(bob, (c) => c.query(`select respond_to_quote($1, true)`, [quoteId])), /not found/, "bob accepts");
    eq((await as(alice, (c) => c.query(`select respond_to_quote($1, true) r`, [quoteId]))).rows[0].r.status, "accepted");
  });
  await check("sales converts quote → order; lead marked won; duplicate conversion blocked", async () => {
    await as(sales, (c) => c.query(`update quote_items set unit_price_lak = 110000 where quote_id = $1`, [quoteId]));
    const r = (await as(sales, (c) => c.query(`select convert_quote_to_order($1) r`, [quoteId]))).rows[0].r;
    orderId = r.orderId;
    ok(/^SPP-ORDER-/.test(r.ref), r.ref);
    eq((await admin.query(`select l.status from leads l join quotes q on q.lead_id = l.id where q.id = $1`, [quoteId])).rows[0].status, "won");
    await denied(as(sales, (c) => c.query(`select convert_quote_to_order($1)`, [quoteId])), /already has an order/, "dup");
  });
  await check("artwork gate: cannot release to production until SPP approves the design", async () => {
    await denied(as(production, (c) => c.query(`select release_to_production($1)`, [orderId])), /Approve the artwork/, "gate");
    await as(designer, (c) => c.query(`update designs set status = 'approved' where id = $1`, [aliceDesign]));
    eq((await as(production, (c) => c.query(`select release_to_production($1) n`, [orderId]))).rows[0].n, 1);
  });
  await check("QC pass completes the job, readies the order and opens a delivery", async () => {
    const job = (await as(production, (c) => c.query(`select id from production_jobs where order_id = $1`, [orderId]))).rows[0].id;
    await denied(as(sales, (c) => c.query(`select record_qc($1, '[]', 'pass')`, [job])), /forbidden/, "sales ran QC");
    await as(production, (c) => c.query(`select record_qc($1, $2, 'pass', 'All good')`, [job, JSON.stringify([{ key: "quantity", label: "Quantity verified", ok: true }])]));
    const o = (await admin.query(`select status, (select count(*)::int from deliveries where order_id = o.id) d from orders o where id = $1`, [orderId])).rows[0];
    eq([o.status, o.d], ["ready", 1]);
    eq((await as(alice, (c) => c.query(`select 1 from production_jobs`))).rowCount, 0, "customer saw production jobs");
    eq((await as(alice, (c) => c.query(`select 1 from quality_checks`))).rowCount, 0, "customer saw QC");
  });
  await check("full chain is traceable from the production job back to the original lead", async () => {
    const r = (await admin.query(`select l.ref lead, q.ref quote, o.ref ord, j.ref job, d.ref design from production_jobs j join orders o on o.id = j.order_id join quotes q on q.id = o.quote_id join leads l on l.id = o.lead_id join designs d on d.id = j.design_id where o.id = $1`, [orderId])).rows[0];
    ok(r.lead && r.quote && r.ord && r.job && r.design === aliceRef, JSON.stringify(r));
  });
  await check("reorder: owner only, quantities adjustable, links back to the order", async () => {
    await admin.query(`update orders set status = 'completed' where id = $1`, [orderId]);
    await denied(as(bob, (c) => c.query(`select request_reorder($1)`, [orderId])), /not found/, "bob reorders");
    const item = (await admin.query(`select id from order_items where order_id = $1`, [orderId])).rows[0].id;
    const r = (await as(alice, (c) => c.query(`select request_reorder($1, $2) r`, [orderId, JSON.stringify({ [item]: 400 })]))).rows[0].r;
    const q = (await admin.query(`select kind, reorder_of, (select qty from quote_items where quote_id = quotes.id) qty, (select design_id from quote_items where quote_id = quotes.id) d from quotes where ref = $1`, [r.ref])).rows[0];
    eq([q.kind, q.reorder_of, q.qty, q.d], ["reorder", orderId, 400, aliceDesign]);
  });

  console.log("\nCUSTOMER PORTAL (0014)");
  await check("messages: a customer writes only on their own records; Bob cannot post on Alice's quote", async () => {
    await as(alice, (c) => c.query(`insert into messages(entity, entity_id, customer_id, sender, from_staff, body) values ('quote', $1, $2, $2, false, 'Can we do 300 instead?')`, [quoteId, alice.sub]));
    await denied(as(bob, (c) => c.query(`insert into messages(entity, entity_id, customer_id, sender, from_staff, body) values ('quote', $1, $2, $2, false, 'spoof')`, [quoteId, bob.sub])), /row-level security/, "bob posted on alice's quote");
    await denied(as(alice, (c) => c.query(`insert into messages(entity, entity_id, customer_id, sender, from_staff, body) values ('quote', $1, $2, $2, true, 'pretending to be SPP')`, [quoteId, alice.sub])), /row-level security/, "customer forged a staff message");
    await as(sales, (c) => c.query(`insert into messages(entity, entity_id, customer_id, sender, from_staff, body) values ('quote', $1, $2, $3, true, 'Yes — revised quote on its way.')`, [quoteId, alice.sub, sales.sub]));
    eq((await as(alice, (c) => c.query(`select count(*)::int n from messages where entity = 'quote' and entity_id = $1`, [quoteId]))).rows[0].n, 2);
    eq((await as(bob, (c) => c.query(`select 1 from messages`))).rowCount, 0, "bob read alice's thread");
  });
  await check("attachments: customer sees files SPP shares on their order, never internal ones; uploads only into own folder on own records", async () => {
    await as(sales, (c) => c.query(`insert into attachments(entity, entity_id, owner_id, path, file_name, mime, bytes, internal) values ('order', $1, $2, $3, 'proof.pdf', 'application/pdf', 10, false), ('order', $1, $2, $4, 'costing.pdf', 'application/pdf', 10, true)`, [orderId, sales.sub, `${sales.sub}/proof.pdf`, `${sales.sub}/costing.pdf`]));
    eq((await as(alice, (c) => c.query(`select file_name from attachments where entity = 'order' and entity_id = $1`, [orderId]))).rows.map((r) => r.file_name), ["proof.pdf"]);
    eq((await as(bob, (c) => c.query(`select 1 from attachments`))).rowCount, 0, "bob saw alice's files");
    await as(alice, (c) => c.query(`insert into attachments(entity, entity_id, owner_id, path, file_name, mime, bytes) values ('order', $1, $2, $3, 'logo.png', 'image/png', 10)`, [orderId, alice.sub, `${alice.sub}/logo.png`]));
    await denied(as(bob, (c) => c.query(`insert into attachments(entity, entity_id, owner_id, path, file_name, mime, bytes) values ('order', $1, $2, $3, 'x.png', 'image/png', 10)`, [orderId, bob.sub, `${bob.sub}/x.png`])), /row-level security/, "bob attached to alice's order");
    await denied(as(alice, (c) => c.query(`insert into attachments(entity, entity_id, owner_id, path, file_name, mime, bytes) values ('order', $1, $2, $3, 'y.png', 'image/png', 10)`, [orderId, alice.sub, `${bob.sub}/y.png`])), /row-level security/, "row pointed into another folder");
    await denied(as(alice, (c) => c.query(`insert into attachments(entity, entity_id, owner_id, path, file_name, mime, bytes, internal) values ('order', $1, $2, $3, 'z.png', 'image/png', 10, true)`, [orderId, alice.sub, `${alice.sub}/z.png`])), /row-level security/, "customer wrote an internal file");
  });
  await check("a staff DRAFT quote (and its lines) is invisible to the customer until it leaves draft", async () => {
    const d = (await admin.query(`insert into quotes(ref, customer_id, status, total_lak) values ('SPP-QUOTE-TEST-DRAFT', $1, 'draft', 999) returning id`, [alice.sub])).rows[0].id;
    await admin.query(`insert into quote_items(quote_id, product_slug, product_name, qty, unit_price_lak) values ($1, 'polo-shirt', 'Polo Shirt', 10, 99)`, [d]);
    eq((await as(alice, (c) => c.query(`select 1 from quotes where id = $1`, [d]))).rowCount, 0, "draft quote leaked");
    eq((await as(alice, (c) => c.query(`select 1 from quote_items where quote_id = $1`, [d]))).rowCount, 0, "draft lines leaked");
    await admin.query(`update quotes set status = 'sent' where id = $1`, [d]);
    eq((await as(alice, (c) => c.query(`select 1 from quote_items where quote_id = $1`, [d]))).rowCount, 1, "sent quote hidden");
    await admin.query(`delete from quotes where id = $1`, [d]);
  });
  await check("guest sessions get a profile; upgrading to an account mirrors email + name, never role", async () => {
    const guest = (await admin.query(`insert into auth.users(email, raw_user_meta_data) values (null, '{}') returning id`)).rows[0].id as string;
    eq((await admin.query(`select email::text, full_name, role::text from profiles where id = $1`, [guest])).rows[0], { email: "", full_name: "", role: "customer" });
    await as({ sub: guest }, (c) => c.query(`insert into designs(ref, owner_id, product_slug, garment) values ('x', $1, 'custom-t-shirt', 'tee')`, [guest]));
    await admin.query(`update auth.users set email = 'guest-upgraded@example.com', raw_user_meta_data = '{"full_name":"Gina Guest","phone":"+856 20 1234 5678","role":"admin"}' where id = $1`, [guest]);
    eq((await admin.query(`select email::text, full_name, phone, role::text from profiles where id = $1`, [guest])).rows[0], { email: "guest-upgraded@example.com", full_name: "Gina Guest", phone: "+856 20 1234 5678", role: "customer" });
    eq((await as({ sub: guest }, (c) => c.query(`select count(*)::int n from designs`))).rows[0].n, 1, "guest designs did not carry over");
    await denied(as({ sub: guest }, (c) => c.query(`update profiles set email = 'other@example.com' where id = $1`, [guest])), /protected profile fields/, "customer changed own email");
  });

  console.log("\nBILLBOARDS");
  let bookingId = "";
  await check("booking request never auto-confirms and never blocks dates", async () => {
    const r = (await as(anon, (c) => c.query(`select submit_booking($1) r`, [JSON.stringify({ contact, billboard: "SPP-BB-002", startsOn: "2027-02-01", endsOn: "2027-05-31" })]))).rows[0].r;
    ok(/^SPP-BOOKING-/.test(r.ref) && /not a confirmed booking/.test(r.message), JSON.stringify(r));
    const b = (await admin.query(`select id, status from billboard_bookings where ref = $1`, [r.ref])).rows[0];
    bookingId = b.id;
    eq(b.status, "requested");
    eq((await admin.query(`select count(*)::int n from billboard_availability where booking_id = $1`, [b.id])).rows[0].n, 0);
  });
  await check("booking validation: min term, past dates, withdrawn sites", async () => {
    await denied(as(anon, (c) => c.query(`select submit_booking($1)`, [JSON.stringify({ contact, billboard: "SPP-BB-002", startsOn: "2027-02-01", endsOn: "2027-02-20" })])), /minimum booking/, "min term");
    await denied(as(anon, (c) => c.query(`select submit_booking($1)`, [JSON.stringify({ contact, billboard: "SPP-BB-002", startsOn: "2020-01-01", endsOn: "2020-06-01" })])), /valid campaign period/, "past");
    await denied(as(anon, (c) => c.query(`select submit_booking($1)`, [JSON.stringify({ contact, billboard: "SPP-BB-017", startsOn: "2027-02-01", endsOn: "2027-06-01" })])), /not currently offered/, "withdrawn");
  });
  await check("only billboard staff confirm; confirmation blocks dates; clashes are refused", async () => {
    await denied(as(alice, (c) => c.query(`select confirm_booking($1)`, [bookingId])), /forbidden/, "customer confirm");
    await denied(as(production, (c) => c.query(`select confirm_booking($1)`, [bookingId])), /forbidden/, "production confirm");
    await as(sales, (c) => c.query(`select confirm_booking($1)`, [bookingId]));
    const again = (await as(anon, (c) => c.query(`select submit_booking($1) r`, [JSON.stringify({ contact, billboard: "SPP-BB-002", startsOn: "2027-04-01", endsOn: "2027-08-01" })]))).rows[0].r;
    eq(again.possibleClash, true);
    const id2 = (await admin.query(`select id from billboard_bookings where ref = $1`, [again.ref])).rows[0].id;
    await denied(as(sales, (c) => c.query(`select confirm_booking($1)`, [id2])), /clash/, "double-book");
  });
  await check("public sees availability dates but never who booked", async () => {
    ok((await as(anon, (c) => c.query(`select starts_on from billboard_availability`))).rowCount! >= 1, "dates visible");
    eq((await as(anon, (c) => c.query(`select 1 from billboard_bookings`))).rowCount, 0, "bookings leaked");
  });

  console.log("\nCONSULTATIONS");
  await check("consultation request → lead; convert to project carries notes", async () => {
    const when = new Date(Date.now() + 5 * 864e5).toISOString();
    const r = (await as(anon, (c) => c.query(`select submit_consultation($1) r`, [JSON.stringify({ contact, topic: "Hotel uniforms", goal: "120 staff", durationMins: 30, preferredAt: when })]))).rows[0].r;
    const k = (await admin.query(`select id from consultations where ref = $1`, [r.ref])).rows[0].id;
    await as(sales, (c) => c.query(`insert into internal_notes(entity, entity_id, body, author) values ('consultation', $1, 'Wants navy + gold', $2)`, [k, sales.sub]));
    const p = (await as(sales, (c) => c.query(`select convert_consultation_to_project($1, 'Hotel uniform programme') r`, [k]))).rows[0].r;
    eq((await admin.query(`select count(*)::int n from internal_notes where entity = 'project' and entity_id = $1`, [p.projectId])).rows[0].n, 1);
    await denied(as(anon, (c) => c.query(`select submit_consultation($1)`, [JSON.stringify({ contact, topic: "x y", durationMins: 20, preferredAt: when })])), /consultation length/, "bad duration");
  });

  console.log("\nRBAC · privilege escalation");
  await check("customer cannot promote themselves (direct update)", async () =>
    denied(as(alice, (c) => c.query(`update profiles set role = 'super_admin' where id = $1`, [alice.sub])), /protected profile fields/, "self-promote"));
  await check("customer cannot call set_user_role", async () => denied(as(alice, (c) => c.query(`select set_user_role($1, 'admin')`, [alice.sub])), /forbidden/, "rpc"));
  await check("sales cannot change roles or security settings", async () => {
    await denied(as(sales, (c) => c.query(`select set_user_role($1, 'sales')`, [bob.sub])), /forbidden/, "sales grants role");
    await denied(as(sales, (c) => c.query(`update feature_flags set enabled = false where key = 'PAYMENTS' returning key`)).then((r) => { if ((r as pg.QueryResult).rowCount) return; throw new Error("row-level security"); }), /row-level security/, "sales flips flag");
  });
  await check("admin can manage staff but cannot mint admins; nobody edits own role", async () => {
    await as(adminU, (c) => c.query(`select set_user_role($1, 'designer')`, [bob.sub]));
    eq((await admin.query(`select role from profiles where id = $1`, [bob.sub])).rows[0].role, "designer");
    await denied(as(adminU, (c) => c.query(`select set_user_role($1, 'admin')`, [bob.sub])), /super admin required/, "admin mints admin");
    await denied(as(adminU, (c) => c.query(`select set_user_role($1, 'sales')`, [superU.sub])), /super admin required/, "admin demotes super");
    await denied(as(superU, (c) => c.query(`select set_user_role($1, 'admin')`, [superU.sub])), /own role/, "self change");
    await as(superU, (c) => c.query(`select set_user_role($1, 'customer')`, [bob.sub]));
  });
  await check("production cannot touch customer accounts; designer cannot see orders' money", async () => {
    eq((await as(production, (c) => c.query(`update profiles set full_name = 'x' where id = $1`, [alice.sub]))).rowCount, 0);
    eq((await as(designer, (c) => c.query(`select 1 from orders`))).rowCount, 0, "designer read orders");
    eq((await as(production, (c) => c.query(`select 1 from order_items`))).rowCount, 0, "production read priced lines");
    const v = await as(production, (c) => c.query(`select * from production_orders`));
    ok(v.rowCount! >= 1 && !("total_lak" in v.rows[0]), "production view missing or leaks money");
    eq((await as(alice, (c) => c.query(`select 1 from production_orders`))).rowCount, 0, "customer read production view");
  });
  await check("customers see only their own profile", async () => eq((await as(alice, (c) => c.query(`select id from profiles`))).rows.map((r) => r.id), [alice.sub]));
  await check("marketing edits content but not pricing or leads' data", async () => {
    eq((await as(marketing, (c) => c.query(`update faqs set sort = sort where true`))).rowCount! > 0, true);
    eq((await as(marketing, (c) => c.query(`update pricing_rules set amount = 1`))).rowCount, 0);
    eq((await as(marketing, (c) => c.query(`update leads set status = 'lost'`))).rowCount, 0);
  });

  console.log("\nAUDIT · ANALYTICS · ABUSE");
  await check("audit log records who changed what, with before/after; admin-only", async () => {
    await as(adminU, (c) => c.query(`update billboards set status = 'maintenance' where code = 'SPP-BB-003'`));
    const r = (await as(adminU, (c) => c.query(`select actor, before ->> 'status' b, after ->> 'status' a from audit_log where entity = 'billboards' and action = 'update' order by at desc limit 1`))).rows[0];
    eq([r.actor, r.b, r.a], [adminU.sub, "available", "maintenance"]);
    eq((await as(sales, (c) => c.query(`select 1 from audit_log`))).rowCount, 0, "sales read audit");
    await denied(as(adminU, (c) => c.query(`delete from audit_log returning id`)).then((r) => { if (!(r as pg.QueryResult).rowCount) throw new Error("row-level security"); }), /row-level security/, "audit tamper");
  });
  await check("events tracked; unknown names dropped; only analysts can read", async () => {
    await as(anon, (c) => c.query(`select track_event($1)`, [JSON.stringify({ sessionId: "s1", name: "product_view", path: "/products/polo-shirt/", product: "polo-shirt" })]));
    await as(anon, (c) => c.query(`select track_event($1)`, [JSON.stringify({ sessionId: "s1", name: "drop table", path: "/" })]));
    eq((await admin.query(`select count(*)::int n from analytics_events`)).rows[0].n, 1);
    eq((await as(alice, (c) => c.query(`select 1 from analytics_events`))).rowCount, 0);
    const f = (await as(marketing, (c) => c.query(`select funnel_summary() f`))).rows[0].f;
    ok(f.visitors === 1 && f.quotes >= 1 && f.orders === 1, JSON.stringify({ v: f.visitors, q: f.quotes, o: f.orders }));
    await denied(as(alice, (c) => c.query(`select funnel_summary()`)), /forbidden/, "customer funnel");
  });
  await check("abandoned activity stores an email ONLY with recovery consent", async () => {
    await as(anon, (c) => c.query(`select record_intent($1)`, [JSON.stringify({ sessionId: "s2", flow: "design", stage: "artwork_uploaded", email: "x@y.co", recoveryConsent: false })]));
    await as(anon, (c) => c.query(`select record_intent($1)`, [JSON.stringify({ sessionId: "s3", flow: "quote", stage: "details", email: "z@y.co", recoveryConsent: true })]));
    const r = (await admin.query(`select session_id, contact_email from abandoned_activities order by session_id`)).rows;
    eq(r, [{ session_id: "s2", contact_email: null }, { session_id: "s3", contact_email: "z@y.co" }]);
  });
  await check("rate limit stops form flooding from one address", async () => {
    const c = new pg.Client({ host: "localhost", port, user: "postgres", password: "postgres", database: "spp" });
    await c.connect();
    let blocked = false;
    for (let i = 0; i < 8 && !blocked; i++) {
      await c.query("begin");
      await c.query(`select set_config('request.headers', '{"x-forwarded-for":"203.0.113.9"}', true), set_config('request.jwt.claims', '{"role":"anon"}', true)`);
      await c.query("set local role anon");
      try {
        await c.query(`select submit_contact($1)`, [JSON.stringify({ contact, message: "Hello there SPP" })]);
        await c.query("commit");
      } catch (e) {
        await c.query("rollback");
        if (/rate_limited/.test((e as Error).message)) blocked = true; else throw e;
      }
    }
    await c.end();
    ok(blocked, "8 submissions in a row were all accepted");
  });
  await check("SQL injection payloads are stored as inert text", async () => {
    const evil = `Robert'); drop table leads;--`;
    await as(anon, (c) => c.query(`select submit_contact($1)`, [JSON.stringify({ contact: { ...contact, name: evil }, message: `<script>alert(1)</script> ${evil}` })]));
    ok((await admin.query(`select 1 from leads where name = $1`, [evil])).rowCount === 1, "payload not stored verbatim");
  });
  await check("QR scan tracking resolves a destination and counts scans", async () => {
    await admin.query(`insert into campaigns(slug, name, status) values ('pi-mai-2027', 'Pi Mai 2027', 'published')`);
    await admin.query(`insert into campaign_qr_codes(code, campaign_id, label) select 'PIMAI27A', id, 'Patuxai face A' from campaigns where slug = 'pi-mai-2027'`);
    eq((await as(anon, (c) => c.query(`select track_qr_scan('PIMAI27A', 's9') r`))).rows[0].r.destination, "/campaigns/?c=pi-mai-2027");
    eq((await as(anon, (c) => c.query(`select track_qr_scan('UNKNOWN1') r`))).rows[0].r.destination, "/");
    eq((await admin.query(`select count(*)::int n from qr_scans`)).rows[0].n, 1);
  });
  await check("AI assistant quota: sign-in required, flag respected, 12/hour cap, usage unreadable by customers", async () => {
    await denied(as(anon, (c) => c.query(`select ai_quota_take()`)), /permission denied/, "anon took quota");
    await admin.query(`update feature_flags set enabled = false where key = 'AI_DESIGN'`);
    eq((await as(alice, (c) => c.query(`select ai_quota_take() q`))).rows[0].q.ok, false, "flag off");
    await admin.query(`update feature_flags set enabled = true where key = 'AI_DESIGN'`);
    let okCount = 0, last = { ok: true } as { ok: boolean; reason?: string };
    for (let i = 0; i < 14; i++) { last = (await as(alice, (c) => c.query(`select ai_quota_take() q`))).rows[0].q; if (last.ok) okCount++; }
    eq(okCount, 12, "hourly cap");
    ok(/usage limit/.test(last.reason ?? ""), "limit message");
    // Jarvis (chat) has its own, larger allowance and does not eat the layout allowance
    let jarvisOk = 0;
    for (let i = 0; i < 32; i++) { if ((await as(alice, (c) => c.query(`select ai_quota_take('jarvis') q`))).rows[0].q.ok) jarvisOk++; }
    eq(jarvisOk, 30, "jarvis hourly cap");
    eq((await as(alice, (c) => c.query(`select 1 from ai_usage`))).rowCount, 0, "customer read ai_usage");
  });
  await check("attention summary hides counts outside the caller's remit", async () => {
    const s = (await as(production, (c) => c.query(`select attention_summary() s`))).rows[0].s;
    ok(s.newLeads === null && typeof s.jobsOverdue === "number", JSON.stringify(s));
    await denied(as(alice, (c) => c.query(`select attention_summary()`)), /forbidden/, "customer");
  });

  console.log("\nCOMMAND CENTER OPS (0011)");
  await check("manual lead: sales only, server-issued ref, contact validated", async () => {
    const r = (await as(sales, (c) => c.query(`select staff_create_lead($1) r`, [JSON.stringify({ contact: { name: "Walk-in Customer", phone: "+856 20 7777 0001" }, message: "Needs 40 caps", estimatedValueLak: 4000000, priority: "high" })]))).rows[0].r;
    ok(/^SPP-LEAD-\d{4}-\d{5}$/.test(r.ref), r.ref);
    eq((await admin.query(`select source::text, priority::text, assigned_to from leads where id = $1`, [r.id])).rows[0], { source: "manual", priority: "high", assigned_to: sales.sub });
    await denied(as(alice, (c) => c.query(`select staff_create_lead($1)`, [JSON.stringify({ contact: { name: "Al Ice", phone: "+856 20 1111 2222" } })])), /forbidden/, "customer created lead");
    await denied(as(production, (c) => c.query(`select staff_create_lead($1)`, [JSON.stringify({ contact: { name: "Pro Duction", phone: "+856 20 1111 2222" } })])), /forbidden/, "production created lead");
    await denied(as(sales, (c) => c.query(`select staff_create_lead($1)`, [JSON.stringify({ contact: { name: "No Contact" } })])), /one way to reach/, "no contact");
  });
  let opsOrder = "";
  await check("staff quote starts as DRAFT; send_quote demands prices + total, then notifies the customer", async () => {
    const d = (await as(sales, (c) => c.query(`select staff_create_quote($1) r`, [JSON.stringify({ contact: { name: "Phone Customer", email: "phone@example.com" }, items: [{ product: "polo-shirt", qty: 30, note: "navy" }] })]))).rows[0].r;
    eq((await admin.query(`select q.status::text, l.status::text ls, l.source::text src from quotes q join leads l on l.id = q.lead_id where q.id = $1`, [d.id])).rows[0], { status: "draft", ls: "quote", src: "manual" });
    await denied(as(sales, (c) => c.query(`select send_quote($1)`, [d.id])), /Price every line/, "unpriced send");
    await as(sales, (c) => c.query(`update quote_items set unit_price_lak = 90000, line_total_lak = 2700000 where quote_id = $1`, [d.id]));
    await denied(as(sales, (c) => c.query(`select send_quote($1)`, [d.id])), /Set the quote total/, "no total");
    await denied(as(sales, (c) => c.query(`select staff_create_quote($1)`, [JSON.stringify({ contact: { name: "Phone Customer", email: "phone@example.com" }, items: [] })])), /at least one item/, "empty quote");
    await denied(as(alice, (c) => c.query(`select send_quote($1)`, [d.id])), /forbidden/, "customer sent quote");
    // Alice's reorder quote: price it, send it → she is told in her portal
    const rq = (await admin.query(`select id from quotes where kind = 'reorder' and customer_id = $1 order by created_at desc limit 1`, [alice.sub])).rows[0].id;
    await as(sales, (c) => c.query(`update quote_items set unit_price_lak = 100000 where quote_id = $1`, [rq]));
    await as(sales, (c) => c.query(`update quotes set total_lak = 40000000, valid_until = current_date + 14 where id = $1`, [rq]));
    eq((await as(sales, (c) => c.query(`select send_quote($1) r`, [rq]))).rows[0].r.status, "sent");
    ok((await admin.query(`select sent_at from quotes where id = $1`, [rq])).rows[0].sent_at, "sent_at");
    eq((await as(alice, (c) => c.query(`select count(*)::int n from notifications where kind = 'quote_sent'`))).rows[0].n, 1, "customer notification");
    ok((await admin.query(`select 1 from email_outbox where template = 'quote_sent' and to_email = 'alice@example.com'`)).rowCount! >= 1, "email queued");
    eq((await as(alice, (c) => c.query(`select respond_to_quote($1, true) r`, [rq]))).rows[0].r.status, "accepted");
    opsOrder = (await as(sales, (c) => c.query(`select convert_quote_to_order($1) r`, [rq]))).rows[0].r.orderId;
  });
  await check("notify_customer: staff only, portal links only, customers only", async () => {
    await as(sales, (c) => c.query(`select notify_customer($1, 'consultation', 'Consultation confirmed', 'Tue 10:00 ICT', '/account/')`, [alice.sub]));
    eq((await as(alice, (c) => c.query(`select count(*)::int n from notifications where kind = 'consultation'`))).rows[0].n, 1);
    await denied(as(sales, (c) => c.query(`select notify_customer($1, 'x', 'Click here', '', 'https://evil.example/')`, [alice.sub])), /only link into My SPP/, "external link");
    await denied(as(alice, (c) => c.query(`select notify_customer($1, 'x', 'Hello Bob', '', '/account/')`, [bob.sub])), /forbidden/, "customer notified customer");
    await as(sales, (c) => c.query(`select notify_customer($1, 'x', 'To a colleague', '', '/account/')`, [designer.sub]));
    eq((await admin.query(`select count(*)::int n from notifications where user_id = $1`, [designer.sub])).rows[0].n, 0, "staff member was targeted");
  });
  await check("messages notify the other side (staff → customer portal, customer → sales)", async () => {
    ok((await as(alice, (c) => c.query(`select 1 from notifications where kind = 'message' and href like '/account/quotes/%'`))).rowCount! >= 1, "customer not told");
    ok((await as(sales, (c) => c.query(`select 1 from notifications where kind = 'message' and audience = 'sales' and href like '/admin/quotes/%'`))).rowCount! >= 1, "sales not told");
  });
  await check("delivery progress moves the order for production staff, who still cannot read orders", async () => {
    eq((await as(production, (c) => c.query(`select release_to_production($1) n`, [opsOrder]))).rows[0].n, 1);
    const job = (await as(production, (c) => c.query(`select id from production_jobs where order_id = $1`, [opsOrder]))).rows[0].id;
    await as(production, (c) => c.query(`update production_jobs set status = 'qc' where id = $1`, [job]));
    eq((await admin.query(`select status::text from orders where id = $1`, [opsOrder])).rows[0].status, "quality_control");
    await as(production, (c) => c.query(`select record_qc($1, '[]', 'pass')`, [job]));
    const del = (await as(production, (c) => c.query(`select id from deliveries where order_id = $1`, [opsOrder]))).rows[0].id;
    await as(production, (c) => c.query(`update deliveries set status = 'in_transit', carrier = 'SPP van' where id = $1`, [del]));
    eq((await admin.query(`select status::text from orders where id = $1`, [opsOrder])).rows[0].status, "delivery");
    await as(production, (c) => c.query(`update deliveries set status = 'delivered', completed_at = now() where id = $1`, [del]));
    const o = (await admin.query(`select status::text, completed_at from orders where id = $1`, [opsOrder])).rows[0];
    ok(o.status === "completed" && o.completed_at, JSON.stringify(o));
    ok((await as(alice, (c) => c.query(`select 1 from notifications where kind = 'order_completed'`))).rowCount! >= 1, "customer not told");
    eq((await as(production, (c) => c.query(`select 1 from orders`))).rowCount, 0, "production read orders");
    ok((await as(production, (c) => c.query(`select 1 from production_orders where id = $1`, [opsOrder]))).rowCount === 1, "production_orders view");
  });
  await check("request_design_changes: hands artwork back, tells the owner, records it on their quote thread", async () => {
    await denied(as(alice, (c) => c.query(`select request_design_changes($1, 'make it bigger please')`, [aliceDesign])), /forbidden/, "customer");
    await denied(as(marketing, (c) => c.query(`select request_design_changes($1, 'make it bigger please')`, [aliceDesign])), /forbidden/, "marketing");
    await denied(as(designer, (c) => c.query(`select request_design_changes($1, 'no')`, [aliceDesign])), /what needs to change/, "short note");
    await as(designer, (c) => c.query(`select request_design_changes($1, 'Logo is low resolution — please upload a vector.')`, [aliceDesign]));
    eq((await admin.query(`select status::text from designs where id = $1`, [aliceDesign])).rows[0].status, "saved");
    eq((await as(alice, (c) => c.query(`select count(*)::int n from notifications where kind = 'artwork_changes' and href like '/design/%'`))).rows[0].n, 1);
    ok((await as(alice, (c) => c.query(`select 1 from messages where from_staff and body like '%changes requested%'`))).rowCount! >= 1, "thread message");
    await as(designer, (c) => c.query(`update designs set status = 'approved' where id = $1`, [aliceDesign]));
  });
  await check("manual project + consultation: sales only, refs issued, lead linked", async () => {
    const l = (await admin.query(`select id from leads where source = 'manual' order by created_at limit 1`)).rows[0].id;
    const p = (await as(sales, (c) => c.query(`select staff_create_project($1) r`, [JSON.stringify({ name: "Cap programme", leadId: l, scope: "40 caps, embroidered" })]))).rows[0].r;
    ok(/^SPP-PROJECT-/.test(p.ref), p.ref);
    eq((await admin.query(`select l.status::text from projects p join leads l on l.id = p.lead_id where p.id = $1`, [p.id])).rows[0].status, "qualified");
    await denied(as(production, (c) => c.query(`select staff_create_project($1)`, [JSON.stringify({ name: "Sneaky" })])), /forbidden/, "production created project");
    const k = (await as(sales, (c) => c.query(`select staff_create_consultation($1) r`, [JSON.stringify({ contact: { name: "Caller One", email: "caller@example.com" }, topic: "Shop signage", durationMins: 30, preferredAt: new Date(Date.now() + 3 * 864e5).toISOString() })]))).rows[0].r;
    ok(/^SPP-CONSULT-/.test(k.ref), k.ref);
    await denied(as(sales, (c) => c.query(`select staff_create_consultation($1)`, [JSON.stringify({ contact: { name: "Caller One", email: "caller@example.com" }, topic: "Signage", durationMins: 20, preferredAt: new Date().toISOString() })])), /consultation length/, "bad duration");
    await denied(as(alice, (c) => c.query(`select staff_create_consultation($1)`, [JSON.stringify({ contact: { name: "Al Ice", email: "a@example.com" }, topic: "Hi there", durationMins: 30, preferredAt: new Date().toISOString() })])), /forbidden/, "customer");
  });

  console.log("\nCMS · publishing (0012)");
  await check("marketing can log a site publish; last_publish only moves on success", async () => {
    await as(marketing, (c) => c.query(`select record_publish(false, 'GitHub token missing')`));
    eq((await admin.query(`select count(*)::int n from settings where key = 'last_publish'`)).rows[0].n, 0, "failed publish must not set last_publish:");
    await as(marketing, (c) => c.query(`select record_publish(true, 'Build started')`));
    const last = (await admin.query(`select value, is_public from settings where key = 'last_publish'`)).rows[0];
    ok(last.value.at && last.is_public === false, "last_publish not recorded privately");
    const hist = (await admin.query(`select value from settings where key = 'publish_history'`)).rows[0].value;
    eq([hist.length, hist[0].ok, hist[1].ok], [2, true, false], "history newest-first:");
  });
  await check("customers and anon cannot log a publish or read the publish log", async () => {
    await denied(as(alice, (c) => c.query(`select record_publish(true, 'x')`)), /forbidden/, "customer");
    await denied(as(anon, (c) => c.query(`select record_publish(true, 'x')`)), /permission denied|forbidden/, "anon");
    eq((await as(anon, (c) => c.query(`select key from settings where key in ('last_publish','publish_history')`))).rowCount, 0, "anon sees publish log:");
  });
  await check("publish history is capped at 25 entries", async () => {
    for (let i = 0; i < 30; i++) await as(adminU, (c) => c.query(`select record_publish(true, $1)`, [`run ${i}`]));
    eq((await admin.query(`select jsonb_array_length(value) n from settings where key = 'publish_history'`)).rows[0].n, 25);
  });
  await check("simple content tables track updated_at", async () => {
    const before = (await admin.query(`select id, updated_at from faqs limit 1`)).rows[0];
    ok(before, "seed has no FAQ");
    await as(marketing, (c) => c.query(`update faqs set a = a || ' ' where id = $1`, [before.id]));
    const after = (await admin.query(`select updated_at from faqs where id = $1`, [before.id])).rows[0];
    ok(new Date(after.updated_at) > new Date(before.updated_at), "updated_at did not move");
  });
  await check("marketing sees artwork only when a billboard enquiry references it", async () => {
    const mk = async (file: string) => (await admin.query(`insert into design_assets(owner_id, path, file_name, mime, bytes) values ($1, $2, $3, 'image/png', 10) returning id`, [alice.sub, `${alice.sub}/${file}`, file])).rows[0].id as string;
    const linked = await mk("cms-linked.png");
    const loose = await mk("cms-loose.png");
    await admin.query(`insert into billboard_bookings(ref, billboard_id, contact, starts_on, ends_on, design_asset_id) select 'SPP-BOOKING-CMS-1', id, '{}'::jsonb, current_date + 400, current_date + 460, $1 from billboards limit 1`, [linked]);
    const seen = (await as(marketing, (c) => c.query(`select id from design_assets where id = any($1)`, [[linked, loose]]))).rows.map((r) => r.id);
    eq(seen, [linked], "marketing visibility:");
    eq((await as(production, (c) => c.query(`select id from design_assets where id = $1`, [loose]))).rowCount, 1, "production keeps full read:");
    eq((await as(bob, (c) => c.query(`select id from design_assets where id = $1`, [linked]))).rowCount, 0, "another customer:");
  });
}

main()
  .catch((e) => failures.push(`FATAL — ${(e as Error).message}`))
  .finally(async () => {
    await admin?.end().catch(() => {});
    await server.stop().catch(() => {});
    rmSync(dir, { recursive: true, force: true });
    console.log(`\n${passed} passed, ${failures.length} failed`);
    if (failures.length) {
      console.log(failures.map((f) => `  ✗ ${f}`).join("\n"));
      process.exit(1);
    }
  });

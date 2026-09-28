// PUBLISH SITE — Supabase Edge Function (Deno).
// The public site is a static build on GitHub Pages. "Publish" asks GitHub
// Actions to rebuild it from the current database content.
//
// Secrets:
//   GITHUB_REPO            "owner/repo"
//   GITHUB_DISPATCH_TOKEN  OPTIONAL. Fine-grained PAT, this repo only, permission "Contents: Read and write".
//                          With it the rebuild starts immediately. Without it (or when it has expired) the
//                          request is queued and the scheduled "publish-watch" job in GitHub Actions starts
//                          the rebuild within about 15 minutes — so staff can always publish.
//   SITE_ORIGINS           allowed browser origins
import { createClient } from "npm:@supabase/supabase-js@^2";
import { cors, fail, json } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return fail(req, 405, "Method not allowed.");

  const auth = req.headers.get("authorization");
  if (!auth) return fail(req, 401, "Please sign in again.");
  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });

  // Authorisation is decided by the database's own capability function, evaluated as the caller.
  // Publishing changes the public site, so it needs EDIT rights (can_write), not view rights.
  const [{ data: content }, { data: catalogue }, { data: settings }, { data: who }] = await Promise.all([asUser.rpc("can_write", { domain: "content" }), asUser.rpc("can_write", { domain: "catalogue" }), asUser.rpc("can_write", { domain: "settings" }), asUser.auth.getUser()]);
  if (!who?.user || !(content === true || catalogue === true || settings === true)) return fail(req, 403, "You do not have permission to publish the site.");

  const repo = Deno.env.get("GITHUB_REPO"), token = Deno.env.get("GITHUB_DISPATCH_TOKEN");
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // Debounce: a rebuild takes ~2–3 minutes; refuse a second trigger inside 60 seconds.
  const { data: last } = await admin.from("settings").select("value").eq("key", "last_publish").maybeSingle();
  const lastAt = last?.value?.at ? Date.parse(last.value.at) : 0;
  if (Date.now() - lastAt < 60_000) return json(req, 200, { ok: true, message: "A publish was started a moment ago. Your changes will be included — the site updates in about 2–3 minutes." });

  // 1 · Always queue the request: the scheduled watcher rebuilds from this stamp even if step 2 cannot run.
  const requested = { at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"), by: who.user.id };
  const queued = await admin.from("settings").upsert({ key: "publish_request", value: requested, is_public: false, updated_by: who.user.id });
  if (queued.error) { console.error("publish queue failed", queued.error.message); return json(req, 200, { ok: false, message: "The publish request could not be recorded. Please try again in a moment." }); }

  // 2 · Start the rebuild now when a working token is available.
  let immediate = false;
  if (repo && token) {
    const gh = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "spp-publish" },
      body: JSON.stringify({ event_type: "cms-publish", client_payload: { by: who.user.id } }),
    });
    immediate = gh.status === 204;
    if (!immediate) console.error("github dispatch failed — falling back to the scheduled watcher", gh.status, (await gh.text()).slice(0, 300));
  }

  const stamp = { at: new Date().toISOString(), by: who.user.id, email: who.user.email ?? null };
  await admin.from("settings").upsert({ key: "last_publish", value: stamp, is_public: false, updated_by: who.user.id });
  await admin.from("audit_log").insert({ actor: who.user.id, action: "publish_site", entity: "site", entity_id: repo ?? "queued", after: { ...stamp, immediate } });
  return json(req, 200, { ok: true, queued: !immediate, message: immediate ? "Publishing started. Your changes will be live in about 2–3 minutes." : "Publish queued. The site rebuilds automatically — your changes will be live within about 15 minutes." });
});

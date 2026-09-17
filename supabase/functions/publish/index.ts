// PUBLISH SITE — Supabase Edge Function (Deno).
// The public site is a static build on GitHub Pages. "Publish" asks GitHub
// Actions to rebuild it from the current database content.
//
// Secrets:
//   GITHUB_REPO            "owner/repo"
//   GITHUB_DISPATCH_TOKEN  fine-grained PAT, this repo only, permission "Contents: Read and write"
//                          (required by the repository_dispatch endpoint). Lives here, never in the browser.
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
  const [{ data: content }, { data: settings }, { data: who }] = await Promise.all([asUser.rpc("can", { domain: "content" }), asUser.rpc("can", { domain: "settings" }), asUser.auth.getUser()]);
  if (!who?.user || !(content === true || settings === true)) return fail(req, 403, "You do not have permission to publish the site.");

  const repo = Deno.env.get("GITHUB_REPO"), token = Deno.env.get("GITHUB_DISPATCH_TOKEN");
  if (!repo || !token) return json(req, 200, { ok: false, message: "Publishing is not connected to GitHub yet. Add GITHUB_REPO and GITHUB_DISPATCH_TOKEN to the function secrets (see docs/DEPLOY.md)." });

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  // Debounce: a rebuild takes ~2–3 minutes; refuse a second trigger inside 60 seconds.
  const { data: last } = await admin.from("settings").select("value").eq("key", "last_publish").maybeSingle();
  const lastAt = last?.value?.at ? Date.parse(last.value.at) : 0;
  if (Date.now() - lastAt < 60_000) return json(req, 200, { ok: true, message: "A publish was started a moment ago. Your changes will be included — the site updates in about 2–3 minutes." });

  const gh = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "spp-publish" },
    body: JSON.stringify({ event_type: "cms-publish", client_payload: { by: who.user.id } }),
  });
  if (gh.status !== 204) {
    console.error("github dispatch failed", gh.status, await gh.text());
    return json(req, 200, { ok: false, message: gh.status === 401 || gh.status === 403 ? "GitHub rejected the publish token. It may have expired — create a new one (docs/DEPLOY.md)." : gh.status === 404 ? "GitHub could not find the repository. Check GITHUB_REPO and the token's repository access." : "GitHub did not accept the publish request. Please try again shortly." });
  }

  const stamp = { at: new Date().toISOString(), by: who.user.id, email: who.user.email ?? null };
  await admin.from("settings").upsert({ key: "last_publish", value: stamp, is_public: false, updated_by: who.user.id });
  await admin.from("audit_log").insert({ actor: who.user.id, action: "publish_site", entity: "site", entity_id: repo, after: stamp });
  return json(req, 200, { ok: true, message: "Publishing started. Your changes will be live in about 2–3 minutes." });
});

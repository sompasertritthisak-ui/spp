// Shared HTTP helpers for SPP Edge Functions (Deno).
// SITE_ORIGINS = comma-separated list of allowed browser origins,
//   e.g. "https://spp-la.github.io,https://www.spp.la,http://localhost:3000"
const allowed = (Deno.env.get("SITE_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  // Unknown origins get no ACAO header at all, so the browser blocks them.
  const ok = allowed.length === 0 ? origin.startsWith("http://localhost") : allowed.includes(origin);
  return {
    ...(ok ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

/** Never leak internals to the browser: log the detail, return the safe message. */
export function fail(req: Request, status: number, publicMessage: string, detail?: unknown) {
  if (detail !== undefined) console.error(`[${status}] ${publicMessage}`, detail instanceof Error ? detail.message : detail);
  return json(req, status, { error: publicMessage });
}

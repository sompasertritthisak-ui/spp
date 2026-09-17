// TRANSACTIONAL EMAIL — Supabase Edge Function (Deno). Drains public.email_outbox.
// Invoked on a schedule (GitHub Actions cron → this URL) with the shared CRON_SECRET.
//
// Secrets:
//   CRON_SECRET     long random string; the caller must send it as  x-cron-secret
//   RESEND_API_KEY  optional. Without it, emails stay 'queued' and visible in Command Center → Settings → Email outbox.
//   EMAIL_FROM      e.g. "SPP <hello@spp.la>"  (a domain verified with the provider)
//   SITE_URL        e.g. https://www.spp.la   (used for links)
// The provider sits behind send() so it can be swapped without touching the queue logic.
import { createClient } from "npm:@supabase/supabase-js@^2";

type Row = { id: string; to_email: string; template: string; subject: string; vars: Record<string, string | null> };

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const COPY: Record<string, { headline: string; body: string; cta?: [string, string] }> = {
  contact_received: { headline: "We have your message.", body: "Thank you for getting in touch. A member of the SPP team will reply shortly." },
  quote_submitted: { headline: "Your quote request is with us.", body: "Our team is reviewing your request and will send a written quotation. An on-screen estimate is a guide only — your written quotation is the confirmed price.", cta: ["Track your request", "/account/quotes/"] },
  consultation_requested: { headline: "Consultation requested.", body: "We will confirm your preferred time or suggest another. Nothing is booked until you hear from us.", cta: ["Back to SPP", "/"] },
  booking_requested: { headline: "Billboard request received.", body: "This is a request, not a confirmed booking. Our team will check availability for your dates and reply with a confirmation and contract.", cta: ["Explore the network", "/billboards/"] },
  booking_confirmed: { headline: "Your billboard booking is confirmed.", body: "Your dates are now reserved. We will be in touch about artwork, printing and installation.", cta: ["View my billboards", "/account/billboards/"] },
  order_created: { headline: "Your order is confirmed.", body: "Your order is now with our artwork team. You can follow each stage — artwork, production, quality control and delivery — in My SPP.", cta: ["View my order", "/account/orders/"] },
};

function render(r: Row, site: string) {
  const c = COPY[r.template] ?? { headline: r.subject, body: "" };
  const ref = r.vars.ref ? `<p style="font:500 12px ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:#9ca3c6;margin:0 0 8px">Reference</p><p style="font:600 22px ui-monospace,Menlo,monospace;color:#f5b81f;margin:0 0 28px">${esc(r.vars.ref)}</p>` : "";
  const cta = c.cta ? `<a href="${esc(site + c.cta[1])}" style="display:inline-block;background:#f5b81f;color:#070920;font:600 12px ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;padding:16px 26px">${esc(c.cta[0])} →</a>` : "";
  return `<!doctype html><html><body style="margin:0;background:#070920"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070920"><tr><td align="center" style="padding:40px 16px"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0b0e2c;border:1px solid #1e2558"><tr><td style="height:6px;background:linear-gradient(90deg,#00aeef 0 25%,#ec008c 25% 50%,#f5b81f 50% 75%,#1a1a8c 75% 100%)"></td></tr><tr><td style="padding:40px">
<p style="font:800 28px Arial,sans-serif;letter-spacing:.04em;color:#f6f8ff;margin:0 0 32px">SPP<span style="color:#f5b81f">.</span></p>
<p style="font:400 15px Arial,sans-serif;color:#bfc5e0;margin:0 0 10px">Hello ${esc(r.vars.name || "there")},</p>
<h1 style="font:700 30px/1.1 Arial,sans-serif;color:#f6f8ff;margin:0 0 18px">${esc(c.headline)}</h1>
<p style="font:400 16px/1.6 Arial,sans-serif;color:#bfc5e0;margin:0 0 28px">${esc(c.body)}</p>${ref}${cta}
<p style="font:400 13px/1.6 Arial,sans-serif;color:#8088b0;margin:36px 0 0;border-top:1px solid #1e2558;padding-top:20px">SPP Sole Co., Ltd · Vientiane, Lao PDR<br>You are receiving this because of a request you made on our website. This is a service message, not marketing.</p>
</td></tr></table></td></tr></table></body></html>`;
}

async function send(r: Row, html: string): Promise<string | null> {
  const key = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("EMAIL_FROM");
  if (!key || !from) return "not_configured";
  const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [r.to_email], subject: r.subject, html }) });
  return res.ok ? null : `provider ${res.status}`;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return new Response("forbidden", { status: 403 });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const site = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
  const { data: rows } = await db.from("email_outbox").select("id,to_email,template,subject,vars").eq("status", "queued").order("created_at").limit(25);
  let sent = 0, failed = 0;
  for (const r of (rows ?? []) as Row[]) {
    const err = await send(r, render(r, site));
    if (err === "not_configured") return Response.json({ sent, queued: rows?.length ?? 0, note: "email provider not configured; messages remain queued" });
    await db.from("email_outbox").update(err ? { status: "failed", error: err } : { status: "sent", sent_at: new Date().toISOString() }).eq("id", r.id);
    if (err) failed++; else sent++;
  }
  return Response.json({ sent, failed });
});

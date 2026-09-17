# Security

## Model in one paragraph
The browser is untrusted. It holds only the public **anon key**. Every table has
Row-Level Security; every privileged operation is a `SECURITY DEFINER` function
with a pinned `search_path` that re-checks the caller's role. Secrets (Claude API
key, GitHub token, service-role key, email key) exist **only** as Edge Function
secrets. `npm run db:test` boots a real Postgres, connects the way PostgREST does
(as `anon` / `authenticated` with JWT claims) and attacks the schema on every CI run.

## Roles and capabilities
`can(domain)` in `0001_core.sql` is the single capability map.

| Domain | super_admin | admin | sales | designer | production | marketing | customer |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| content (CMS) | ✔ | ✔ | | | | ✔ | |
| catalogue | ✔ | ✔ | ✔ | | | ✔ | |
| **pricing rules** | ✔ | ✔ | read | ✘ | ✘ | ✘ | ✘ |
| sales (leads, quotes, orders, money) | ✔ | ✔ | ✔ | ✘ | ✘ | read leads | own quotes/orders |
| designs & artwork approval | ✔ | ✔ | ✔ | ✔ | read | | own |
| production, QC, delivery | ✔ | ✔ | | ✔ | ✔ | | ✘ (order status only) |
| billboards & bookings | ✔ | ✔ | ✔ | | | ✔ | own requests |
| campaigns & QR | ✔ | ✔ | | | | ✔ | |
| analytics | ✔ | ✔ | ✔ | | | ✔ | |
| settings, flags | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ |
| grant admin / super_admin | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| audit log | ✔ | ✔ read-only | ✘ | ✘ | ✘ | ✘ | ✘ |

Production and design staff see orders through money-free views (`production_orders`, `production_order_items`).
Nobody — including a super admin — can change their own role. Roles change only through `set_user_role()`.

## Controls
| Threat | Control | Verified by |
|---|---|---|
| IDOR / cross-customer access | Owner-scoped RLS; RPCs re-check `owner_id = auth.uid()` before attaching a design, responding to a quote, reordering, sharing | db-test “customer isolation”, “IDOR” checks |
| Privilege escalation | `guard_profile_update` trigger; `set_user_role()` rules | db-test “RBAC” |
| Confidential pricing | No public policy on `pricing_rules`; `estimate_price()` returns a band + generic labels | db-test “PRICING ENGINE” |
| Forged references / self-approval | Server assigns every `SPP-…` ref; customers cannot set `approved` | db-test |
| SQL injection | Parameterised RPC payloads; no dynamic SQL from user input | db-test payload check |
| XSS | React escaping; **no `dangerouslySetInnerHTML` on user/CMS content**; markdown-lite renderer builds text nodes; JSON-LD escapes `<`; CMS embeds are allow-listed iframe URLs, never raw HTML | code review, bundle gate |
| Malicious uploads | Type decided by **magic bytes**, not name/MIME; 25 MB cap; SVG sanitised with DOMPurify (scripts, `foreignObject`, external refs, styles stripped) and only ever drawn via `<img>`; bucket-level MIME + size limits | unit tests, `0005_storage.sql` |
| Private artwork exposure | Private buckets; unguessable `<uid>/<uuid>.<ext>` paths; short-lived signed URLs; exports are preview-resolution + watermarked | storage policies |
| Form abuse | Honeypot + per-IP rate limit inside each RPC; AI assistant metered per user (12/h, 40/day) and behind a feature flag | db-test “rate limit”, “AI quota” |
| CSRF | No cookie auth: Supabase sends a bearer token from JS, which a cross-site form cannot do. Edge Functions use an origin allow-list (`SITE_ORIGINS`). | design |
| Prompt injection via the AI assistant | The model has **no tools and no data access**; context is passed as labelled data; output is schema-constrained, re-validated and clamped in the browser; suggestions apply only on an explicit, undoable click | design |
| Secrets in the bundle / blocked hosts | `scripts/check-bundle.mjs` fails the deploy if a key pattern, a Vercel/blocked host or a third-party CDN appears in `out/` | CI + deploy gate |
| Open redirects | `?next=` accepts same-origin relative paths only; `/q/` and campaign CTAs accept same-site paths or https only | code review |
| Tampering with history | `audit_log` written by triggers (actor, role, before/after, IP); no insert/update/delete policy for anyone | db-test “AUDIT” |
| Testimonial fabrication | DB constraint: cannot publish without `consent_recorded` | db-test |
| Marketing without consent | Abandoned-flow email stored only with explicit recovery consent; DNT honoured; first-party, cookieless analytics | db-test |

## Known limitations (accepted for v1 — fix before scale)
1. **Draft prices on the customer's own quote.** RLS is row-level: while a quote is `in_review`, the customer who owns it could read `unit_price_lak` through the API even though the UI hides it until `sent`. Staff *draft* quotes are hidden. Fix: move staff pricing to a side table or expose customer reads through a column-safe view.
2. **Rate limits are per-IP inside Postgres.** Adequate against casual abuse; add Supabase CAPTCHA (Turnstile) on anonymous sign-in and forms before a marketing push.
3. **No malware scanning** of uploads (not available on this infrastructure). Files are never executed or served inline from the site origin; staff should open originals in design software on a patched machine.
4. **Edge Functions are not exercised locally** (no Deno/Docker on the build machine). They are small and defensive; verify each once after deploy (checklist in `docs/AUDIT.md`).
5. **Guest → account upgrade** depends on Supabase's email-verification rules; both the one-step and two-step paths are implemented, but must be confirmed on the live project.

## Reporting
Security issues: email the address in **Settings → Company & contact**. Do not open a public GitHub issue.

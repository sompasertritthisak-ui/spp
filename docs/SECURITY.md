# Security

## Model in one paragraph
The browser is untrusted. It holds only the public **anon key**. Every table has
Row-Level Security; every privileged operation is a `SECURITY DEFINER` function
with a pinned `search_path` that re-checks the caller's role. Secrets (Claude API
key, GitHub token, service-role key, email key) exist **only** as Edge Function
secrets. `npm run db:test` boots a real Postgres, connects the way PostgREST does
(as `anon` / `authenticated` with JWT claims) and attacks the schema on every CI run.

## Roles and capabilities
Roles are **data, not code**. The super admin creates them, ranks them and decides what each one may
view or edit (Settings → Roles & hierarchy). Migrations `0023`, `0024` and `0027`; tables `roles` and
`role_capabilities`; `profiles.role_id` says which role a person holds.

### Two questions, two functions
| Question | SQL | Front end (`useAuth()`) | True when |
|---|---|---|---|
| May this person **see** the domain? | `can(domain)` | `can(domain)` | super admin, or the role holds the domain at `view` or `edit` |
| May this person **change** it? | `can_write(domain)` | `canWrite(domain)` | super admin, or the role holds the domain at `edit` |
| May this person change **anything** (notes, customer messages, attachments)? | `staff_can_write()` | `canWriteAny` | super admin, or the role holds at least one `edit` |

Grantable domains: `content`, `catalogue`, `pricing`, `sales`, `designs`, `production`, `billboards`,
`campaigns`, `analytics`, `finance`, `settings`, `team`. **`security` is never grantable** — a check
constraint keeps it out of `role_capabilities`, `save_role()` refuses it, and `can('security')` is true
for the super admin only.

### System roles (seeded, all at `edit` — exactly the permissions of the fixed map they replace)
| Domain | Super admin · 100 | Admin · 90 | Sales · 60 | Content manager · 60 | Designer · 50 | Production · 50 | Customer |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| content (CMS) | ✔ | ✔ | | ✔ | | | |
| catalogue | ✔ | ✔ | ✔ | ✔ | | | |
| **pricing rules** | ✔ | ✔ | read | ✘ | ✘ | ✘ | ✘ |
| sales (leads, quotes, orders) | ✔ | ✔ | ✔ | read leads | ✘ | ✘ | own quotes/orders |
| finance | ✔ | ✔ | ✔ | | | | |
| designs & artwork approval | ✔ | ✔ | ✔ | | ✔ | read | own |
| production, QC, delivery | ✔ | ✔ | | | ✔ | ✔ | ✘ (order status only) |
| billboards & bookings | ✔ | ✔ | ✔ | ✔ | | | own requests |
| campaigns & QR | ✔ | ✔ | | ✔ | | | |
| analytics | ✔ | ✔ | ✔ | ✔ | | | |
| settings, flags | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ |
| team (assign roles below own rank) | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ |
| security: create roles, set the hierarchy, grant admin / super admin | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| audit log | ✔ | read-only | ✘ | ✘ | ✘ | ✘ | ✘ |

"Content manager" is the role stored as `marketing`. The super admin may rename a system role, recolour
it, re-rank it (1–99) and change its capabilities; system roles cannot be deleted. The **super admin role
itself is fixed**: rank 100, every capability, only its name, description and colour can change.
Production and design staff see orders through money-free views (`production_orders`, `production_order_items`).

### The enum and the role
`profiles.role` (enum `app_role`) stays because `is_staff()`, `has_role()` and the super-admin test are
written against it. People on a system role keep that role's enum value; people on a custom role carry
`staff`. The trigger `profiles_role_sync` keeps `role` and `role_id` in step whichever one is written, so
a seed script or a manual fix cannot leave them disagreeing. `guard_profile_update` protects `role`,
`role_id`, `company_id` and `email`: they change only through the privileged door (`spp.privileged`)
that the RPCs open.

### Rank rules (`assign_role(target, role_key)` — the only way a role changes)
1. The caller needs `can_write('team')` (or is a super admin).
2. **Nobody changes their own role** — including a super admin.
3. The caller's rank must be **strictly greater** than the target's current rank **and** than the rank
   of the role being given. Customers rank 0. A super admin is exempt from the rank test.
4. **Only a super admin** can give `admin` or `super_admin`, or change someone who holds either —
   whatever the ranks say.
5. `role_key = 'customer'` removes staff access (`role_id` null, enum `customer`).
6. A guest session (no email) cannot be given a role.
7. **There is always a super admin.** The last one cannot be demoted or deleted — refused by the
   RPC's own rules and again by triggers on `profiles`, so even SQL run with the privileged flag fails.

`set_user_role(target, enum)` still works and delegates to `assign_role()`; it refuses `staff`.
`is_admin()` is: super admin, or enum `admin`, or `can_write('team')` — it gates the audit log, the
email outbox and editing other people's profile details.

### Who manages roles
| Action | Who |
|---|---|
| `save_role()` — create or change a role, its rank and capabilities | super admin only |
| `delete_role()` — refused for system roles and for roles that still have members | super admin only |
| `assign_role()` — give a role to a person, or remove staff access | `team: edit`, below own rank |
| `list_roles()` — read roles, capabilities and member counts | any staff |
| `my_access()` — own role, rank and capabilities (what the UI renders from) | any signed-in user |
| Read `roles` / `role_capabilities` directly | any staff; **no direct writes for anyone** |

Every change to `roles`, `role_capabilities` and `profiles` lands in `audit_log`.

### How view-only is enforced (the write guards)
Every policy written before 0024 says `can('x')`, which now means *may see x*. Rather than rewrite
some seventy policies, 0024 adds **RESTRICTIVE** policies beside them:

- For each table with a staff write policy, `refresh_write_guards()` creates
  `<table>_wguard_ins`, `_wguard_upd` and `_wguard_del`.
- A guard is the **OR of that table's own permissive write policies**, with `can(` replaced by
  `can_write(` and `is_staff()` by `staff_can_write()`. Postgres ANDs restrictive policies with the
  permissive ones, and `can_write` implies `can`, so the result is exactly *the old policy, but edit
  is required*. Nothing is loosened; owner-row policies are inside the OR unchanged, so customers,
  guests and staff acting on their own designs are untouched.
- Guards are built per command from write policies only, so a domain that may merely *read* a table
  never counts towards writing it (`pricing: view` + `sales: edit` cannot change a pricing rule).
- `notifications` uses `can(<column>)` and is deliberately not guarded: view-only staff can still
  mark a notification read.
- `storage.objects` gets the same guards, so a view-only role cannot upload or delete media. Supabase
  owns that table: if the migration role may not manage its policies the migration raises a warning
  instead of failing — confirm the three `objects_wguard_*` policies exist after applying.
- **RPCs and triggers** are `SECURITY DEFINER`: they run as the table owner, RLS does not apply inside
  them (no table uses `FORCE ROW LEVEL SECURITY` — db-test checks), so their own check is the gate.
  `refresh_write_guards()` rewrites every *volatile* function that calls `can()` to call
  `can_write()`; read-only reports (`attention_summary`, `funnel_summary`) are `STABLE` and keep `can()`.
  `notify_customer()` moves from `is_staff()` to `staff_can_write()`.

Guards are a **snapshot** of the policies they were built from. A migration that adds or changes a
policy, or adds an RPC that writes for staff, must end with `select refresh_write_guards();` (0027
does this for 0025 and 0026). `write_guards_pending()` lists anything stale, and `npm run db:test`
fails while it returns a row. New write RPCs should call `can_write()` directly.

The front end mirrors this only to decide what to render: view-only screens carry a **View only** tag
and their controls are disabled or hidden. Hiding a button is never the control.

## Controls
| Threat | Control | Verified by |
|---|---|---|
| IDOR / cross-customer access | Owner-scoped RLS; RPCs re-check `owner_id = auth.uid()` before attaching a design, responding to a quote, reordering, sharing | db-test “customer isolation”, “IDOR” checks |
| Privilege escalation | `guard_profile_update` trigger; `assign_role()` rank rules; roles writable only through super-admin RPCs; last super admin protected | db-test “RBAC”, “ROLES & HIERARCHY” |
| View-only roles writing | RESTRICTIVE write guards on every staff-writable table and on `storage.objects`; write RPCs check `can_write()` | db-test “ROLES & HIERARCHY”, `write_guards_pending()` |
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

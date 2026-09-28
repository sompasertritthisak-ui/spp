-- ═══════════════════════════════════════════════════════════════════════════
-- 0022 · No bundle discounts
--
-- Client decision (2026-09-28): SPP does not run promotions or discounts.
-- Bundles stay as a convenient way to request several products at once; they
-- carry no saving. No SQL function ever applied bundles.discount_pct — the
-- estimate engine (_price / estimate_price) prices products one by one — so
-- nothing is re-created here. The column stays (the generated types and the
-- Command Center still name it) and is pinned to zero.
--
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

update bundles set discount_pct = 0 where discount_pct <> 0;

-- The database refuses a bundle discount whoever writes the row.
alter table bundles drop constraint if exists bundles_no_discount;
alter table bundles add constraint bundles_no_discount check (discount_pct = 0);

comment on column bundles.discount_pct is 'Always 0. SPP does not offer bundle discounts (client decision 2026-09-28).';

-- Summaries: the seed wording never sold a saving, but a summary edited in the
-- Command Center may. Any that does goes back to the seed text for that bundle.
update bundles b set summary = s.summary
from (values
  ('starter-brand-package',      'Look established from the first day of trading.'),
  ('restaurant-launch-package',  'Uniforms, cups, totes and the sign over the door.'),
  ('corporate-uniform-package',  'Embroidered polos and caps with sizes kept on file for re-orders.'),
  ('event-package',              'Crew shirts, flags, counter and backdrop — delivered together.'),
  ('billboard-campaign-package', 'Three sites, one artwork system, QR tracking on every face.'),
  ('sports-team-package',        'Match kit, training tees and caps for a full squad.')
) as s(slug, summary)
where b.slug = s.slug and b.summary ~* '(saving|discount|% ?off|\msave\M|cheaper|promotion|special offer)';

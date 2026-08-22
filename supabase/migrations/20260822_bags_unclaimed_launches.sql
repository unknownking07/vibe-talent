-- Open bags_launches to launches we have NOT been able to attribute to a
-- VibeTalent builder.
--
-- Until now a row could only exist for a signature-linked wallet, so the table
-- doubled as "launches by our users". The /bags board now also lists launches
-- discovered on Bags itself, which lets a launcher find their own coin sitting
-- unclaimed and gives them a reason to link a wallet. Those rows have no user.
--
-- user_id therefore becomes the claim flag: NOT NULL means a builder proved the
-- launching wallet by signature, NULL means nobody has. Nothing may relax that
-- meaning — every claim the board makes is read off this one column.

ALTER TABLE public.bags_launches
  ALTER COLUMN user_id DROP NOT NULL;

-- Creator identity as Bags reports it, kept for unclaimed rows where we have
-- no profile to render. Never used to attribute a launch to a builder: only a
-- signature-linked wallet may do that.
ALTER TABLE public.bags_launches
  ADD COLUMN IF NOT EXISTS bags_username text;

-- Display + ranking snapshot, so the board renders without one upstream call
-- per row. Refreshed by the discovery cron; treated as indicative, never as a
-- price anyone should act on.
ALTER TABLE public.bags_launches
  ADD COLUMN IF NOT EXISTS token_name text,
  ADD COLUMN IF NOT EXISTS token_symbol text,
  ADD COLUMN IF NOT EXISTS token_image_url text,
  ADD COLUMN IF NOT EXISTS fdv_usd numeric,
  ADD COLUMN IF NOT EXISTS volume_24h_usd numeric,
  ADD COLUMN IF NOT EXISTS market_synced_at timestamptz;

-- The unclaimed board reads "highest volume first", and the claim backfill reads
-- "rows for this wallet". Both scan the whole table without these.
CREATE INDEX IF NOT EXISTS bags_launches_volume_idx
  ON public.bags_launches (volume_24h_usd DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS bags_launches_creator_wallet_idx
  ON public.bags_launches (creator_wallet);

-- RLS is unchanged and still correct: public read, no client write policy. A
-- client-writable row here would let anyone award themselves a launch, and now
-- that user_id is nullable it would also let them claim someone else's.

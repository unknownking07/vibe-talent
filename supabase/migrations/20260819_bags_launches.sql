-- Bags launches, cached per builder.
--
-- Bags is an upstream we do not control, so profile rendering must never depend
-- on a live call to it. The resolver writes here; the profile reads only this
-- table.
--
-- Rows are only ever written for launches CONFIRMED by the Bags creator record
-- (see fetchCreatedLaunches in lib/bags.ts). Holding fee-share authority over a
-- token is not the same as having launched it, and crediting a builder with a
-- launch they did not make would undermine the one thing this product sells.

CREATE TABLE IF NOT EXISTS public.bags_launches (
  token_mint       text PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- The wallet Bags names as creator. Kept so a later audit can re-verify
  -- without guessing which of a user's wallets was responsible.
  creator_wallet   text NOT NULL,
  -- Verified X handle Bags holds for the creator; null when it has none.
  twitter_username text,
  -- Creator's fee share in basis points, as Bags reports it.
  royalty_bps      integer NOT NULL DEFAULT 0,
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz NOT NULL DEFAULT now()
);

-- The profile query is "every launch by this builder".
CREATE INDEX IF NOT EXISTS bags_launches_user_id_idx
  ON public.bags_launches (user_id);

ALTER TABLE public.bags_launches ENABLE ROW LEVEL SECURITY;

-- Public read: this is a credibility signal, it is meant to be seen.
DROP POLICY IF EXISTS "bags_launches_public_read" ON public.bags_launches;
CREATE POLICY "bags_launches_public_read"
  ON public.bags_launches FOR SELECT USING (true);

-- No client write policy at all. Only the resolver, running with the service
-- role, may write — a client-writable row here would let anyone award
-- themselves a launch, which is precisely the claim being verified.

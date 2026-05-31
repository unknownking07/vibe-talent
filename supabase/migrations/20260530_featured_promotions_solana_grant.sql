-- Solana / $VIBE payments phase.
--
-- The featured grid now renders Solana promotions DIRECTLY from
-- featured_promotions (not just as EVM authorizations), so the anon SELECT
-- grant must include the columns the render reads. Additive + editor-safe.
-- (Table, RLS, replay index, and the base grant shipped in
-- 20260530_featured_promotions.sql.) user_id / tx_ref / paid_amount stay
-- service-role only.

grant select (project_id, promoter_wallet, chain, package_id, expires_at, created_at)
  on public.featured_promotions to anon, authenticated;

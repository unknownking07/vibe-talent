-- Featured-promotion ownership authorization (audit finding #8).
--
-- The on-chain promote(string projectId, ...) call accepts an arbitrary
-- projectId, so a payer can pay to feature a project they don't own. We record
-- an authorization when a project's OWNER promotes it (server-enforced), and the
-- featured grid renders only on-chain promotions that have a matching
-- authorization. Forward-compatible with the upcoming Solana payments phase
-- (the chain / tx_ref / package_id / paid_amount / expires_at columns).
--
-- Editor-safe: plain statements, no DO/$$ blocks.

create table if not exists public.featured_promotions (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  promoter_wallet text not null,                  -- lowercased EVM addr / Solana base58
  chain           text not null default 'base',   -- 'base' | 'solana'
  tx_ref          text,                           -- EVM tx hash / Solana signature
  package_id      smallint,                       -- tier (Solana); EVM optional
  paid_amount     bigint,                         -- USDC base units (Solana)
  expires_at      timestamptz,                    -- Solana: computed; EVM: null (contract owns expiry)
  created_at      timestamptz not null default now()
);

-- Replay protection + ON CONFLICT (tx_ref) upsert target. Plain (non-partial)
-- unique index: Postgres treats NULLs as distinct, so multiple null tx_refs are
-- allowed while non-null signatures/hashes stay unique.
create unique index if not exists featured_promotions_txref_uniq
  on public.featured_promotions (tx_ref);
create index if not exists featured_promotions_membership
  on public.featured_promotions (project_id, promoter_wallet);
create index if not exists featured_promotions_solana_render
  on public.featured_promotions (chain, expires_at);

alter table public.featured_promotions enable row level security;

-- Writes are service-role only (the /api/promotions endpoint, after a server-side
-- owner check) — so an authorization can't be forged via the public anon key.
grant all on public.featured_promotions to service_role;

-- The render path needs only (project_id, promoter_wallet) — both already public
-- on-chain. Grant SELECT on just those two columns; no INSERT/UPDATE/DELETE.
revoke all on public.featured_promotions from anon, authenticated;
grant select (project_id, promoter_wallet) on public.featured_promotions to anon, authenticated;

drop policy if exists "Promotion authorizations are publicly readable" on public.featured_promotions;
create policy "Promotion authorizations are publicly readable"
  on public.featured_promotions for select using (true);

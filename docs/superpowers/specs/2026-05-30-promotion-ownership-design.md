# Featured-Promotion Ownership Verification — Design

- **Date:** 2026-05-30
- **Status:** Approved (design phase)
- **Origin:** Security audit finding #8

## Problem

The on-chain `promote(string projectId, string projectName, uint8 package_, uint256 maxPrice)`
contract (Base, `0x2cDB438f418f5cb53e8Ea87cFD981397FDe3d0da`) accepts an **arbitrary**
`projectId` string. `enrichPromotions` (`src/lib/featured-promotions.ts`) renders the
featured grid by reading the contract's `getActivePromotions()` and looking each
`projectId` up in the `projects` table, attributing the promotion to that project's real
owner — **with no check that the on-chain `promoter` wallet owns the project**.

An attacker can therefore pay to feature **any** project (e.g. a competitor's), rendered
attributed to the victim. The displayed title/author come from the real project row (so
it is not defacement), but it lets a payer hijack any project's featured slot.

**Constraints:**
- The payment contract is deployed and its source is **not in this repo** → we fix on the **read side**.
- There is **no wallet→user mapping** stored; project ownership lives off-chain in Supabase.
- The grid is currently rendered purely from the contract.
- **0 active on-chain promotions** right now (verified) → no backfill needed.

## Approach — read-side authorization (Approach A)

Record an **authorization** when a logged-in user promotes *their own* project, then render
only the on-chain promotions that have a matching authorization. Because only the project's
owner can create an authorization (server-enforced), a hijacker's promotion has no
authorization and is **hidden**.

## Data model

New table `public.featured_promotions` — schema is **forward-compatible** with the upcoming
Solana payments phase (Solana-only columns are nullable and unused by #8):

```sql
create table public.featured_promotions (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  promoter_wallet text not null,                 -- lowercased EVM addr / Solana base58
  chain           text not null default 'base',  -- 'base' | 'solana'
  tx_ref          text,                          -- EVM tx hash / Solana signature
  package_id      smallint,                      -- tier (Solana); EVM optional
  paid_amount     bigint,                        -- USDC base units (Solana)
  expires_at      timestamptz,                   -- Solana: computed; EVM: null (contract owns expiry)
  created_at      timestamptz not null default now()
);
create unique index featured_promotions_txref_uniq
  on public.featured_promotions (tx_ref) where tx_ref is not null;   -- replay protection
create index featured_promotions_membership
  on public.featured_promotions (project_id, promoter_wallet);        -- EVM lookup
create index featured_promotions_solana_render
  on public.featured_promotions (chain, expires_at);                  -- Solana (later)
```

- **#8 (EVM) writes:** `project_id, user_id, promoter_wallet, chain='base', tx_ref`.
- **Solana phase (later) writes:** `chain='solana', package_id, paid_amount, expires_at, tx_ref=signature`.

**RLS (matches the 2026-05-30 hardening posture):**
- `ENABLE ROW LEVEL SECURITY`.
- **No INSERT policy** → only the service-role endpoint can write. *Critical:* if anon/authenticated could insert, an attacker could forge their own authorization.
- **SELECT** `USING (true)` + **column grant to `anon, authenticated` for only `(project_id, promoter_wallet)`** — exactly the two values the render needs, and both are already public on-chain. `user_id` / `tx_ref` / `paid_amount` stay service-role-only.

## Write path — `POST /api/promotions` (new, authenticated)

1. Require a Supabase session → `401` otherwise.
2. Body `{ project_id, wallet_address, tx_ref, chain }`. Validate: `project_id` is a UUID, `wallet_address` matches `0x[0-9a-fA-F]{40}`, `chain ∈ {'base'}`.
3. **The gate:** load the project with the admin client; require `project.user_id === session.user.id` → else `403`. Only the real owner can authorize a promotion of their project.
4. Upsert `featured_promotions { project_id, user_id, promoter_wallet: wallet_address.toLowerCase(), chain, tx_ref }` with the admin client; idempotent via the unique `tx_ref` index.
5. Return `200 { ok: true }`.

**Client:** `feature-your-project-card.tsx` — `handlePromoteEVM` returns its `txHash`; `handlePromote` POSTs the authorization as soon as the hash is known (before/independent of confirmation, so a UI hiccup can't drop the record). One retry on failure + a "finalizing…" toast.

## Read path — `enrichPromotions` (the fix)

1. Alongside the existing project/user lookups, fetch `featured_promotions(project_id, promoter_wallet)` for the on-chain `projectIds` (`.in('project_id', projectIds)`).
2. Build a `Set` of `` `${project_id}:${promoter_wallet.toLowerCase()}` ``.
3. Extract a **pure helper** `filterAuthorizedPromotions(promotions, authSet)` that drops any promotion whose `` `${projectId}:${promoter.toLowerCase()}` `` is not in the set.
4. Return only authorized + enriched promotions. (Contract promoters already come back lowercase; we store lowercase — match is case-normalized on both sides.)

## Error handling

- Hijack / unrecognized payer → **hidden**.
- `enrichPromotions` currently **fails open** (returns promotions with `null` project/author on error). Flip to **fail closed**: on any verification/load error, return `[]`. Promotions are non-critical UI, so hiding-on-error is the safe choice.
- Auth `POST` failure → one retry + toast; worst case the promo is briefly hidden until recorded.

## Testing

- **Unit** (`filterAuthorizedPromotions`): authorized shows · hijack hidden · case-insensitive wallet match · unknown `projectId` hidden · empty auth-set hides all.
- **Endpoint ownership gate:** owner → `200`, non-owner → `403`, anonymous → `401`.

## Scope / non-goals

- **No backfill** (0 active on-chain promotions).
- **Solana payments/registry** deferred to the next spec — the table is forward-compatible.
- **On-chain tx verification deliberately out of scope:** a forged authorization with no real on-chain promotion renders nothing (the grid still gates on `getActivePromotions()`), so the ownership gate alone is sufficient. Optional future hardening.

## Files touched

- `supabase/migrations/20260530_featured_promotions.sql` (new)
- `src/app/api/promotions/route.ts` (new)
- `src/lib/featured-promotions.ts` (verification + pure helper)
- `src/components/ui/featured/feature-your-project-card.tsx` (return `txHash`, POST authorization)
- `src/lib/__tests__/featured-promotions.test.ts` (new)
- `src/lib/types/database.ts` (add `featured_promotions` types; optional, `as any` acceptable per existing patterns)

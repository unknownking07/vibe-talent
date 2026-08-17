# Solana + $VIBE Payments for Featured Promotions — Design

*Date: 2026-05-30 · Status: Approved (design) · Builds on: #8 `featured_promotions` (PR #202)*

## Goal & scope

Accept **Solana payments** for Featured Promotions, in **USDC** and the project's own **$VIBE** token, in one increment. Re-enables the Solana lane that #9 disabled — but only behind real server-side verification, since (unlike Base) there's no Solana contract acting as the registry. Our backend becomes the registry via the existing `featured_promotions` table.

**Out of scope (next builds):** streak-restore via $VIBE (rule unresolved), daily exercise, bug-bounty.

## Key facts (from the payments roadmap)

- **$VIBE mint:** `FfDYT3WqimMw7itMxw4kYJ26GPG78RfpZmepQCFpBAGS` (9 decimals). NOT on Jupiter → price via **GeckoTerminal** `attributes.price_usd` (cache ~60s; ~$0.000003 on 2026-05-30).
- **USDC mint (Solana):** `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (6 decimals).
- **Receiving wallet:** `DYp2cUmgoBEYPxN9xPwiqKZoi5WR4SRAWJnLD1d5QAdT`.
- **Canonical prices:** the Base contract's `getPrices()` (selector `0xbd9a548b`) returns USD package prices as USDC base units. Packages: 0 Day · 1 3-day ($5, hidden) · 2 Week ($10) · 3 Month ($29) · 4 Annual=Lifetime ($199).
- **Slippage floor:** accept if `paid ≥ 90%` of expected.

## 1. Verify endpoint — `POST /api/solana/verify` (authenticated)

Request `{ project_id: uuid, signature: string, package_id: 0..4, token: 'usdc' | 'vibe' }`.

1. **Auth** — require session (401 otherwise).
2. **Owner gate** — load project (admin client); `project.user_id === session.user.id` else 403. (Same gate as EVM.)
3. **Replay** — reject if `signature` already exists in `featured_promotions.tx_ref` (409).
4. **Fetch tx** — Solana RPC `getParsedTransaction(signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0 })`. 404 if not found / not finalized.
5. **Assert all:**
   - `meta.err === null` (succeeded).
   - **Amount via balance delta** (robust against instruction shape): from `meta.preTokenBalances`/`postTokenBalances`, find the receiving wallet's ATA for `mint` and require `delta ≥ expectedBaseUnits * 0.90`. `mint` = USDC or $VIBE per `token`.
   - This delta check inherently proves: correct mint, correct destination, and sufficient amount in one shot.
6. **Expected amount:**
   - `usdPrice = getPricesCached()[package_id]` (USDC base units, 6dp) — read from the Base contract server-side, cached.
   - `token === 'usdc'` → `expected = usdPrice` (6dp).
   - `token === 'vibe'` → `expected = round( (usdPrice / 1e6) / vibeUsd * 1e9 )` where `vibeUsd = geckoTerminalVibePriceCached()`. Guard `vibeUsd > 0`.
7. **Record** — insert `featured_promotions` row: `{ project_id, user_id, promoter_wallet: sender, chain: 'solana', tx_ref: signature, package_id, paid_amount: delta, expires_at }`. Idempotent on `tx_ref`.
8. Response `{ ok: true }`.

## 2. Expiry

`expires_at = now + { 0:1d, 1:3d, 2:7d, 3:30d }[package_id]`; package **4 = lifetime → `null`**. Mirrors the contract.

## 3. Render — `enrichPromotions` becomes a union

- **EVM (unchanged):** on-chain `getActivePromotions()` ∩ matching authorization rows.
- **Solana (new):** load `featured_promotions` where `chain='solana'` AND (`expires_at IS NULL OR expires_at > now`); map each to the `EnrichedPromotion` shape (project + author join, `expiresAt` from the row).
- **Union** both, dedupe, sort (e.g., by `paid_amount` desc then recency), return. Still **fails closed** on error.

## 4. Client — `feature-your-project-card.tsx`

- Revert #9: add `solana` back to `SUPPORTED_CHAINS`.
- Solana lane gets a **USDC / $VIBE token toggle**; for $VIBE show the live amount (`usd / vibeUsd`) via a small price fetch.
- After `privySignAndSend` returns the signature, **`POST /api/solana/verify`** with `{ project_id, signature, package_id, token }`. Replace the no-op `confirmSolanaTransaction` success path: only show "featured!" after the server confirms.

## 5. Migration (additive, editor-safe)

Widen the anon `SELECT` grant on `featured_promotions` to the render columns:
`GRANT SELECT (project_id, promoter_wallet, chain, package_id, expires_at) ON public.featured_promotions TO anon, authenticated;`
(Table + replay index already shipped in #8.)

## 6. Security considerations

- **Memo binding (added during implementation):** a bare Solana transfer isn't
  tied to a project, so the payer stamps `project_id` into the tx memo and the
  server requires it (`extractMemos`). Without it, an attacker could grab a
  victim's payment signature off-chain and submit it for their own project
  before the victim does (front-running the verify). The memo is inside the
  signed tx → unforgeable onto someone else's payment. A `/api/solana/quote`
  endpoint and `confirmed`-commitment + client retry were also added.
- **Owner gate** prevents promoting projects you don't own (same as #8).
- **Replay** prevented by unique `tx_ref` + pre-check.
- **Price-feed manipulation:** $VIBE is thinly traded, but the buyer pays for *their own* promotion, so manipulating the price *down* only underpays for their own feature — low incentive. The 90% floor + `vibeUsd > 0` sanity guard + 60s cache bound the exposure. (Note for future: add a sanity band if abuse appears.)
- **Stale price:** cache 60s; if GeckoTerminal fails, the $VIBE path errors (no grant) rather than guessing.
- **Service-role writes only** on `featured_promotions` (no forged rows).

## 7. Testing

Pure, unit-tested helpers: `expectedTokenAmount(usdPrice, token, vibeUsd)`, `passesSlippage(paid, expected)`, `expiresAtFor(package_id, now)`, `pickReceivedDelta(pre, post, receivingAta, mint)`. Endpoint gate tests (401/403/409). Render-union merge test.

## 8. Rollout

Apply the additive migration, deploy, then the Solana lane is live. EVM unaffected throughout. The `20260530_featured_promotions.sql` (#8) must already be applied.

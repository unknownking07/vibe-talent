# $VIBE Utility — Burn-to-Vouch, Streak Protect, Holder Tiers, /token

**Date:** 2026-08-11
**Status:** Approved design, pending implementation plan
**Roadmap:** Q2 "$1 Streak Protect", Q3 "Stake-to-Vouch Profiles"

## Goal

Give $VIBE reasons to be **bought and held**, not just spent. Ship the two roadmap
items, plus the missing surface that makes the token findable at all (contract
address + buy link).

The organizing principle: spend-only utility is net sell pressure — tokens flow
user → treasury and the treasury eventually sells. So every new $VIBE action here
**burns** instead. No treasury wallet is involved in any flow in this spec, which
also means no custody, no hot key, no hack surface.

| Layer | Mechanic | Supply effect |
| --- | --- | --- |
| Burn | Streak protect, vouch | Permanently destroyed |
| Hold | Balance-gated free freezes | Locked in user wallets |

## On-chain reality (measured 2026-08-11)

| | |
| --- | --- |
| Mint | `FfDYT3WqimMw7itMxw4kYJ26GPG78RfpZmepQCFpBAGS` (9 decimals) |
| Price | $0.000002406 |
| Supply | 998,079,152 $VIBE |
| FDV / mcap | $2,402 |
| Liquidity | ~$2,375 — Meteora DBC (bonding curve) via Bags |
| 24h volume | $51.78 across 4 trades |
| Jupiter | **Not routable** (`TOKEN_NOT_TRADABLE`) |
| Buy venue | `https://bags.fm/FfDYT3WqimMw7itMxw4kYJ26GPG78RfpZmepQCFpBAGS` (verified 200) |

Consequences that shape the design:

1. **No swap widget is possible.** Jupiter can't route it, so the buy path is an
   outbound link to Bags, with DexScreener for charting.
2. **Amounts are USD-denominated but frozen at burn time.** USD is what users
   understand; freezing the value on burn gives it the immutability that stops a
   builder's score drifting with the token price. Thin liquidity also caps
   sensible amounts — at $2,375 in the pool, a $100 order is ~4% of it, so the
   $25 per-voucher weight cap doubles as a nudge away from orders that would
   move the price against the buyer.
3. **This is token bootstrapping, not revenue.** At $2.4k FDV, $1 sinks across
   194 users are rounding error. The deliverable is the first real holders, a
   working demo, and a coherent token story.

## Existing infrastructure reused

Nothing here is greenfield. The Solana rail already works:

- `POST /api/solana/verify` — replay check on signature, memo binding, balance-delta
  verification, 90% slippage floor.
- `GET /api/solana/quote` — prices a USD amount in $VIBE via GeckoTerminal
  (`fetchVibeUsdCached`), same source the verifier uses.
- `src/components/ui/featured/feature-your-project-card.tsx` — Privy wallet UI that
  already signs $VIBE transfers on Solana.
- `update_user_streak(uuid)` — `SECURITY DEFINER`, recomputes `streak` **and**
  `vibe_score` entirely in SQL. Fired by triggers on `streak_logs`.
- `reset-streaks` cron — consumes a freeze by upserting a **synthetic `streak_logs`
  row for the missed day**, so the chain stays unbroken. Streak restore is the
  same mechanism.
- `reset-freezes` cron — restores `streak_freezes_remaining = 2` on the 1st of
  each month.

Available dependencies: `@noble/curves` (ed25519, Workers-safe), `bs58`,
`@solana/spl-token` (`createBurnCheckedInstruction`), `@upstash/redis`.

> `@noble/curves` is currently only a **transitive** dependency. Add it to
> `package.json` explicitly before relying on it.

## Architecture: the burn primitive

Burning needs no recipient, so `buildSolanaTokenTransfer` gains a sibling
`buildSolanaTokenBurn` using `createBurnCheckedInstruction` against the payer's
own ATA, plus the same memo instruction for action binding.

### Verifying a burn

Do **not** parse `burn` / `burnChecked` instructions. Their `jsonParsed` shape
could not be confirmed against a live transaction (a 120-transaction sample
across USDC and BONK surfaced only `transfer` / `transferChecked`), and guessing
field names risks a silent verification failure on a payment path.

Verify the **conservation invariant** instead:

```
netDelta = Σ postTokenBalances[mint] − Σ preTokenBalances[mint]   (all owners)
burn confirmed  ⟺  netDelta ≤ −expectedAmount
```

A transfer conserves the total across the touched accounts and nets to zero. Only
destruction goes negative. This is a direct sibling of the existing
`pickReceivedDelta` in `src/lib/promotion-pricing.ts`, with no shape assumptions.

Edge cases, all handled by the same invariant:
- ATA created in-transaction — appears in `post` only; a transfer still nets zero.
- Burn-then-close-account — the account is absent from `post`; the delta correctly
  reflects the burn.
- Mixed transfer + burn in one transaction — the net still measures destruction.

Every burn flow keeps the existing guards: signature uniqueness (replay), memo
binding, and a slippage floor for USD-priced amounts.

### Memo format — must name the actor, not just the target

The featuring flow stamps only `project_id` into the memo, which is safe there
because the endpoint separately gates on "you own this project". Burns have no
such natural owner gate, so the memo must bind **both sides**:

```
vouch:<voucher_user_id>:<builder_user_id>
protect:<user_id>:<break_date>
```

With a target-only memo, user A could submit user B's already-broadcast burn
transaction and be credited as the voucher. Naming the actor in the signed memo
closes that: the server rejects any burn whose memo actor is not the authenticated
caller. Replay by the *same* user is separately blocked by `UNIQUE (tx_ref)`.

---

## 1. Verified wallet link (foundation)

Required by holder tiers and by vouch attribution. Nothing balance-gated works
without it.

**Flow**
1. `GET /api/wallet/nonce` — server generates a nonce, stores it in Upstash Redis
   with a 5-minute TTL keyed by user id.
2. Client signs the message with the Privy Solana wallet.
3. `POST /api/wallet/link { address, signature }` — server verifies ed25519 via
   `@noble/curves`, consumes the nonce, binds the wallet.

**Columns on `users`** (all admin-write only):

| Column | Type | Purpose |
| --- | --- | --- |
| `solana_wallet` | `text` | Linked address |
| `solana_wallet_verified_at` | `timestamptz` | When ownership was proven |
| `vibe_balance` | `bigint` | Cached balance, base units |
| `vibe_balance_at` | `timestamptz` | Cache timestamp |

**Security requirements — both non-negotiable:**

- **`UNIQUE` index on `solana_wallet`.** Without it one funded wallet grants
  holder perks to unlimited accounts.
- **These columns must stay out of the client `UPDATE` grant**, same lockdown as
  `vibe_score` (see `20260529_security_hardening_rls.sql`). If a client can write
  `vibe_balance`, holder tiers are free. Writes go through the admin client only.

Balance is refreshed on demand (60s cooldown) when the user loads `/token` or the
dashboard, and once inside `reset-freezes` on the 1st when allowances are computed.
No new cron — which also avoids the `WORKER_SELF_REFERENCE` fan-out trap.

## 2. Streak protect

Burn ~$1 of $VIBE to restore a broken streak.

**Mechanism.** Insert synthetic `streak_logs` rows for each missing day between the
last real activity and yesterday, then let `update_user_streak()` recompute. This
is exactly what the freeze path in `reset-streaks` already does.

**Capturing the break.** The reset cron currently sets `streak = 0` and discards the
prior value. Add to `users`:

| Column | Type |
| --- | --- |
| `streak_broken_at` | `timestamptz` |
| `streak_before_break` | `integer` |

**Guards**

| Guard | Value | Reason |
| --- | --- | --- |
| Grace window | 48h from `streak_broken_at` | Bounded offer, urgency |
| Gap cap | ≤ 2 missed days | Can't buy back a week |
| Rate cap | 2 paid restores / calendar month | Streak stays a signal |
| Minimum streak | `streak_before_break >= 3` | No farming $1 restores on 1-day streaks |

**Provenance.** Add `source` to `streak_logs`: `'activity' | 'freeze' | 'restore'`,
default `'activity'`, existing rows backfilled to `'activity'`.

Today synthetic freeze rows are indistinguishable from real GitHub activity, which
is a quiet integrity hole in the reputation data. With `source`, protected days
render distinctly in the heatmap — honest, auditable, and visually better.

## 3. Vouch by burning $VIBE

Burn any amount of $VIBE behind a builder. Public, permanent, irreversible.

**Two separate concerns, deliberately decoupled:**

- **Trust display — uncapped.** Total $VIBE burned behind a builder, backer count,
  and top backers all render in full. This is the feature. Burn 100M and it shows.
- **`vibe_score` contribution — capped hard.** A nudge, not a rank purchase.

**Weight**

The voucher chooses a **USD amount**; the client quotes it to $VIBE at burn time
via the existing `/api/solana/quote` path. Both values are recorded, and weight is
computed from the USD value **frozen at burn time** — never re-evaluated, so a
builder's score cannot move when the token price does.

```
weight      = floor( sqrt(usd_at_burn) × credibility )
credibility = voucher_vibe_score < 20  →  0        (display-only, no score weight)
              otherwise 0.5 + 0.5 × min(voucher_vibe_score / 200, 1)   → 0.5× … 1.0×
per-voucher cap = 5 pts        per-profile cap = 25 pts
minimum vouch   = $2
```

| Burned | Points (credibility 1.0) |
| --- | --- |
| $2 | 1 |
| $5 | 2 |
| $10 | 3 |
| $25+ | 5 (capped) |

USD denomination is the product decision — "$5" is legible in a way "2,078,000
tokens" is not — and freezing at burn time gives it the same immutability that
token-denomination would have. Maxing a profile takes 5 credible backers at $25:
**$125 of supply permanently destroyed** for +25 points.

**The `vibe_score < 20` credibility floor is the Sybil defence.** Without it, ~25
throwaway accounts burning $4 each (~$100) could max a profile. With it, a
throwaway account's burn still appears in the public display — honest, it did
happen — but contributes zero to the score. Buying rank requires accounts that
already earned score through real work, which is the expensive part.

**Calibration against live data.** `vibe_score` distribution across 194 users:
median 44, p75 108, p90 181, p99 540, max 718. A +25 ceiling moves a median
builder to 69 — a visible nudge that does not cross p75 — and is negligible at the
top of the leaderboard. Maxing a profile takes 5 credible backers burning ~11M
each: **~5.5% of total supply destroyed for +25 points.** Large burn, bounded
effect.

A fresh account's burn is worth half a established builder's via `credibility`,
which is the Sybil defence: buying influence requires accounts that already earned
score through work.

**Rules**
- No self-vouching.
- One active vouch per (voucher, builder) pair; re-vouching adds to the total.
- **No expiry.** The tokens are destroyed permanently, so the trust is permanent.
  Recency is surfaced in the UI ("backed 8 months ago") without affecting score.
  The per-profile cap is what bounds accumulation.

**Table `vouches`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` pk | |
| `voucher_id` | `uuid` → users | |
| `builder_id` | `uuid` → users | |
| `vibe_burned` | `bigint` | Base units, exact — drives the uncapped display |
| `usd_at_burn` | `numeric` | Frozen at burn time — drives the capped score weight |
| `tx_ref` | `text` unique | Replay protection |
| `created_at` | `timestamptz` | |

Both are recorded. `usd_at_burn` is written once and never recomputed, so weight
is stable for the life of the vouch. `vibe_burned` is the exact destroyed amount
and feeds the public display and the site-wide burn counter.

**Scoring integration.** The vouch term goes into the `update_user_streak()` SQL
function — **not** into `calculateVibeScore()` in `src/lib/streak.ts`. Those two
have already drifted (TS uses `min(quality_score/10, 10)` per project where the SQL
uses `2 + live_url×2 + github×2 + LEAST(quality_score, 100)`). Fixing that drift is
out of scope here; see Out of scope.

**Profile UI.** A "Backed by" block: backer avatars, total $VIBE burned, total USD
equivalent, and each backer's amount.

## 4. Burn confirmation UX

Burning is irreversible and involves real money, so the interface has to make the
consequence unmissable *before* the wallet opens. Users arriving from a hiring
marketplace should not be assumed to know what "burn" means on-chain — the most
likely misconception is that the tokens go to the builder, or to VibeTalent.

**Vouch flow — two steps, never one.**

*Step 1 — choose amount.* USD presets ($2 / $5 / $10 / $25) plus a custom field.
Live conversion shown beneath: `$5.00 ≈ 2,078,000 $VIBE`. Also shows what the
builder gains: `+2 vibe score`, and that per-voucher weight caps at $25 so nobody
overspends expecting more score than they can get.

*Step 2 — confirm the burn.* A distinct panel, not a one-line checkbox tacked onto
step 1:

> **This burn is permanent**
>
> You're about to destroy **2,078,000 $VIBE** (≈ $5.00) forever.
>
> **Nobody receives these tokens** — not VibeTalent, not @karan. They're removed
> from the total supply permanently.
>
> In return: @karan gets **+2 vibe score**, and you appear publicly as a backer
> on their profile.
>
> This cannot be undone, reversed, or refunded.

- Required checkbox: *"I understand these tokens will be destroyed and cannot be
  recovered."* Unchecked by default; the action button stays disabled until ticked.
- The action button names the destructive act — **"Burn 2,078,000 $VIBE"** — not
  "Confirm" or "Continue", and uses destructive styling.
- Back button returns to step 1 without penalty.

**Streak protect** is lower-stakes but equally irreversible, so it gets the same
treatment in a single compacted step: the exact token amount, "permanently
destroyed, nobody receives them", what it restores (`your 34-day streak`), and a
button reading **"Burn X $VIBE"**.

**Post-burn**, both flows show the destroyed amount with a Solscan link to the
transaction, so the burn is independently verifiable rather than merely asserted.

**Copy rule for the whole feature:** never write "spend", "pay", "stake" or "send"
for a burn. It is destroyed. Use "burn" or "destroy" everywhere, including the
`/token` page, notifications and emails, so no surface implies recoverability.

## 5. Holder tier → free freezes

The only holder perk in this pass, and it needs no new mechanic: **holding raises
the free freeze allowance** that `reset-freezes` already writes on the 1st.

| Tier | Hold | Free freezes / month |
| --- | --- | --- |
| — | $0 | 2 *(unchanged)* |
| Backer | $10+ | 3 |
| Patron | $40+ | 4 |

USD-denominated per product decision. **Volatility guard:** at $2.4k mcap a single
$20 trade moves price ~30%, so the tier is evaluated **once, on the 1st, at grant
time**, and the allowance holds for the whole month regardless of subsequent price
movement. No mid-month flickering.

`reset-freezes` gains a per-user allowance lookup: refresh `vibe_balance`, multiply
by the cached $VIBE price, pick the tier, write 2 / 3 / 4.

Capping the top tier at 4 keeps streak integrity defensible: worst case is 4 free
plus 2 paid protections in a month, all visibly marked in the heatmap via
`streak_logs.source`.

## 6. `/token` page, contract address, buy link

The CA currently appears only in `llms.txt`, `roadmap/page.tsx` and
`chains-config.ts`. There is no human-facing surface for it at all.

**New route `/token`:**
- Contract address with a copy button.
- Live price / mcap / supply from GeckoTerminal, server-cached.
- **"Buy on Bags"** primary CTA → `bags.fm/FfDYT3Wq…`. DexScreener secondary.
  No swap widget — Jupiter cannot route this token.
- The burn / hold explainer.
- Holder tier table.
- Connected user's balance and current tier.
- **Live burn counter** — total $VIBE destroyed across vouches and restores,
  summed from the database and verifiable on-chain. The strongest single argument
  for holding.

**Also:** contract address in the footer; JSON-LD via the `jsonLdHtml` helper
(never raw interpolation); `sitemap.ts` entry; `llms.txt` mention. The site
currently ranks for nothing on "$VIBE token", so this page is also an SEO/AEO win.

## Data model summary

New migration adds:

- `users` — `solana_wallet` (unique), `solana_wallet_verified_at`, `vibe_balance`,
  `vibe_balance_at`, `streak_broken_at`, `streak_before_break`.
- `streak_logs` — `source` enum column, default `'activity'`, backfilled.
- `vouches` — new table, RLS enabled.
- `update_user_streak()` — replaced, adding the capped vouch term.

**Migration requirements:**
- Every table reference inside the function must be schema-qualified (`public.x`);
  Supabase empties `search_path` for `SECURITY DEFINER` functions.
- RLS on `vouches`: public `SELECT` (vouches are public by design), no client
  `INSERT`/`UPDATE`/`DELETE` — writes come from the verified burn endpoint via the
  admin client only.
- The migration must be `db push`-ed to take effect.

## Security model

| Risk | Mitigation |
| --- | --- |
| Replay a burn tx for multiple grants | `UNIQUE` on `tx_ref`, checked before grant |
| Claim someone else's burn | Signed memo names the actor; server rejects mismatches |
| Fake a balance to get holder perks | `vibe_balance` is admin-write only, outside the client grant |
| One wallet farming perks across accounts | `UNIQUE` index on `solana_wallet` |
| Buy leaderboard rank | Per-profile cap 25, credibility weighting, no self-vouch |
| Buy an unbroken streak | Gap ≤ 2 days, 2 paid/month, ≥3-day minimum, marked in heatmap |
| Custody / hot wallet compromise | **No treasury wallet in any flow — burns only** |

## Out of scope

- **The existing featuring flow still pays the treasury** rather than burning.
  Making "every $VIBE spend burns" universal would be a cleaner story but removes
  the only revenue line — a product decision, not a technical one.
- **SQL / TypeScript scoring drift** between `update_user_streak()` and
  `calculateVibeScore()`. Real, pre-existing, and worth its own change.
- Hire-flow perks (0% platform fee, early gig access) — deferred; the hire flow
  has 2 rows in production, so those perks would be promises, not features.
- Refundable staking via an Anchor program. Burning supersedes it.

## Open questions

None blocking. Three calibration values are deliberately configurable constants,
expected to be tuned once there is real usage to tune against:

- Holder tier thresholds — $10 / $40.
- Vouch caps — 5 per voucher, 25 per profile.
- The `vibe_score >= 20` credibility floor for a vouch to carry any weight.

All three are pure numbers in one config module, changeable without touching the
burn, verification or scoring logic.

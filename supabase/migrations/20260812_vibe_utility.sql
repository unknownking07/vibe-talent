-- $VIBE burn utility: wallet linking, streak protect, burn-to-vouch, holder tiers.
--
-- Spec: docs/superpowers/specs/2026-08-11-vibe-utility-design.md
-- Plan: docs/superpowers/plans/2026-08-11-vibe-utility.md
--
-- SAFETY: this runs against the SAME database production uses (the staging
-- Worker shares it). Everything here is additive, and the one behavioural
-- change — the vouch term in update_user_streak() — contributes exactly 0 while
-- `vouches` is empty, so every existing vibe_score is unchanged on apply.
-- See the COALESCE note on the vouch term; that property is not automatic.
--
-- Editor-safe: plain statements, function body is the only $$ block.
--
-- APPLIED to production 2026-08-12 as remote version 20260812091048.
-- Verified on apply: all 194 users recomputed, 190 byte-identical. The 4 that
-- moved (diob, xsidd, makimakiver, beastincarnate) each dropped to the
-- baseline 10 because their stored scores were STALE — all four have zero
-- projects, endorsements, reviews and contributions, so 10 was already their
-- correct value. No scoring behaviour changed.

-- ── 1. Wallet linking + cached balance ──

alter table public.users add column if not exists solana_wallet text;
alter table public.users add column if not exists solana_wallet_verified_at timestamptz;
alter table public.users add column if not exists vibe_balance bigint not null default 0;
alter table public.users add column if not exists vibe_balance_at timestamptz;

-- One wallet, one account. Without this a single funded wallet grants holder
-- perks to unlimited accounts.
create unique index if not exists users_solana_wallet_key
  on public.users (solana_wallet) where solana_wallet is not null;

-- ── 2. Streak break capture ──
-- The reset cron currently sets streak = 0 and discards the prior value, so
-- there is nothing for a paid restore to bring back.

alter table public.users add column if not exists streak_broken_at timestamptz;
alter table public.users add column if not exists streak_before_break integer;

-- ── 3. Streak log provenance ──
-- Synthetic freeze rows are today indistinguishable from real GitHub activity.
-- Marking them makes the heatmap honest and the reputation data auditable.

alter table public.streak_logs add column if not exists source text not null default 'activity';
alter table public.streak_logs drop constraint if exists streak_logs_source_check;
alter table public.streak_logs add constraint streak_logs_source_check
  check (source in ('activity', 'freeze', 'restore'));

-- ── 4. Vouches ──

create table if not exists public.vouches (
  id           uuid primary key default gen_random_uuid(),
  voucher_id   uuid not null references public.users(id) on delete cascade,
  builder_id   uuid not null references public.users(id) on delete cascade,
  vibe_burned  bigint not null,          -- base units destroyed; drives the uncapped public display
  usd_at_burn  numeric(12,2) not null,   -- frozen at burn; drives the capped score contribution
  tx_ref       text not null,            -- Solana signature
  created_at   timestamptz not null default now(),
  constraint vouches_no_self_vouch check (voucher_id <> builder_id),
  constraint vouches_positive check (vibe_burned > 0 and usd_at_burn > 0)
);

-- Replay protection: a signature can only ever be claimed once.
create unique index if not exists vouches_tx_ref_key on public.vouches (tx_ref);
create index if not exists vouches_builder_idx on public.vouches (builder_id);
create index if not exists vouches_voucher_idx on public.vouches (voucher_id);

alter table public.vouches enable row level security;

-- Vouches are public by design — being visible is the entire point of the
-- feature. Writes come only from the verified burn endpoint via the service
-- role, which bypasses RLS; there is deliberately no client insert/update/delete.
drop policy if exists "vouches are publicly readable" on public.vouches;
create policy "vouches are publicly readable" on public.vouches for select using (true);

-- ── 5. Streak protects ──

create table if not exists public.streak_protects (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  vibe_burned     bigint not null,
  usd_at_burn     numeric(12,2) not null,
  tx_ref          text not null,
  streak_restored integer not null,
  days_filled     integer not null,
  created_at      timestamptz not null default now(),
  constraint streak_protects_positive check (vibe_burned > 0 and usd_at_burn > 0)
);

create unique index if not exists streak_protects_tx_ref_key on public.streak_protects (tx_ref);
create index if not exists streak_protects_user_created_idx
  on public.streak_protects (user_id, created_at desc);

alter table public.streak_protects enable row level security;

-- Unlike vouches, a restore is nobody else's business.
drop policy if exists "own streak protects readable" on public.streak_protects;
create policy "own streak protects readable" on public.streak_protects
  for select using ((select auth.uid()) = user_id);

-- ── 6. Scoring function, with the capped vouch term ──
--
-- Body is the CURRENT live definition verbatim (pulled via pg_get_functiondef)
-- with ONE addition: the vouch term at the end of the vibe_score expression.
-- Nothing else is retyped, so no existing scoring behaviour can drift.

create or replace function public.update_user_streak(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_current_streak INTEGER := 0;
  v_longest_streak INTEGER := 0;
  v_temp_streak INTEGER := 1;
  v_prev_date DATE;
  v_curr_date DATE;
  v_last_date DATE;
  v_today DATE := CURRENT_DATE;
  v_lifetime INTEGER := 0;
  v_30d INTEGER := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT DISTINCT activity_date
    FROM public.streak_logs
    WHERE user_id = p_user_id
    ORDER BY activity_date ASC
  LOOP
    v_curr_date := rec.activity_date;

    IF v_prev_date IS NOT NULL THEN
      IF v_curr_date - v_prev_date = 1 THEN
        v_temp_streak := v_temp_streak + 1;
      ELSE
        v_temp_streak := 1;
      END IF;
    END IF;

    IF v_temp_streak > v_longest_streak THEN
      v_longest_streak := v_temp_streak;
    END IF;

    v_last_date := v_curr_date;
    v_prev_date := v_curr_date;
  END LOOP;

  IF v_last_date IS NOT NULL AND (v_today - v_last_date) <= 1 THEN
    v_current_streak := v_temp_streak;
  ELSE
    v_current_streak := 0;
  END IF;

  -- Read denormalized volume totals (populated by daily cron, default 0).
  SELECT COALESCE(lifetime_contributions, 0), COALESCE(contributions_30d, 0)
    INTO v_lifetime, v_30d
    FROM public.users WHERE id = p_user_id;

  UPDATE public.users
  SET
    streak = v_current_streak,
    longest_streak = GREATEST(longest_streak, v_longest_streak),
    badge_level = CASE
      WHEN GREATEST(longest_streak, v_longest_streak) >= 365 THEN 'diamond'::badge_level
      WHEN GREATEST(longest_streak, v_longest_streak) >= 180 THEN 'gold'::badge_level
      WHEN GREATEST(longest_streak, v_longest_streak) >= 90 THEN 'silver'::badge_level
      WHEN GREATEST(longest_streak, v_longest_streak) >= 30 THEN 'bronze'::badge_level
      ELSE 'none'::badge_level
    END,
    vibe_score =
      10
      + (v_current_streak * 2)
      + COALESCE((
        SELECT SUM(
          2
          + CASE WHEN live_url IS NOT NULL AND live_url != '' THEN 2 ELSE 0 END
          + CASE WHEN github_url IS NOT NULL AND github_url != '' THEN 2 ELSE 0 END
          + CASE WHEN quality_score > 0 THEN LEAST(quality_score, 100) ELSE 0 END
        ) FROM public.projects WHERE projects.user_id = p_user_id AND NOT COALESCE(flagged, false)
      ), 0)
      + COALESCE((
        SELECT COUNT(*) * 5
        FROM public.project_endorsements pe
        JOIN public.projects p ON p.id = pe.project_id
        WHERE p.user_id = p_user_id AND NOT COALESCE(p.flagged, false)
      ), 0)
      + CASE
        WHEN GREATEST(longest_streak, v_longest_streak) >= 365 THEN 40
        WHEN GREATEST(longest_streak, v_longest_streak) >= 180 THEN 30
        WHEN GREATEST(longest_streak, v_longest_streak) >= 90 THEN 20
        WHEN GREATEST(longest_streak, v_longest_streak) >= 30 THEN 10
        ELSE 0
      END
      + COALESCE((
        SELECT SUM(
          CASE rating
            WHEN 5 THEN 20
            WHEN 4 THEN 15
            WHEN 3 THEN 10
            WHEN 2 THEN 5
            ELSE 0
          END
        )
        FROM public.reviews
        WHERE builder_id = p_user_id
          AND COALESCE(trust_score, 100) >= 30
      ), 0)
      -- Lifetime contribution credit, sqrt-scaled. 100 → +10, 1k → +31,
      -- 10k → +100, 16k → +126, 62.5k+ → cap. Sqrt gives veterans visible
      -- separation from casuals while still capping bot-scale outliers.
      + LEAST(FLOOR(SQRT(GREATEST(0, v_lifetime)::numeric))::INTEGER, 250)
      -- Recent activity bonus. 100 commits in last 30d → +50 (capped).
      + LEAST(FLOOR(v_30d::numeric * 0.5)::INTEGER, 50)
      -- Vouch credit (NEW). Group by voucher first: re-vouching adds to that
      -- voucher's total BEFORE the per-voucher cap applies. Credibility is 0
      -- below vibe_score 20, so a throwaway account's burn still shows publicly
      -- but scores nothing — that floor is the Sybil defence.
      --
      -- The COALESCE INSIDE LEAST is load-bearing. Postgres LEAST ignores
      -- NULLs, and the aggregate subquery returns one row even over zero
      -- vouches, so LEAST(SUM(pts), 25) would yield 25 — silently granting
      -- every user +25 on the day this migration applies. Verified on live
      -- Postgres: without COALESCE = 25, with it = 0.
      + COALESCE((
        SELECT LEAST(COALESCE(SUM(pts), 0), 25)::INTEGER FROM (
          SELECT LEAST(
            FLOOR(
              SQRT(SUM(v.usd_at_burn)) *
              CASE
                WHEN vu.vibe_score < 20 THEN 0
                ELSE 0.5 + 0.5 * LEAST(vu.vibe_score::numeric / 200, 1)
              END
            ), 5
          ) AS pts
          FROM public.vouches v
          JOIN public.users vu ON vu.id = v.voucher_id
          WHERE v.builder_id = p_user_id
          GROUP BY v.voucher_id, vu.vibe_score
        ) per_voucher
      ), 0)
  WHERE id = p_user_id;
END;
$function$;

-- Migration: Social Visibility Pack
-- Adds weekly score snapshots, reviewer reputation columns, and reviewer→user link.
-- All changes are additive and nullable; safe to roll forward without backfill.

-- 1. Weekly snapshots (Monday rows only) for "climbed +N spots this week" math.
create table public.vibe_score_weekly_snapshots (
  user_id uuid not null references public.users(id) on delete cascade,
  week_start date not null,
  vibe_score integer not null,
  rank integer not null,
  commits_7d integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

create index vibe_score_weekly_snapshots_week_rank_idx
  on public.vibe_score_weekly_snapshots (week_start, rank);

alter table public.vibe_score_weekly_snapshots enable row level security;

create policy "weekly_snapshots_public_read"
  on public.vibe_score_weekly_snapshots for select using (true);

-- 2. Reviewer reputation columns on users (distinct from existing badge_level).
alter table public.users
  add column reviewer_calibration numeric(5,2),
  add column reviewer_tier text
    check (reviewer_tier is null or reviewer_tier in ('bronze','silver','gold'));

-- 3. Link reviews to logged-in reviewers. Anonymous reviews stay null.
alter table public.reviews
  add column reviewer_user_id uuid references public.users(id) on delete set null;

create index reviews_reviewer_user_id_idx
  on public.reviews (reviewer_user_id) where reviewer_user_id is not null;

-- ROLLBACK (commented; uncomment + run if needed):
-- alter table public.reviews drop column if exists reviewer_user_id;
-- alter table public.users
--   drop column if exists reviewer_calibration,
--   drop column if exists reviewer_tier;
-- drop table if exists public.vibe_score_weekly_snapshots;

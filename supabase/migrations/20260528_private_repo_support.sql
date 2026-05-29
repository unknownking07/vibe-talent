-- Migration: Private Repo Support
--
-- Lets users add private GitHub repos that stay confidential by default.
-- Tightens RLS so private projects are invisible to anyone but their owner,
-- and adds a per-user opt-in toggle for surfacing anonymized private-repo
-- activity in the live feed.
--
-- Columns added:
--   projects.is_private              — GitHub repo visibility (set from
--                                       GitHub API repo.private field)
--   feed_events.is_private           — denormalized from source project, so
--                                       the public feed query can filter
--                                       without a join
--   users.share_private_activity     — opt-in: when true, the user's private-
--                                       repo feed events appear publicly as
--                                       "pushed N commits to a private repo"
--                                       (no repo name, no commit message, no
--                                       URL). When false (default), private
--                                       events are hidden entirely.
--
-- Privacy guarantees layered top-to-bottom:
--   1. RLS prevents anon Supabase JS clients from selecting a private
--      project unless they're the owner. Service-role server code bypasses
--      RLS, so app-level filters are still required on every public surface.
--   2. App-level filters on /api/projects GET, /api/feed, profile pages, and
--      sitemap strip private rows from non-owner responses.
--   3. Even when share_private_activity is on, the feed renderer rewrites
--      private events to omit repo_name / message / github_url.
--
-- All changes are additive with NOT NULL DEFAULT false — existing rows get
-- the safe default and no backfill is needed.

-- 1. Projects: visibility flag
alter table public.projects
  add column if not exists is_private boolean not null default false;

-- Partial index: only private rows; non-private is the common case so we
-- don't want a full-table index that mostly stores `false`.
create index if not exists idx_projects_is_private
  on public.projects (is_private)
  where is_private = true;

-- 2. Users: opt-in toggle for sharing private-repo activity in the feed.
-- Default false — owners must explicitly turn it on in settings.
alter table public.users
  add column if not exists share_private_activity boolean not null default false;

-- 3. Feed events: denormalized visibility flag.
-- Wrapped because feed_events was created out-of-band (no prior migration),
-- so this migration stays a no-op on environments where the table is missing.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'feed_events'
  ) then
    execute 'alter table public.feed_events
      add column if not exists is_private boolean not null default false';

    execute 'create index if not exists idx_feed_events_is_private
      on public.feed_events (is_private)
      where is_private = true';
  end if;
end $$;

-- 4. RLS: replace the blanket "everyone can SELECT" policy on projects with
-- a private-aware one. Owners always see their own rows; everyone else only
-- sees non-private rows.
drop policy if exists "Projects are viewable by everyone" on public.projects;

create policy "Public projects are viewable by everyone"
  on public.projects for select
  using (
    coalesce(is_private, false) = false
    or auth.uid() = user_id
  );

-- ROLLBACK (commented; uncomment + run if needed):
-- drop policy if exists "Public projects are viewable by everyone" on public.projects;
-- create policy "Projects are viewable by everyone" on public.projects for select using (true);
-- alter table public.users drop column if exists share_private_activity;
-- do $$ begin
--   if exists (select 1 from information_schema.tables where table_schema='public' and table_name='feed_events') then
--     execute 'drop index if exists idx_feed_events_is_private';
--     execute 'alter table public.feed_events drop column if exists is_private';
--   end if;
-- end $$;
-- drop index if exists idx_projects_is_private;
-- alter table public.projects drop column if exists is_private;

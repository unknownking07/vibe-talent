-- Indexes for the Live Network Feed's per-source queries.
--
-- The feed API runs eight parallel SELECTs against different tables and
-- merges them. Three of those queries didn't have a supporting index for
-- their ORDER BY (or WHERE + ORDER BY) and would degrade to a sequential
-- scan as the tables grow:
--
--   1. project_endorsements ORDER BY created_at DESC
--      Existing indexes are on (project_id) and (user_id) only — neither
--      helps the time-ordered fetch the feed runs.
--
--   2. reviews WHERE trust_score >= 30 ORDER BY created_at DESC
--      Existing index is on (builder_id) only — the feed's filter+sort
--      can't use it. A composite (trust_score, created_at DESC) lets
--      Postgres seek into the qualifying rows and walk the heap in
--      created-at order.
--
--   3. notifications WHERE type = 'badge_earned' ORDER BY created_at DESC
--      Existing index is on (user_id, read, created_at DESC) for the
--      "user's notifications" query. The public feed's read pattern is
--      different — `(type, created_at DESC)` matches its filter + sort.
--
-- All three are `IF NOT EXISTS` so re-running this migration is a no-op.
-- None lock the tables long enough to matter at our row counts; for very
-- large tables you'd want CREATE INDEX CONCURRENTLY, but that can't run
-- inside a transaction so we keep the simple form for now.

CREATE INDEX IF NOT EXISTS idx_endorsements_created_at
  ON public.project_endorsements (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_trust_created
  ON public.reviews (trust_score, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_type_created
  ON public.notifications (type, created_at DESC);

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
--      can't use it. A *partial* index `(created_at DESC) WHERE
--      trust_score >= 30` is the right shape: Postgres walks the heap
--      in created_at order across exactly the rows the feed wants,
--      without paying for the full table or the trust-score grouping
--      that a multicolumn `(trust_score, created_at DESC)` index forces.
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

-- The original idx_reviews_trust_created (composite) is dropped in favor
-- of the partial below; this is idempotent so re-runs are safe whether
-- or not the previous migration apply created it.
DROP INDEX IF EXISTS idx_reviews_trust_created;

CREATE INDEX IF NOT EXISTS idx_reviews_feed_created_at
  ON public.reviews (created_at DESC)
  WHERE trust_score >= 30;

CREATE INDEX IF NOT EXISTS idx_notifications_type_created
  ON public.notifications (type, created_at DESC);

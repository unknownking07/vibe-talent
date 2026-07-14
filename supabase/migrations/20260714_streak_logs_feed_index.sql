-- Missing feed index for the Live Network Feed's streak_logs source.
--
-- 20260502_feed_query_indexes.sql added supporting indexes for three of
-- the feed's four time-ordered sources (project_endorsements, reviews,
-- notifications) but overlooked the fourth:
--
--   streak_logs ORDER BY activity_date DESC LIMIT n   (no WHERE)
--     -- src/lib/homepage-feed.ts and src/app/api/feed/route.ts
--
-- The existing indexes on streak_logs are (user_id), the (user_id,
-- activity_date) unique key, and the (id) primary key. None can serve a
-- global activity_date ordering, so this query degraded to a full Seq
-- Scan of the entire table plus a top-N heapsort on every homepage / feed
-- load. Over 105 days of pg_stat_statements it was the single largest
-- consumer of database time (~19% of total, ~59 ms/call, EXPLAIN showed
-- ~123 ms). This index turns it into a sub-millisecond index scan.
--
-- IF NOT EXISTS so re-running is a no-op. Plain (non-CONCURRENT) form to
-- match the sibling migration; streak_logs is small enough that the brief
-- write lock is immaterial. CONCURRENTLY can't run inside a transaction.

CREATE INDEX IF NOT EXISTS idx_streak_logs_activity_date
  ON public.streak_logs (activity_date DESC);

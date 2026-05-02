-- Expose `notifications` rows of type='badge_earned' to anon reads so they can
-- surface in the public Live Network Feed.
--
-- The existing "Users can view own notifications" policy stays as-is — when
-- multiple permissive SELECT policies are present they are OR'd, so users
-- still see all of their own notifications, and anyone may additionally
-- read badge-earned events. No other notification types (hire_request,
-- project_verified, project_flagged, etc.) become public.
--
-- Why a policy instead of a separate `badge_events` table:
-- The notify_badge_change() trigger already writes a row per upgrade with the
-- new badge level in `metadata->>'badge_level'`, and we don't need anything
-- the trigger doesn't already capture (user_id, created_at, tier). Adding a
-- duplicate table would mean a second insert in the trigger and a backfill
-- for existing rows. Surfacing the existing data with a tightly-scoped read
-- policy is the smallest reversible change that satisfies the feed need.

-- Drop first so re-running the migration in a fresh environment (or on top
-- of a partial apply) doesn't fail with "policy already exists". Postgres
-- < 14 doesn't support `CREATE POLICY IF NOT EXISTS`, and Supabase's
-- migration runner doesn't wrap us in a transaction we can rely on.
DROP POLICY IF EXISTS "Anyone can view badge_earned notifications" ON notifications;

CREATE POLICY "Anyone can view badge_earned notifications"
  ON notifications FOR SELECT
  USING (type = 'badge_earned');

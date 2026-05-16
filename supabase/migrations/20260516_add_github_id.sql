-- Stable GitHub numeric ID per user. GitHub usernames are mutable; numeric
-- IDs are not. Storing the ID lets us survive renames AND detect handle
-- reclaims (someone else takes the old username after a rename) — neither
-- of which the prior github_username-only model could handle.
--
-- Populated from:
--   1. auth.identities.provider_id for users who linked GitHub via OAuth
--      (backfilled below for existing rows).
--   2. /auth/callback and /auth/profile-setup, which capture it from the
--      OAuth identity going forward.
--
-- The github-sync cron uses this to verify the username it has on file
-- still points at the same GitHub account on every run.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS github_id BIGINT;

-- Backfill from existing OAuth identity records. provider_id is TEXT in
-- auth.identities but GitHub uses numeric IDs — defensive numeric regex
-- check before the cast so any unexpected shape skips silently rather
-- than aborting the whole migration.
--
-- Subquery form (rather than UPDATE...FROM) so a user with multiple
-- historical GitHub identities — possible if they unlinked and relinked
-- a different account — gets the most-recent one rather than an
-- arbitrary join row.
UPDATE public.users u
SET github_id = (
  SELECT i.provider_id::bigint
  FROM auth.identities i
  WHERE i.user_id = u.id
    AND i.provider = 'github'
    AND i.provider_id ~ '^[0-9]+$'
  ORDER BY i.last_sign_in_at DESC NULLS LAST, i.updated_at DESC NULLS LAST
  LIMIT 1
)
WHERE u.github_id IS NULL
  AND EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = u.id
      AND i.provider = 'github'
      AND i.provider_id ~ '^[0-9]+$'
  );

-- A given GitHub account should map to at most one VibeTalent user.
-- Partial index so NULL rows (users without a linked GitHub) coexist
-- freely. Plain (non-CONCURRENT) since migrations run in a transaction
-- and the users table is small enough that the lock is sub-second.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github_id_unique
  ON public.users (github_id)
  WHERE github_id IS NOT NULL;

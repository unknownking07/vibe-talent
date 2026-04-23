-- Stamp set by the verify-backfill cron so permanently-unprocessable rows
-- (owner mismatch, missing github_username, unparseable URL) don't monopolize
-- the oldest-first query window and starve newer unverified projects from
-- being retried. Transient GitHub API failures don't bump this, so they still
-- retry on the next run.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_verify_attempt_at TIMESTAMPTZ;

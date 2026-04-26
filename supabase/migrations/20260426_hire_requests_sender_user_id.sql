-- Add sender_user_id so hire requests submitted by an authenticated user can be
-- linked back to that user's profile. Nullable: legacy rows and anonymous submissions
-- stay NULL and render as plain text on the dashboard.
--
-- Why this column instead of looking up by email: the public hire form accepts
-- an email from unauthenticated input, so a malicious sender could submit
-- another user's email and get the dashboard to clickably misattribute the
-- request to the victim's profile (Codex P1 finding on PR #155). Storing the
-- authenticated user id at submission time makes profile linking proof-based.

ALTER TABLE hire_requests
  ADD COLUMN IF NOT EXISTS sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hire_requests_sender_user_id
  ON hire_requests(sender_user_id)
  WHERE sender_user_id IS NOT NULL;

-- Security hardening pass (2026-05-29)
--
-- Closes a set of RLS / access-control gaps found in a full-codebase audit.
-- Root cause: several SELECT policies were left at `USING (true)` while the
-- anon key ships in the browser bundle, so "private" tables were readable by
-- anyone with the public key. There is no FORCE RLS / REVOKE baseline, so an
-- RLS policy is the ONLY gate on each table.
--
-- Written without DO/dollar-quote blocks so it runs cleanly in the Supabase
-- SQL editor (which splits on `;`). Idempotent — safe to re-run. Assumes the
-- email_log and feed_events tables already exist (they do in the live DB;
-- ALTER ... IF EXISTS no-ops otherwise).


-- ============================================================
-- #1 hire_messages — private hire conversations were world-readable.
-- Scope SELECT to the owning builder. The client (token-holder) view is
-- served through the service-role API route, which bypasses RLS.
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read hire messages" ON public.hire_messages;
DROP POLICY IF EXISTS "Builders read own hire messages" ON public.hire_messages;
CREATE POLICY "Builders read own hire messages"
  ON public.hire_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hire_requests hr
      WHERE hr.id = hire_messages.hire_request_id
        AND hr.builder_id = auth.uid()
    )
  );


-- ============================================================
-- #3 users — reputation columns (vibe_score / streak / badge_level) were
-- client-writable via the anon key. Make the recompute function run as its
-- definer so it can still write those columns, then revoke blanket UPDATE and
-- re-grant ONLY the profile columns clients may edit. update_user_streak
-- already pins search_path, so SECURITY DEFINER is safe here.
-- ============================================================
ALTER FUNCTION public.update_user_streak(UUID) SECURITY DEFINER;

REVOKE UPDATE ON public.users FROM anon, authenticated;

GRANT UPDATE (
  username,
  display_name,
  bio,
  avatar_url,
  github_username,
  github_id,
  share_private_activity
) ON public.users TO authenticated;


-- ============================================================
-- #4 reviews — reviewer_email (PII) was world-readable via the anon key.
-- Revoke blanket SELECT and re-grant every column EXCEPT reviewer_email.
-- trust_score stays granted (the public feed reads it via the anon key).
-- The reviews API reads reviewer_email via the service-role client.
-- ============================================================
REVOKE SELECT ON public.reviews FROM anon, authenticated;

GRANT SELECT (
  id,
  builder_id,
  reviewer_name,
  hire_request_id,
  rating,
  comment,
  trust_score,
  created_at,
  reviewer_user_id
) ON public.reviews TO anon, authenticated;


-- ============================================================
-- #7 email_log — created without RLS. Enable RLS with no policy so only the
-- service role (crons) can read/write it.
-- ============================================================
ALTER TABLE IF EXISTS public.email_log ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- #10 feed_events — no RLS anywhere. Enable RLS and expose only non-private
-- rows to anon; private/anonymized rows are surfaced solely through the
-- service-role API path.
-- ============================================================
ALTER TABLE IF EXISTS public.feed_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public feed events are readable" ON public.feed_events;
CREATE POLICY "Public feed events are readable"
  ON public.feed_events FOR SELECT
  USING (COALESCE(is_private, false) = false);

-- Security fix: stop signed-in users inserting straight into reviews,
-- hire_requests, hire_messages and project_reports.
--
-- Each table carried a permissive INSERT policy that admitted any signed-in
-- session: WITH CHECK (true), or auth.role() = 'service_role' OR auth.uid()
-- IS NOT NULL. Permissive policies OR together, so the narrower
-- "No direct report inserts" (WITH CHECK false) never blocked anything.
--
-- reviews is the serious one. The on_review_change trigger recomputes the
-- builder's vibe_score, and every 5-star review with trust_score NULL or
-- >= 30 adds 20 points, uncapped, with no one-review-per-reviewer rule. A
-- direct insert could inflate any builder's score while skipping the trust
-- scoring and rate limit in /api/reviews.
--
-- Every legitimate writer uses the service-role client, which bypasses RLS:
-- /api/reviews, /api/hire, /api/hire/messages, /api/report and /api/v1/hire
-- (switched to it in the same change as this file). No database function
-- inserts into these tables. Updates, deletes and reads keep their policies.
--
-- Reversible: re-create any policy from git history if a flow needs it.

DROP POLICY IF EXISTS "Authenticated insert only" ON public.reviews;
DROP POLICY IF EXISTS "Service role or authed users can submit reviews" ON public.reviews;

DROP POLICY IF EXISTS "Authenticated users can send hire requests" ON public.hire_requests;
DROP POLICY IF EXISTS "Service role can insert hire requests" ON public.hire_requests;

DROP POLICY IF EXISTS "Authenticated users can insert hire messages" ON public.hire_messages;
DROP POLICY IF EXISTS "Service role or authed users can insert hire messages" ON public.hire_messages;

DROP POLICY IF EXISTS "Service role or authed users can submit reports" ON public.project_reports;

-- Covering indexes for foreign keys flagged by Supabase's
-- unindexed_foreign_keys performance advisor.
--
-- Each of these FK columns had no supporting index, so a join across the
-- FK, and the parent-row reference check on ON DELETE / ON UPDATE, falls
-- back to a sequential scan of the child table. Several of these columns
-- also back RLS predicates (e.g. hire_requests.builder_id = auth.uid(),
-- referrals.referrer_id = auth.uid()), so the index also speeds up policy
-- enforcement on every access, not just explicit joins.
--
-- All IF NOT EXISTS (idempotent). Plain (non-CONCURRENT) form: these
-- tables are small and the brief build lock is immaterial; CONCURRENTLY
-- cannot run inside a transaction.

CREATE INDEX IF NOT EXISTS idx_featured_promotions_user_id ON public.featured_promotions (user_id);
CREATE INDEX IF NOT EXISTS idx_hire_requests_builder_id     ON public.hire_requests (builder_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer_user_id ON public.profile_views (viewer_user_id);
CREATE INDEX IF NOT EXISTS idx_project_endorsements_user_id ON public.project_endorsements (user_id);
CREATE INDEX IF NOT EXISTS idx_promoted_slots_project_id    ON public.promoted_slots (project_id);
CREATE INDEX IF NOT EXISTS idx_promoted_slots_user_id       ON public.promoted_slots (user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id        ON public.referrals (referrer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_hire_request_id      ON public.reviews (hire_request_id);

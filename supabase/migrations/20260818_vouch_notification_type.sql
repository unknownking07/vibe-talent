-- Allow the `vouch_received` notification type.
--
-- Backing a builder burns real money, and until now it was the only meaningful
-- action on the platform that told its recipient nothing: reviews, hire
-- requests and project verification all notify, a vouch did not. The insert
-- would have failed the CHECK constraint below, so widening it comes first.
--
-- Purely additive: no existing row changes, and nothing reads the constraint
-- other than INSERT validation.

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'hire_request'::text,
    'streak_milestone'::text,
    'streak_warning'::text,
    'badge_earned'::text,
    'project_verified'::text,
    'project_flagged'::text,
    'new_review'::text,
    'profile_view_summary'::text,
    'weekly_digest'::text,
    'vibe_score_milestone'::text,
    'project_missing_links'::text,
    'referral_prompt'::text,
    'vouch_received'::text
  ]));

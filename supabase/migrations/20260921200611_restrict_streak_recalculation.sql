-- Browser clients now use /api/streak/recalculate, which binds the target user
-- to the verified session before calling this SECURITY DEFINER function with
-- the service role. Apply after that route is deployed so dashboard and
-- onboarding recalculations continue to work.
--
-- These five trigger functions are the only database callers. They must run
-- as their postgres owner so client-owned writes can still recalculate scores
-- after direct EXECUTE is revoked. Their bodies only choose the affected user
-- from the trigger row and invoke update_user_streak; each has a fixed search
-- path and schema-qualified table references.

BEGIN;

ALTER FUNCTION public.trigger_init_vibe_score() SECURITY DEFINER;
ALTER FUNCTION public.trigger_update_streak() SECURITY DEFINER;
ALTER FUNCTION public.trigger_update_vibe_score_on_endorsement() SECURITY DEFINER;
ALTER FUNCTION public.trigger_update_vibe_score_on_project() SECURITY DEFINER;
ALTER FUNCTION public.trigger_update_vibe_score_on_review() SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.update_user_streak(uuid)
  FROM PUBLIC, anon, authenticated;

COMMIT;

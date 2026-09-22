-- The score trigger functions run as postgres so they can call the protected
-- update_user_streak function for client-owned writes. Their installed triggers
-- continue to fire, but browser roles do not need direct RPC access to them.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.trigger_init_vibe_score() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_update_streak() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_update_vibe_score_on_endorsement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_update_vibe_score_on_project() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_update_vibe_score_on_review() FROM PUBLIC, anon, authenticated;

COMMIT;

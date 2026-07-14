-- Security fix: remove three permissive RLS policies whose USING(true) /
-- WITH CHECK(true) silently OR-override the narrower intended policies.
-- Permissive policies combine with OR, and RLS is this app's only access
-- gate, so each of these widened access well beyond intent.
--
-- 1. hire_requests: "Anyone can read hire requests by id" (SELECT USING true,
--    role public) exposed EVERY row -- including sender_email (PII), message,
--    and budget -- to the public anon key. All real reads are server-side
--    (service role) or builder-scoped ("Builders can view their own
--    requests", builder_id = auth.uid()); src/app/api/hire/messages/route.ts
--    already comments "RLS now blocks anon reads", so this policy was stale
--    leftover the app code already assumes is gone.
--
-- 2. hire_messages: "Anyone can send hire messages" (INSERT WITH CHECK true,
--    role public) let an anonymous caller inject a message into any thread.
--    Authenticated inserts remain covered by "Service role or authed users
--    can insert hire messages" (auth.role()='service_role' OR auth.uid()
--    IS NOT NULL); the server route inserts via the service client.
--
-- 3. feed_events: "feed_events_read" (SELECT USING true) OR-overrode
--    "Public feed events are readable" (COALESCE(is_private,false)=false),
--    making the is_private privacy gate a no-op. 0 private rows exist today,
--    so this restores the intended gate with no visible change.
--
-- Reversible: re-create any policy from git history if a flow needs it.

DROP POLICY IF EXISTS "Anyone can read hire requests by id" ON public.hire_requests;
DROP POLICY IF EXISTS "Anyone can send hire messages" ON public.hire_messages;
DROP POLICY IF EXISTS "feed_events_read" ON public.feed_events;

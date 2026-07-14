-- RLS initplan performance fix (Supabase advisor: auth_rls_initplan).
--
-- 29 policies called auth.uid() / auth.role() directly in their USING or
-- WITH CHECK expression. Postgres re-evaluates a bare auth.<fn>() call
-- once PER ROW, so on any scan the policy touches it runs N times. Wrapping
-- the call in a scalar subquery -- (select auth.uid()) -- turns it into an
-- InitPlan that Postgres evaluates ONCE per statement and caches. This is
-- Supabase's documented fix and is strictly behaviour-preserving: the
-- returned value is identical, only the evaluation count changes, so the
-- set of rows each policy admits (and for which users) is unchanged.
--
-- Every rewrite below was independently regenerated and adversarially
-- verified (29/29 equivalent, 0 access-changing) before being written here.
-- Only the auth.<fn>() calls changed; columns, operators, boolean logic,
-- roles, and commands are untouched. ALTER POLICY preserves command, roles,
-- and permissive/restrictive; INSERT policies alter WITH CHECK only,
-- SELECT/DELETE alter USING only, UPDATE/ALL alter USING (none of these had
-- a distinct WITH CHECK).

ALTER POLICY "Service role only" ON public.email_log
  USING ((select auth.role()) = 'service_role'::text);

ALTER POLICY "Users can manage their own email preferences" ON public.email_preferences
  USING (user_id = (select auth.uid()));

ALTER POLICY "Service role can insert feedback" ON public.feedback
  WITH CHECK ((select auth.role()) = 'service_role'::text);

ALTER POLICY "Builders can delete messages from their requests" ON public.hire_messages
  USING (hire_request_id IN ( SELECT hire_requests.id
     FROM hire_requests
    WHERE (hire_requests.builder_id = (select auth.uid()))));

ALTER POLICY "Service role or authed users can insert hire messages" ON public.hire_messages
  WITH CHECK (((select auth.role()) = 'service_role'::text) OR ((select auth.uid()) IS NOT NULL));

ALTER POLICY "Builders read own hire messages" ON public.hire_messages
  USING (EXISTS ( SELECT 1
     FROM hire_requests hr
    WHERE ((hr.id = hire_messages.hire_request_id) AND (hr.builder_id = (select auth.uid())))));

ALTER POLICY "Builders can delete own hire requests" ON public.hire_requests
  USING ((select auth.uid()) = builder_id);

ALTER POLICY "Builders can delete their own requests" ON public.hire_requests
  USING (builder_id = (select auth.uid()));

ALTER POLICY "Service role can insert hire requests" ON public.hire_requests
  WITH CHECK (((select auth.role()) = 'service_role'::text) OR ((select auth.uid()) IS NOT NULL));

ALTER POLICY "Builders can view their own requests" ON public.hire_requests
  USING (builder_id = (select auth.uid()));

ALTER POLICY "Builders can update their own requests" ON public.hire_requests
  USING (builder_id = (select auth.uid()));

ALTER POLICY "Users can view own notifications" ON public.notifications
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can update own notifications" ON public.notifications
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can view their own profile views" ON public.profile_views
  USING (viewed_user_id = (select auth.uid()));

ALTER POLICY "Authenticated users can endorse" ON public.project_endorsements
  WITH CHECK ((select auth.uid()) IS NOT NULL);

ALTER POLICY "Service role can delete reports" ON public.project_reports
  USING ((select auth.role()) = 'service_role'::text);

ALTER POLICY "Service role or authed users can submit reports" ON public.project_reports
  WITH CHECK (((select auth.role()) = 'service_role'::text) OR ((select auth.uid()) IS NOT NULL));

ALTER POLICY "Users can delete own projects" ON public.projects
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can insert own projects" ON public.projects
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Public projects are viewable by everyone" ON public.projects
  USING ((COALESCE(is_private, false) = false) OR ((select auth.uid()) = user_id));

ALTER POLICY "Users can update own projects" ON public.projects
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Service role can manage referrals" ON public.referrals
  USING ((select auth.role()) = 'service_role'::text);

ALTER POLICY "Users can view own referrals" ON public.referrals
  USING (((select auth.uid()) = referrer_id) OR ((select auth.uid()) = referred_id));

ALTER POLICY "Service role or authed users can submit reviews" ON public.reviews
  WITH CHECK (((select auth.role()) = 'service_role'::text) OR ((select auth.uid()) IS NOT NULL));

ALTER POLICY "Users can insert own social links" ON public.social_links
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can update own social links" ON public.social_links
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can insert own streak logs" ON public.streak_logs
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can insert own profile" ON public.users
  WITH CHECK ((select auth.uid()) = id);

ALTER POLICY "Users can update own profile" ON public.users
  USING ((select auth.uid()) = id);

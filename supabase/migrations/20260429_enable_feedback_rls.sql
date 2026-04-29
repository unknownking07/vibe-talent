-- Enable RLS on public.feedback to fix Supabase advisor critical warning.
--
-- The feedback table exists in production but its CREATE TABLE was never
-- committed (created out-of-band when re-engagement-email feedback shipped).
-- This migration:
--   1. Backfills CREATE TABLE IF NOT EXISTS so fresh DBs get a working table.
--   2. Enables RLS and adds a service-role-only INSERT policy.
--
-- The /feedback form is anonymous; submissions go through /api/feedback,
-- which uses the service role client. Service role bypasses RLS, so the
-- policy primarily blocks direct anon-key inserts via PostgREST.

CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT,
  reason TEXT NOT NULL,
  details TEXT,
  would_return TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at
  ON public.feedback (created_at DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can insert feedback" ON public.feedback;
CREATE POLICY "Service role can insert feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

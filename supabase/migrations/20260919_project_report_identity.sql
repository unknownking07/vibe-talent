-- One authenticated account may report a project once. Legacy reports have no
-- recoverable reporter identity, so the new column stays nullable for them.
-- Apply this migration before deploying the matching /api/report route.

BEGIN;

ALTER TABLE public.project_reports
  ADD COLUMN IF NOT EXISTS reporter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS project_reports_one_per_user_project
  ON public.project_reports (project_id, reporter_user_id)
  WHERE reporter_user_id IS NOT NULL;

-- The route uses the service role after verifying the session. Older
-- migrations allowed direct inserts by signed-in users, which could bypass
-- the route's identity binding and auto-flag logic.
DROP POLICY IF EXISTS "Anyone can submit project reports" ON public.project_reports;
DROP POLICY IF EXISTS "Service role or authed users can submit reports" ON public.project_reports;

-- Only the API route reads or deletes reports. The old public read policy
-- exposed reporter_token (the undo credential) and would also expose the new
-- reporter_user_id. Revoke direct table access even if another policy exists.
DROP POLICY IF EXISTS "Reports are readable" ON public.project_reports;
DROP POLICY IF EXISTS "Anyone can delete own reports by token" ON public.project_reports;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.project_reports FROM PUBLIC, anon, authenticated;

COMMIT;

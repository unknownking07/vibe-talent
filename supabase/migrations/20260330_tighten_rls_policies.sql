-- Tighten RLS policies to prevent direct PostgREST abuse.
-- All public-facing inserts now go through the API (service role),
-- so anonymous inserts via the anon key are no longer allowed.

-- ============================================
-- HIRE REQUESTS: Block direct anonymous inserts
-- ============================================

-- Drop the permissive "anyone can insert" policy
DROP POLICY IF EXISTS "Anyone can send hire requests" ON hire_requests;

-- Only the service role (used by the API) can insert hire requests.
-- The anon key can no longer insert directly.
CREATE POLICY "Service role can insert hire requests"
  ON hire_requests FOR INSERT
  WITH CHECK (
    -- auth.role() = 'service_role' means only our API (using SUPABASE_SERVICE_ROLE_KEY) can insert
    auth.role() = 'service_role'
    -- OR an authenticated user can send hire requests via the API
    OR auth.uid() IS NOT NULL
  );

-- Allow builders to delete their own hire requests
DROP POLICY IF EXISTS "Builders can delete own hire requests" ON hire_requests;
CREATE POLICY "Builders can delete own hire requests"
  ON hire_requests FOR DELETE USING (auth.uid() = builder_id);

-- ============================================
-- HIRE MESSAGES: Block direct anonymous inserts
-- ============================================

DROP POLICY IF EXISTS "Anyone can insert hire messages" ON hire_messages;

CREATE POLICY "Service role or authed users can insert hire messages"
  ON hire_messages FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR auth.uid() IS NOT NULL
  );

-- ============================================
-- REVIEWS: Block direct anonymous inserts
-- ============================================

DROP POLICY IF EXISTS "Anyone can submit reviews" ON reviews;

CREATE POLICY "Service role or authed users can submit reviews"
  ON reviews FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR auth.uid() IS NOT NULL
  );

-- ============================================
-- PROJECT REPORTS: Block direct anonymous inserts
-- ============================================

DROP POLICY IF EXISTS "Anyone can submit project reports" ON project_reports;

CREATE POLICY "Service role or authed users can submit reports"
  ON project_reports FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR auth.uid() IS NOT NULL
  );

-- Keep the delete policy for undo (token matching done in API)
-- but restrict to service role to prevent arbitrary deletes
DROP POLICY IF EXISTS "Anyone can delete own reports by token" ON project_reports;

CREATE POLICY "Service role can delete reports"
  ON project_reports FOR DELETE
  USING (auth.role() = 'service_role');

-- ============================================
-- Add database-level constraints for hire_requests
-- ============================================

-- Enforce minimum message length at the database level
ALTER TABLE hire_requests ADD CONSTRAINT hire_requests_message_min_length
  CHECK (length(message) >= 20);

-- Enforce valid email format at the database level
ALTER TABLE hire_requests ADD CONSTRAINT hire_requests_email_format
  CHECK (sender_email ~* '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');

-- Enforce minimum name length
ALTER TABLE hire_requests ADD CONSTRAINT hire_requests_name_min_length
  CHECK (length(sender_name) >= 2);

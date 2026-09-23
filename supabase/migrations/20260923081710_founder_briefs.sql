-- Private founder briefs for the manual matching pilot. Browser clients never
-- read or write this table; the server validates anonymous submissions and
-- inserts with the service-role key. Apply this file alone in SQL Editor.

CREATE TABLE public.founder_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  email TEXT NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 20 AND 3000),
  tech_stack TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(tech_stack) <= 10),
  project_type TEXT NOT NULL CHECK (project_type IN ('mvp', 'full_product', 'bug_fix', 'consultation')),
  timeline TEXT NOT NULL CHECK (timeline IN ('asap', '1_week', '1_month', 'flexible')),
  budget TEXT NOT NULL CHECK (budget IN ('under_500', '500_2k', '2k_5k', '5k_plus')),
  source TEXT NOT NULL DEFAULT 'agent_find' CHECK (source = 'agent_find'),
  consent_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'qualified', 'matched', 'introduced', 'trial', 'won', 'lost')),
  loss_reason TEXT CHECK (loss_reason IS NULL OR char_length(loss_reason) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX founder_briefs_created_at_idx ON public.founder_briefs (created_at DESC);
CREATE INDEX founder_briefs_email_created_at_idx ON public.founder_briefs (email, created_at DESC);

ALTER TABLE public.founder_briefs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.founder_briefs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.founder_briefs TO service_role;

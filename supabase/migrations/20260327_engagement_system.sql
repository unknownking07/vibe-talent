-- Profile Views table
CREATE TABLE IF NOT EXISTS profile_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  viewed_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  viewer_ip_hash TEXT,
  viewed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Deduplicate: one view per viewer per profile per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_views_dedup
  ON profile_views (viewed_user_id, COALESCE(viewer_user_id::text, viewer_ip_hash), (viewed_at::date));

-- Query index: who viewed me recently
CREATE INDEX IF NOT EXISTS idx_profile_views_by_user_date
  ON profile_views (viewed_user_id, viewed_at DESC);

-- Email preferences table
CREATE TABLE IF NOT EXISTS email_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  profile_view_digest BOOLEAN DEFAULT TRUE,
  streak_reminders BOOLEAN DEFAULT TRUE,
  milestone_alerts BOOLEAN DEFAULT TRUE,
  weekly_digest BOOLEAN DEFAULT TRUE,
  hire_notifications BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email log table (prevent duplicate sends)
CREATE TABLE IF NOT EXISTS email_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_user_type_date
  ON email_log (user_id, email_type, (sent_at::date));

-- Expand notification types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'hire_request', 'streak_milestone', 'streak_warning',
    'badge_earned', 'project_verified', 'project_flagged',
    'new_review', 'profile_view_summary', 'weekly_digest',
    'vibe_score_milestone'
  ));

-- RLS policies for profile_views
ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert profile views" ON profile_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own profile views" ON profile_views
  FOR SELECT USING (viewed_user_id = auth.uid());

-- RLS policies for email_preferences
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own email preferences" ON email_preferences
  FOR ALL USING (user_id = auth.uid());

-- Allow service role to read/write all tables (for cron jobs)
-- Service role bypasses RLS by default

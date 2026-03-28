-- VibeCoders Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Badge level enum
CREATE TYPE badge_level AS ENUM ('none', 'bronze', 'silver', 'gold', 'diamond');

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  vibe_score INTEGER DEFAULT 0,
  badge_level badge_level DEFAULT 'none',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tech_stack TEXT[] DEFAULT '{}',
  live_url TEXT,
  github_url TEXT,
  image_url TEXT,
  build_time TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Streak logs table
CREATE TABLE streak_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  UNIQUE(user_id, activity_date)
);

-- Social links table
CREATE TABLE social_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  twitter TEXT,
  telegram TEXT,
  github TEXT,
  website TEXT,
  farcaster TEXT
);

-- Indexes for performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_vibe_score ON users(vibe_score DESC);
CREATE INDEX idx_users_streak ON users(streak DESC);
CREATE INDEX idx_users_badge_level ON users(badge_level);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX idx_streak_logs_user_id ON streak_logs(user_id);
CREATE INDEX idx_streak_logs_activity_date ON streak_logs(activity_date);
CREATE INDEX idx_streak_logs_user_date ON streak_logs(user_id, activity_date);

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE streak_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_links ENABLE ROW LEVEL SECURITY;

-- Public read access for profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON users FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE USING (auth.uid() = id);

-- Public read access for projects
CREATE POLICY "Projects are viewable by everyone"
  ON projects FOR SELECT USING (true);

-- Users can manage their own projects
CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE USING (auth.uid() = user_id);

-- Streak logs: users can manage their own
CREATE POLICY "Users can view own streak logs"
  ON streak_logs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own streak logs"
  ON streak_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Social links: public read, owner write
CREATE POLICY "Social links are viewable by everyone"
  ON social_links FOR SELECT USING (true);

CREATE POLICY "Users can manage own social links"
  ON social_links FOR ALL USING (auth.uid() = user_id);

-- Function to calculate and update user streak
CREATE OR REPLACE FUNCTION update_user_streak(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_current_streak INTEGER := 0;
  v_longest_streak INTEGER := 0;
  v_temp_streak INTEGER := 1;
  v_prev_date DATE;
  v_curr_date DATE;
  v_last_date DATE;
  v_today DATE := CURRENT_DATE;
  rec RECORD;
BEGIN
  -- Get all activity dates for user, ordered ascending
  FOR rec IN
    SELECT DISTINCT activity_date
    FROM streak_logs
    WHERE user_id = p_user_id
    ORDER BY activity_date ASC
  LOOP
    v_curr_date := rec.activity_date;

    IF v_prev_date IS NOT NULL THEN
      IF v_curr_date - v_prev_date = 1 THEN
        v_temp_streak := v_temp_streak + 1;
      ELSE
        v_temp_streak := 1;
      END IF;
    END IF;

    IF v_temp_streak > v_longest_streak THEN
      v_longest_streak := v_temp_streak;
    END IF;

    v_last_date := v_curr_date;
    v_prev_date := v_curr_date;
  END LOOP;

  -- Check if streak is active (last activity today or yesterday)
  IF v_last_date IS NOT NULL AND (v_today - v_last_date) <= 1 THEN
    v_current_streak := v_temp_streak;
  ELSE
    v_current_streak := 0;
  END IF;

  -- Update user record
  UPDATE users
  SET
    streak = v_current_streak,
    longest_streak = GREATEST(longest_streak, v_longest_streak),
    badge_level = CASE
      WHEN GREATEST(longest_streak, v_longest_streak) >= 365 THEN 'diamond'::badge_level
      WHEN GREATEST(longest_streak, v_longest_streak) >= 180 THEN 'gold'::badge_level
      WHEN GREATEST(longest_streak, v_longest_streak) >= 90 THEN 'silver'::badge_level
      WHEN GREATEST(longest_streak, v_longest_streak) >= 30 THEN 'bronze'::badge_level
      ELSE 'none'::badge_level
    END,
    vibe_score = (v_current_streak * 2) + (
      -- Use sum of project quality scores instead of flat count
      -- Verified projects with quality_score contribute their score / 10 (0-10 pts each)
      -- Unverified projects contribute only 1 point each
      COALESCE((
        SELECT SUM(
          CASE
            WHEN verified = true AND quality_score > 0 THEN LEAST(quality_score / 10, 10)
            WHEN verified = true THEN 5
            ELSE 1
          END
        ) FROM projects WHERE projects.user_id = p_user_id AND flagged = false
      ), 0)
    ) + CASE
      WHEN GREATEST(longest_streak, v_longest_streak) >= 365 THEN 40
      WHEN GREATEST(longest_streak, v_longest_streak) >= 180 THEN 30
      WHEN GREATEST(longest_streak, v_longest_streak) >= 90 THEN 20
      WHEN GREATEST(longest_streak, v_longest_streak) >= 30 THEN 10
      ELSE 0
    END
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger: auto-update streak when activity is logged
CREATE OR REPLACE FUNCTION trigger_update_streak()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_user_streak(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_streak_log_insert
  AFTER INSERT ON streak_logs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_streak();

-- Trigger: update vibe score when project is added/removed
CREATE OR REPLACE FUNCTION trigger_update_vibe_score_on_project()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_user_streak(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM update_user_streak(NEW.user_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_project_change
  AFTER INSERT OR DELETE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_vibe_score_on_project();

-- Hire requests table
CREATE TABLE hire_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  message TEXT NOT NULL,
  budget TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hire_requests_builder_id ON hire_requests(builder_id);
CREATE INDEX idx_hire_requests_created_at ON hire_requests(created_at DESC);

ALTER TABLE hire_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a hire request (no auth required)
CREATE POLICY "Anyone can send hire requests"
  ON hire_requests FOR INSERT WITH CHECK (true);

-- Builder can view their own hire requests; public chat uses service role via API
CREATE POLICY "Builders can view own hire requests"
  ON hire_requests FOR SELECT USING (auth.uid() = builder_id);

-- Only the builder can update their own hire requests
CREATE POLICY "Builders can update own hire requests"
  ON hire_requests FOR UPDATE USING (auth.uid() = builder_id);

-- Hire messages table (chat thread per hire request)
CREATE TABLE hire_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hire_request_id UUID NOT NULL REFERENCES hire_requests(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('builder', 'client')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hire_messages_hire_request_id ON hire_messages(hire_request_id);
CREATE INDEX idx_hire_messages_created_at ON hire_messages(created_at ASC);

ALTER TABLE hire_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can read messages for a hire request (client needs access via request ID)
CREATE POLICY "Anyone can read hire messages"
  ON hire_messages FOR SELECT USING (true);

-- Anyone can insert hire messages (builder auth checked in API, client uses request ID as token)
CREATE POLICY "Anyone can insert hire messages"
  ON hire_messages FOR INSERT WITH CHECK (true);

-- Add reply and replied_at columns to hire_requests
ALTER TABLE hire_requests ADD COLUMN IF NOT EXISTS reply TEXT;
ALTER TABLE hire_requests ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;

-- Add flagged column to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_projects_flagged ON projects(flagged);

-- Add verified column to projects (GitHub repo ownership verification)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;

-- GitHub quality scoring columns on projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS quality_metrics JSONB;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS live_url_ok BOOLEAN;

-- Add github_username column to users (populated from GitHub OAuth on login)
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_username TEXT;

-- Project reports table (spam prevention)
CREATE TABLE project_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  reporter_token UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_project_reports_project_id ON project_reports(project_id);
CREATE INDEX idx_project_reports_reporter_token ON project_reports(reporter_token);

ALTER TABLE project_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a report (no auth required)
CREATE POLICY "Anyone can submit project reports"
  ON project_reports FOR INSERT WITH CHECK (true);

-- Reports are readable for counting (used by API)
CREATE POLICY "Reports are readable"
  ON project_reports FOR SELECT USING (true);

-- Anyone can delete reports by token (token matching enforced in API)
CREATE POLICY "Anyone can delete own reports by token"
  ON project_reports FOR DELETE USING (true);

-- Reviews table (client reviews of builders)
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  reviewer_email TEXT NOT NULL,
  hire_request_id UUID REFERENCES hire_requests(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_builder_id ON reviews(builder_id);
CREATE INDEX idx_reviews_hire_request_id ON reviews(hire_request_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit reviews"
  ON reviews FOR INSERT WITH CHECK (true);

CREATE POLICY "Reviews are publicly readable"
  ON reviews FOR SELECT USING (true);

-- ==========================================
-- NOTIFICATIONS
-- ==========================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('hire_request', 'streak_milestone', 'badge_earned', 'project_verified', 'project_flagged')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service can insert notifications"
  ON notifications FOR INSERT WITH CHECK (true);

-- Auto-create notification when badge level changes
CREATE OR REPLACE FUNCTION notify_badge_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.badge_level IS DISTINCT FROM NEW.badge_level AND NEW.badge_level != 'none' THEN
    INSERT INTO notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.id, 'badge_earned', 'Badge earned!',
      'You earned the ' || NEW.badge_level || ' badge!',
      jsonb_build_object('badge_level', NEW.badge_level)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_badge_change
  AFTER UPDATE OF badge_level ON users
  FOR EACH ROW EXECUTE FUNCTION notify_badge_change();

-- Auto-create notification on streak milestones
CREATE OR REPLACE FUNCTION notify_streak_milestone()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.streak IN (7, 30, 90, 180, 365) AND (OLD.streak IS NULL OR OLD.streak < NEW.streak) THEN
    INSERT INTO notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.id, 'streak_milestone', NEW.streak || '-day streak!',
      'You hit a ' || NEW.streak || '-day coding streak!',
      jsonb_build_object('streak_days', NEW.streak)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_streak_milestone
  AFTER UPDATE OF streak ON users
  FOR EACH ROW EXECUTE FUNCTION notify_streak_milestone();

-- Storage bucket for project images
-- Create "project-images" bucket in Supabase dashboard with public access
-- Path: project-images/{userId}/{projectId}/image.ext
-- Max size: 5MB, allowed types: image/jpeg, image/png, image/webp, image/gif

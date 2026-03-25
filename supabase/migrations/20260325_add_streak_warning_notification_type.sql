-- Migration: Add streak_warning to notifications type constraint
-- Allows the streak warning cron job to insert streak_warning notifications.

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('hire_request', 'streak_milestone', 'streak_warning', 'badge_earned', 'project_verified', 'project_flagged'));

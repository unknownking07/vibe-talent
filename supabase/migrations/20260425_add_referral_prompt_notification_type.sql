-- Add `referral_prompt` to notifications.type — fired once after profile-setup
-- completes to nudge new builders to share their referral link.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'hire_request', 'streak_milestone', 'streak_warning',
    'badge_earned', 'project_verified', 'project_flagged',
    'new_review', 'profile_view_summary', 'weekly_digest',
    'vibe_score_milestone', 'project_missing_links',
    'referral_prompt'
  ));

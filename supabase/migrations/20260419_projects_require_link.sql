-- Require every project to have at least one of: live_url or github_url.
-- NOT VALID: do not scan existing rows (some legacy projects already lack both);
-- those users will be nudged via an in-app notification. All new rows and any
-- UPDATEs must satisfy the constraint.
ALTER TABLE projects
  ADD CONSTRAINT projects_has_live_or_github
  CHECK (
    (live_url IS NOT NULL AND live_url <> '')
    OR (github_url IS NOT NULL AND github_url <> '')
  )
  NOT VALID;

-- New notification type: prompt users to add missing links to their projects.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'hire_request', 'streak_milestone', 'streak_warning',
    'badge_earned', 'project_verified', 'project_flagged',
    'new_review', 'profile_view_summary', 'weekly_digest',
    'vibe_score_milestone', 'project_missing_links'
  ));

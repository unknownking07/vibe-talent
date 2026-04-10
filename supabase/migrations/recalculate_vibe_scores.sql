-- Migration: Recalculate all vibe scores
-- Adds +10 baseline for all users and +5 per endorsement received
-- Run this AFTER deploying the updated update_user_streak() function

-- Step 1: Update the function first (idempotent CREATE OR REPLACE)
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

  IF v_last_date IS NOT NULL AND (v_today - v_last_date) <= 1 THEN
    v_current_streak := v_temp_streak;
  ELSE
    v_current_streak := 0;
  END IF;

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
    vibe_score = 10 + (v_current_streak * 2) + (
      COALESCE((
        SELECT SUM(
          CASE
            WHEN verified = true AND quality_score > 0 THEN LEAST(quality_score / 10, 10)
            WHEN verified = true THEN
              5
              + CASE WHEN live_url IS NOT NULL AND live_url != '' THEN 3 ELSE 0 END
              + CASE WHEN github_url IS NOT NULL AND github_url != '' THEN 2 ELSE 0 END
              + CASE WHEN length(description) > 50 THEN 2 ELSE 0 END
              + CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 ELSE 0 END
              + CASE WHEN array_length(tech_stack, 1) >= 3 THEN 2 ELSE 0 END
            ELSE 1
          END
        ) FROM projects WHERE projects.user_id = p_user_id AND NOT COALESCE(flagged, false)
      ), 0)
    ) + (
      COALESCE((
        SELECT COUNT(*) * 5
        FROM project_endorsements pe
        JOIN projects p ON p.id = pe.project_id
        WHERE p.user_id = p_user_id AND NOT COALESCE(p.flagged, false)
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

-- Step 2: Add endorsement trigger (if not exists)
CREATE OR REPLACE FUNCTION trigger_update_vibe_score_on_endorsement()
RETURNS TRIGGER AS $$
DECLARE
  v_project_owner UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT user_id INTO v_project_owner FROM projects WHERE id = OLD.project_id;
  ELSE
    SELECT user_id INTO v_project_owner FROM projects WHERE id = NEW.project_id;
  END IF;

  IF v_project_owner IS NOT NULL THEN
    PERFORM update_user_streak(v_project_owner);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_endorsement_change ON project_endorsements;
CREATE TRIGGER on_endorsement_change
  AFTER INSERT OR DELETE ON project_endorsements
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_vibe_score_on_endorsement();

-- Step 3: Auto-verify unverified projects where GitHub URL owner matches user's github_username
-- This catches all existing projects that should have been verified but weren't
UPDATE projects p
SET verified = true
FROM users u
WHERE p.user_id = u.id
  AND p.verified IS NOT TRUE
  AND p.github_url IS NOT NULL
  AND u.github_username IS NOT NULL
  AND u.github_username != ''
  AND LOWER(split_part(replace(replace(p.github_url, 'https://github.com/', ''), 'http://github.com/', ''), '/', 1))
    = LOWER(u.github_username);

-- Step 4: Recalculate vibe score for ALL users
DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN SELECT id FROM users LOOP
    PERFORM update_user_streak(u.id);
  END LOOP;
END;
$$;

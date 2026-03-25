-- Migration: Quality-weighted vibe score
-- Updates the vibe score calculation to reward project quality, not just count.
--
-- Per-project scoring (verified only get quality bonuses):
--   Base:              5 pts (verified) / 1 pt (unverified)
--   Live URL:         +3 pts
--   GitHub URL:       +2 pts
--   Description >50c: +2 pts
--   Screenshot/image: +1 pt
--   Tech stack ≥3:    +2 pts
--   Max per project:  15 pts

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
  v_project_score INTEGER := 0;
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

  -- Calculate quality-weighted project score
  SELECT COALESCE(SUM(
    CASE WHEN verified THEN 5 ELSE 1 END
    + CASE WHEN verified AND live_url IS NOT NULL AND live_url != '' THEN 3 ELSE 0 END
    + CASE WHEN verified AND github_url IS NOT NULL AND github_url != '' THEN 2 ELSE 0 END
    + CASE WHEN verified AND length(description) > 50 THEN 2 ELSE 0 END
    + CASE WHEN verified AND image_url IS NOT NULL AND image_url != '' THEN 1 ELSE 0 END
    + CASE WHEN verified AND array_length(tech_stack, 1) >= 3 THEN 2 ELSE 0 END
  ), 0)
  INTO v_project_score
  FROM projects
  WHERE projects.user_id = p_user_id AND NOT COALESCE(flagged, false);

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
    vibe_score = (v_current_streak * 2) + v_project_score + CASE
      WHEN GREATEST(longest_streak, v_longest_streak) >= 365 THEN 40
      WHEN GREATEST(longest_streak, v_longest_streak) >= 180 THEN 30
      WHEN GREATEST(longest_streak, v_longest_streak) >= 90 THEN 20
      WHEN GREATEST(longest_streak, v_longest_streak) >= 30 THEN 10
      ELSE 0
    END
    -- Review bonus: avg_rating × review_count × 2, capped at 50
    + LEAST(50, COALESCE((
      SELECT ROUND(AVG(rating) * COUNT(*) * 2)
      FROM reviews
      WHERE builder_id = p_user_id
    ), 0))
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Also fire on project UPDATE (e.g., when verified status or details change)
DROP TRIGGER IF EXISTS on_project_change ON projects;

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
  AFTER INSERT OR UPDATE OR DELETE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_vibe_score_on_project();

-- Trigger: recalculate vibe score when a review is added
-- Reviews now directly impact a builder's score, rewarding quality work.
CREATE OR REPLACE FUNCTION trigger_update_vibe_score_on_review()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_user_streak(NEW.builder_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_review_change ON reviews;

CREATE TRIGGER on_review_change
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_vibe_score_on_review();

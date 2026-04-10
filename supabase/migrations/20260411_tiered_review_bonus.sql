-- Migration: Tiered review bonus
-- Adds per-review tiered scoring: 5★ = +20, 4★ = +15, 3★ = +10, 2★ = +5, 1★ = +0
-- Only trusted reviews (trust_score >= 30) count toward vibe score.
-- Preserves all existing scoring: baseline 10, quality_score project integration,
-- endorsement bonus (+5 each), and badge bonus.

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
    vibe_score =
      -- Baseline: +10
      10
      -- Streak: current_streak × 2
      + (v_current_streak * 2)
      -- Project score: 2 base + 2 for live URL + 2 for GitHub repo + quality bonus
      + COALESCE((
        SELECT SUM(
          2
          + CASE WHEN live_url IS NOT NULL AND live_url != '' THEN 2 ELSE 0 END
          + CASE WHEN github_url IS NOT NULL AND github_url != '' THEN 2 ELSE 0 END
          + CASE WHEN quality_score > 0 THEN LEAST(quality_score, 100) ELSE 0 END
        ) FROM projects WHERE projects.user_id = p_user_id AND NOT COALESCE(flagged, false)
      ), 0)
      -- Endorsement bonus: +5 per endorsement received
      + COALESCE((
        SELECT COUNT(*) * 5
        FROM project_endorsements pe
        JOIN projects p ON p.id = pe.project_id
        WHERE p.user_id = p_user_id AND NOT COALESCE(p.flagged, false)
      ), 0)
      -- Badge bonus
      + CASE
        WHEN GREATEST(longest_streak, v_longest_streak) >= 365 THEN 40
        WHEN GREATEST(longest_streak, v_longest_streak) >= 180 THEN 30
        WHEN GREATEST(longest_streak, v_longest_streak) >= 90 THEN 20
        WHEN GREATEST(longest_streak, v_longest_streak) >= 30 THEN 10
        ELSE 0
      END
      -- Tiered review bonus: 5★=+20, 4★=+15, 3★=+10, 2★=+5, 1★=+0
      + COALESCE((
        SELECT SUM(
          CASE rating
            WHEN 5 THEN 20
            WHEN 4 THEN 15
            WHEN 3 THEN 10
            WHEN 2 THEN 5
            ELSE 0
          END
        )
        FROM reviews
        WHERE builder_id = p_user_id
          AND COALESCE(trust_score, 100) >= 30
      ), 0)
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Backfill: recompute vibe_score for all existing users
DO $$
DECLARE
  uid UUID;
BEGIN
  FOR uid IN SELECT id FROM users LOOP
    PERFORM update_user_streak(uid);
  END LOOP;
END;
$$;

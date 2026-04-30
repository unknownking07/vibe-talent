-- Add per-day commit volume awareness to vibe_score scoring.
--
-- Why: vibe_score was streak-dominated and ignored *volume* of work. A user
-- with 16k lifetime commits but no current streak scored lower than a brand-
-- new builder with a 50-day daily-touch streak. Beta user feedback (Meta
-- Alchemist, 2026-04-29 Telegram): "I have 16k commits, my score is lower
-- than others — that's not the right system."
--
-- This migration:
--   1. Adds streak_logs.commit_count (per-day actual commits, default 1 so
--      existing rows behave as before until cron repopulates).
--   2. Adds users.lifetime_contributions / users.contributions_30d
--      (denormalized totals from the daily GitHub heatmap parser; default 0).
--   3. Updates update_user_streak to include:
--        + LEAST(FLOOR(sqrt(max(0, lifetime))), 250)     -- lifetime credit
--        + LEAST(FLOOR(contributions_30d * 0.5), 50)     -- recent activity
--      Existing terms (streak, project, endorsements, badge, reviews) are
--      preserved verbatim from 20260426_harden_trigger_search_paths.sql.
--   4. Recalculates everyone's vibe_score under the new formula. The volume
--      bonus stays at +0 until the cron populates lifetime_contributions
--      and contributions_30d, so this initial recompute is a no-op for
--      every user — scores only move once real volume data lands.
--
-- All CREATE OR REPLACE / ADD COLUMN IF NOT EXISTS — safe to re-run.

-- ============================================================
-- 1. New columns
-- ============================================================
ALTER TABLE public.streak_logs
  ADD COLUMN IF NOT EXISTS commit_count int NOT NULL DEFAULT 1;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS lifetime_contributions int NOT NULL DEFAULT 0;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS contributions_30d int NOT NULL DEFAULT 0;

-- ============================================================
-- 2. update_user_streak with volume credit
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_user_streak(p_user_id UUID)
RETURNS void
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_streak INTEGER := 0;
  v_longest_streak INTEGER := 0;
  v_temp_streak INTEGER := 1;
  v_prev_date DATE;
  v_curr_date DATE;
  v_last_date DATE;
  v_today DATE := CURRENT_DATE;
  v_lifetime INTEGER := 0;
  v_30d INTEGER := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT DISTINCT activity_date
    FROM public.streak_logs
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

  -- Read denormalized volume totals (populated by daily cron, default 0).
  SELECT COALESCE(lifetime_contributions, 0), COALESCE(contributions_30d, 0)
    INTO v_lifetime, v_30d
    FROM public.users WHERE id = p_user_id;

  UPDATE public.users
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
      10
      + (v_current_streak * 2)
      + COALESCE((
        SELECT SUM(
          2
          + CASE WHEN live_url IS NOT NULL AND live_url != '' THEN 2 ELSE 0 END
          + CASE WHEN github_url IS NOT NULL AND github_url != '' THEN 2 ELSE 0 END
          + CASE WHEN quality_score > 0 THEN LEAST(quality_score, 100) ELSE 0 END
        ) FROM public.projects WHERE projects.user_id = p_user_id AND NOT COALESCE(flagged, false)
      ), 0)
      + COALESCE((
        SELECT COUNT(*) * 5
        FROM public.project_endorsements pe
        JOIN public.projects p ON p.id = pe.project_id
        WHERE p.user_id = p_user_id AND NOT COALESCE(p.flagged, false)
      ), 0)
      + CASE
        WHEN GREATEST(longest_streak, v_longest_streak) >= 365 THEN 40
        WHEN GREATEST(longest_streak, v_longest_streak) >= 180 THEN 30
        WHEN GREATEST(longest_streak, v_longest_streak) >= 90 THEN 20
        WHEN GREATEST(longest_streak, v_longest_streak) >= 30 THEN 10
        ELSE 0
      END
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
        FROM public.reviews
        WHERE builder_id = p_user_id
          AND COALESCE(trust_score, 100) >= 30
      ), 0)
      -- Lifetime contribution credit, sqrt-scaled. 100 → +10, 1k → +31,
      -- 10k → +100, 16k → +126, 62.5k+ → cap. Sqrt gives veterans visible
      -- separation from casuals while still capping bot-scale outliers.
      + LEAST(FLOOR(SQRT(GREATEST(0, v_lifetime)::numeric))::INTEGER, 250)
      -- Recent activity bonus. 100 commits in last 30d → +50 (capped).
      + LEAST(FLOOR(v_30d::numeric * 0.5)::INTEGER, 50)
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. Recompute everyone (no-op for volume bonus until cron populates the
--    new columns; non-volume terms stay identical to previous formula).
-- ============================================================
DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN SELECT id FROM public.users LOOP
    PERFORM public.update_user_streak(u.id);
  END LOOP;
END;
$$;

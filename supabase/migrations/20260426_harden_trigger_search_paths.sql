-- Harden every plpgsql trigger function against Supabase's "Function Search
-- Path Mutable" auto-tightening, which silently sets search_path = "" on
-- existing functions and breaks any unqualified table reference with
-- `relation "X" does not exist` (Postgres 42P01).
--
-- Incident (2026-04-26): notify_badge_change and notify_streak_milestone
-- both got search_path="" applied by Supabase, so the AFTER UPDATE triggers
-- on `users` failed when /api/streak's POST → update_user_streak ran. The
-- whole streak_logs INSERT transaction aborted → 500 in production.
--
-- This migration:
--   1. Sets `SET search_path = public, pg_temp` on every trigger function
--      so the next sweep can't break them.
--   2. Schema-qualifies every table reference (public.notifications,
--      public.users, etc.) so the function works even if search_path
--      is later forced empty again.
--
-- All CREATE OR REPLACE — safe to re-run.

-- ============================================================
-- update_user_streak: heavy lifter, recomputes streak + vibe_score.
-- Body matches 20260411_tiered_review_bonus.sql exactly, only adds
-- search_path setting and public.* qualifiers.
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
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- trigger_update_streak: AFTER INSERT on streak_logs
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_update_streak()
RETURNS TRIGGER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.update_user_streak(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- trigger_update_vibe_score_on_project: AFTER INSERT/UPDATE/DELETE on projects
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_update_vibe_score_on_project()
RETURNS TRIGGER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.update_user_streak(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM public.update_user_streak(NEW.user_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- trigger_update_vibe_score_on_endorsement: AFTER INSERT/DELETE on project_endorsements
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_update_vibe_score_on_endorsement()
RETURNS TRIGGER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_owner UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT user_id INTO v_project_owner FROM public.projects WHERE id = OLD.project_id;
  ELSE
    SELECT user_id INTO v_project_owner FROM public.projects WHERE id = NEW.project_id;
  END IF;

  IF v_project_owner IS NOT NULL THEN
    PERFORM public.update_user_streak(v_project_owner);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- trigger_update_vibe_score_on_review: AFTER INSERT on reviews
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_update_vibe_score_on_review()
RETURNS TRIGGER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.update_user_streak(NEW.builder_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- trigger_init_vibe_score: AFTER INSERT on users
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_init_vibe_score()
RETURNS TRIGGER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.update_user_streak(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- notify_badge_change: AFTER UPDATE OF badge_level on users
-- (Already fixed in production via direct SQL on 2026-04-26;
--  re-affirmed here so fresh environments get the fix too.)
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_badge_change()
RETURNS TRIGGER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.badge_level IS DISTINCT FROM NEW.badge_level AND NEW.badge_level != 'none' THEN
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.id, 'badge_earned', 'Badge earned!',
      'You earned the ' || NEW.badge_level || ' badge!',
      jsonb_build_object('badge_level', NEW.badge_level)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- notify_streak_milestone: AFTER UPDATE OF streak on users
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_streak_milestone()
RETURNS TRIGGER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.streak IN (7, 30, 90, 180, 365) AND (OLD.streak IS NULL OR OLD.streak < NEW.streak) THEN
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.id, 'streak_milestone', NEW.streak || '-day streak!',
      'You hit a ' || NEW.streak || '-day coding streak!',
      jsonb_build_object('streak_days', NEW.streak)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

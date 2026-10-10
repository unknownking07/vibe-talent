-- Apply this file individually after the matching application release. Never db push.
-- Activity remains visible, but commits, streaks, badges and old composite
-- quality scores cannot contribute to reputation, including the one-time reset.
BEGIN;

-- A new protected marker distinguishes fresh server proof from legacy claims.
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS verification_version integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.project_evidence_score(p public.projects)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN NOT COALESCE(p.verified, false) OR COALESCE(p.flagged, false)
    OR COALESCE(p.is_private, false) THEN 0 ELSE
    40
    + CASE WHEN p.quality_metrics->'has_readme' = 'true'::jsonb THEN 15 ELSE 0 END
    + CASE WHEN p.quality_metrics->'has_tests' = 'true'::jsonb THEN 15 ELSE 0 END
    + CASE WHEN p.quality_metrics->'has_ci' = 'true'::jsonb THEN 10 ELSE 0 END
    + CASE WHEN NULLIF(p.live_url, '') IS NOT NULL AND p.live_url_ok IS TRUE THEN 20 ELSE 0 END
  END;
$$;

CREATE OR REPLACE FUNCTION public.base_vibe_score(p_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT 10
    + COALESCE((SELECT MAX(public.project_evidence_score(p)) FROM public.projects p WHERE p.user_id = p_user_id), 0)
    + COALESCE((SELECT COUNT(*)::integer * 5 FROM public.project_endorsements pe
      JOIN public.projects p ON p.id = pe.project_id
      WHERE p.user_id = p_user_id AND NOT COALESCE(p.flagged, false)), 0)
    + COALESCE((SELECT SUM(CASE rating WHEN 5 THEN 20 WHEN 4 THEN 15 WHEN 3 THEN 10 WHEN 2 THEN 5 ELSE 0 END)::integer
      FROM public.reviews WHERE builder_id = p_user_id AND COALESCE(trust_score, 100) >= 30), 0);
$$;

CREATE OR REPLACE FUNCTION public.reputation_vibe_score(p_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.base_vibe_score(p_user_id)
    -- Preserve the existing vouch formula and caps. No payment changes.
    + COALESCE((
      SELECT LEAST(COALESCE(SUM(pts), 0), 25)::integer FROM (
        SELECT LEAST(FLOOR(SQRT(SUM(v.usd_at_burn)) * CASE
          WHEN vu.vibe_score < 20 THEN 0
          ELSE 0.5 + 0.5 * LEAST(vu.vibe_score::numeric / 200, 1)
        END), 5) AS pts
        FROM public.vouches v JOIN public.users vu ON vu.id = v.voucher_id
        WHERE v.builder_id = p_user_id GROUP BY v.voucher_id, vu.vibe_score
      ) per_voucher
    ), 0);
$$;

CREATE OR REPLACE FUNCTION public.update_user_streak(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_current integer := 0;
  v_longest integer := 0;
  v_run integer := 0;
  v_previous date;
  v_last date;
  rec record;
BEGIN
  FOR rec IN SELECT DISTINCT activity_date FROM public.streak_logs
    WHERE user_id = p_user_id AND activity_date <= CURRENT_DATE ORDER BY activity_date
  LOOP
    v_run := CASE WHEN rec.activity_date - v_previous = 1 THEN v_run + 1 ELSE 1 END;
    v_longest := GREATEST(v_longest, v_run);
    v_previous := rec.activity_date;
    v_last := rec.activity_date;
  END LOOP;
  IF v_last >= CURRENT_DATE - 1 THEN v_current := v_run; END IF;
  UPDATE public.users SET streak = v_current,
    longest_streak = GREATEST(longest_streak, v_longest),
    badge_level = CASE
      WHEN GREATEST(longest_streak, v_longest) >= 365 THEN 'diamond'::public.badge_level
      WHEN GREATEST(longest_streak, v_longest) >= 180 THEN 'gold'::public.badge_level
      WHEN GREATEST(longest_streak, v_longest) >= 90 THEN 'silver'::public.badge_level
      WHEN GREATEST(longest_streak, v_longest) >= 30 THEN 'bronze'::public.badge_level
      ELSE 'none'::public.badge_level END,
    vibe_score = public.reputation_vibe_score(p_user_id)
  WHERE id = p_user_id;
END;
$$;

-- Owners can edit project content, but only the server can insert projects
-- through the verification pipeline or write verification/scoring fields.
REVOKE INSERT, UPDATE ON public.projects FROM PUBLIC, anon, authenticated;
-- Also clear any earlier column grants, which table-level REVOKE does not remove.
DO $$ DECLARE cols text; BEGIN
  SELECT string_agg(quote_ident(attname), ', ') INTO cols FROM pg_attribute
    WHERE attrelid = 'public.projects'::regclass AND attnum > 0 AND NOT attisdropped;
  EXECUTE 'REVOKE INSERT (' || cols || '), UPDATE (' || cols || ') ON public.projects FROM PUBLIC, anon, authenticated';
END $$;
GRANT UPDATE (title, description, tech_stack, live_url, github_url, image_url, build_time, tags)
  ON public.projects TO authenticated;

CREATE OR REPLACE FUNCTION public.invalidate_project_evidence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.github_url IS DISTINCT FROM OLD.github_url THEN
    NEW.verified := false;
    NEW.quality_score := 0;
    NEW.quality_metrics := NULL;
    NEW.live_url_ok := NULL;
  END IF;
  IF NEW.live_url IS DISTINCT FROM OLD.live_url THEN NEW.live_url_ok := NULL; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS invalidate_project_evidence ON public.projects;
CREATE TRIGGER invalidate_project_evidence BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_project_evidence();

-- A client-writable profile handle must never establish GitHub ownership.
-- Preserve onboarding's existing write contract while deriving these fields
-- from Supabase's provider identity, which the user cannot edit directly.
CREATE OR REPLACE FUNCTION public.enforce_github_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE gh jsonb; raw_id text;
BEGIN
  -- Trusted server reconciliation resolves renames by GitHub's stable ID.
  IF current_setting('role', true) NOT IN ('anon', 'authenticated') THEN RETURN NEW; END IF;
  SELECT identity_data INTO gh FROM auth.identities
    WHERE user_id = NEW.id AND provider = 'github' LIMIT 1;
  NEW.github_username := COALESCE(gh->>'user_name', gh->>'preferred_username');
  raw_id := COALESCE(gh->>'sub', gh->>'provider_id');
  NEW.github_id := CASE WHEN raw_id ~ '^[0-9]{1,15}$' THEN raw_id::bigint ELSE NULL END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_github_identity ON public.users;
CREATE TRIGGER enforce_github_identity BEFORE INSERT OR UPDATE OF github_username, github_id ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_github_identity();
-- Repair previously client-editable mirrors. Clear the unique IDs first so
-- swapped/occupied forged IDs cannot make a correct repair violate uniqueness.
UPDATE public.users SET github_id = NULL;
UPDATE public.users u SET
  github_username = (SELECT COALESCE(i.identity_data->>'user_name', i.identity_data->>'preferred_username')
    FROM auth.identities i WHERE i.user_id=u.id AND i.provider='github' LIMIT 1),
  github_id = (SELECT CASE WHEN COALESCE(i.identity_data->>'sub', i.identity_data->>'provider_id') ~ '^[0-9]{1,15}$'
      THEN COALESCE(i.identity_data->>'sub', i.identity_data->>'provider_id')::bigint ELSE NULL END
    FROM auth.identities i WHERE i.user_id=u.id AND i.provider='github' LIMIT 1);

REVOKE EXECUTE ON FUNCTION public.project_evidence_score(public.projects), public.base_vibe_score(uuid),
  public.reputation_vibe_score(uuid), public.update_user_streak(uuid),
  public.invalidate_project_evidence(), public.enforce_github_identity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.project_evidence_score(public.projects), public.base_vibe_score(uuid),
  public.reputation_vibe_score(uuid), public.update_user_streak(uuid) TO service_role;

-- Legacy project proof fields were client-writable. Do not carry those claims
-- into the new scoring system. Backfill re-analyzes owner-matched public repos
-- through the protected server pipeline; file-proof/org repos can be reverified
-- manually. This also removes old activity-derived repository quality scores.
UPDATE public.projects SET verified=false, quality_score=0, quality_metrics=NULL,
  live_url_ok=NULL, last_verify_attempt_at=NULL WHERE verification_version < 2;

-- Existing totals contain activity credit: seed every user from evidence and
-- feedback first, then converge the UNCHANGED vouch calculation from below.
-- This prevents an inflated voucher's OLD score leaking into the new totals.
-- Each integer vouch bonus is bounded by 25; at most 25*N increases are possible.
UPDATE public.users u SET vibe_score = public.base_vibe_score(u.id);
DO $$
DECLARE changed integer; passes integer := 0; max_passes integer;
BEGIN
  SELECT COUNT(*)::integer * 25 + 1 INTO max_passes FROM public.users;
  LOOP
    UPDATE public.users u SET vibe_score = public.reputation_vibe_score(u.id)
      WHERE u.vibe_score IS DISTINCT FROM public.reputation_vibe_score(u.id);
    GET DIAGNOSTICS changed = ROW_COUNT;
    EXIT WHEN changed = 0;
    passes := passes + 1;
    IF passes > max_passes THEN RAISE EXCEPTION 'Vouch score convergence failed; migration rolled back'; END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;

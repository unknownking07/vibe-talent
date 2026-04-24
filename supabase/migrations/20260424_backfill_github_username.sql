-- Backfill users.github_username for builders who signed up via GitHub OAuth
-- but ended up with NULL github_username, so their verified badge never
-- appeared on their profile.
--
-- Root cause (now fixed): /auth/callback tries UPDATE users SET github_username
-- after OAuth, but for GitHub-first signups no public.users row exists yet
-- (users.username is NOT NULL, and the row is only created when the user
-- reaches profile-setup step 1). The UPDATE silently no-ops, and until today
-- step 1's upsert did not include github_username.
--
-- Affects users created between the GitHub-first signup rollout (commit
-- 1095cde, 2026-04-13) and the step 1 upsert fix (2026-04-24).

UPDATE public.users u
SET github_username = COALESCE(
  i.identity_data->>'user_name',
  i.identity_data->>'preferred_username'
)
FROM auth.identities i
WHERE i.user_id = u.id
  AND i.provider = 'github'
  AND u.github_username IS NULL
  AND COALESCE(
    i.identity_data->>'user_name',
    i.identity_data->>'preferred_username'
  ) IS NOT NULL;

-- Also ensure social_links.github is in sync so the GitHub link renders on the
-- profile. Safe no-op for rows where github is already set to a value — we
-- only fill in where it's NULL or missing.
INSERT INTO public.social_links (user_id, github)
SELECT u.id, u.github_username
FROM public.users u
WHERE u.github_username IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
SET github = EXCLUDED.github
WHERE public.social_links.github IS NULL;

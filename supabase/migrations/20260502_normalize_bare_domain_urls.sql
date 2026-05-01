-- Normalize project repo / live URLs and social-link websites that were stored
-- without a protocol (e.g. "github.com/owner/repo"). Bare-domain values render
-- as relative paths in the browser and produce broken links such as
--   https://www.vibetalent.work/profile/github.com/owner/repo
--
-- Going forward, the app's write paths (POST /api/projects, dashboard form,
-- profile-setup form) canonicalize input via normalizeRepoUrl / normalizeExternalUrl
-- before persisting. This migration cleans up any pre-existing rows so the
-- auto-verify cron jobs (which call parseGithubRepoUrl directly and require
-- https:// at the start) can re-process them.

UPDATE public.projects
SET github_url = 'https://' || github_url
WHERE github_url IS NOT NULL
  AND github_url <> ''
  AND github_url NOT LIKE 'http://%'
  AND github_url NOT LIKE 'https://%';

UPDATE public.projects
SET live_url = 'https://' || live_url
WHERE live_url IS NOT NULL
  AND live_url <> ''
  AND live_url NOT LIKE 'http://%'
  AND live_url NOT LIKE 'https://%';

UPDATE public.social_links
SET website = 'https://' || website
WHERE website IS NOT NULL
  AND website <> ''
  AND website NOT LIKE 'http://%'
  AND website NOT LIKE 'https://%';

-- Strip a stray www. so the cron path (which matches `(?:www\.)?github\.com`
-- but rewrites to canonical github.com via parseGithubRepoUrl) isn't surprised
-- by mixed-case hosts. Touch only the rows that need it.
UPDATE public.projects
SET github_url = regexp_replace(github_url, '^https?://www\.github\.com/', 'https://github.com/', 'i')
WHERE github_url ~* '^https?://www\.github\.com/';

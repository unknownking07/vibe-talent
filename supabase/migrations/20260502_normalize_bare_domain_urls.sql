-- Normalize project repo / live URLs and social-link websites that were stored
-- without a protocol (e.g. "github.com/owner/repo"). Bare-domain values render
-- as relative paths in the browser and produce broken links such as
--   https://www.vibetalent.work/profile/github.com/owner/repo
--
-- Going forward, the app's write paths (POST /api/projects, dashboard form,
-- profile-setup form, settings form) canonicalize input via
-- normalizeRepoUrl / normalizeExternalUrl before persisting. This migration
-- cleans up any pre-existing rows so the auto-verify cron jobs (which call
-- parseGithubRepoUrl directly and require https:// at the start) can
-- re-process them.
--
-- Detection notes (changed in response to review feedback):
--   * The "no scheme" predicate must be CASE-INSENSITIVE. A row stored as
--     `HTTPS://github.com/...` would slip past `NOT LIKE 'https://%'` and
--     get rewritten to `https://HTTPS://...` — silent corruption. We use
--     `!~* '^[a-z][a-z0-9+.-]*://'` so any valid URI scheme (in any case)
--     blocks the prepend.
--   * Use `btrim()` so leading/trailing whitespace doesn't fool the predicate
--     and doesn't end up persisted post-migration.
--   * The github-only `(www\.)?github\.com` filter on the first UPDATE
--     subsumes the trailing "strip www." pass that used to live below — the
--     `regexp_replace` here both prepends `https://` AND strips a `www.`
--     in one pass, so non-bare rows stay untouched.

-- Bare-domain GitHub URLs: prepend canonical https://github.com/ and strip
-- any leading www. in one shot. Limited to rows that look like a github
-- host so a stray bare domain in another table (e.g. live_url containing a
-- non-GitHub host) doesn't get its host rewritten by accident.
UPDATE public.projects
SET github_url = 'https://github.com/' ||
                 regexp_replace(btrim(github_url), '^(www\.)?github\.com/?', '', 'i')
WHERE github_url IS NOT NULL
  AND btrim(github_url) <> ''
  AND btrim(github_url) !~* '^[a-z][a-z0-9+.-]*://'
  AND btrim(github_url) ~* '^(www\.)?github\.com(/|$)';

-- Bare-domain live_urls: prepend https:// for any row missing a scheme.
UPDATE public.projects
SET live_url = 'https://' || btrim(live_url)
WHERE live_url IS NOT NULL
  AND btrim(live_url) <> ''
  AND btrim(live_url) !~* '^[a-z][a-z0-9+.-]*://';

-- Bare-domain social_links.website: same fix.
UPDATE public.social_links
SET website = 'https://' || btrim(website)
WHERE website IS NOT NULL
  AND btrim(website) <> ''
  AND btrim(website) !~* '^[a-z][a-z0-9+.-]*://';

-- Existing rows that already have a scheme but use `www.github.com` host:
-- normalize to canonical github.com so the verify-cron's regex
-- `(?:www\.)?github\.com` always rewrites to a single canonical URL.
UPDATE public.projects
SET github_url = regexp_replace(github_url, '^https?://www\.github\.com/', 'https://github.com/', 'i')
WHERE github_url ~* '^https?://www\.github\.com/';

import type { RepoQualityData } from "./types/database";

/**
 * GitHub Repository Quality Scoring
 *
 * Analyzes public GitHub repo data to produce an anti-gaming quality score.
 * Scores are based on signals that are hard to fake:
 *   - Community validation (stars, forks, external contributors)
 *   - Code substance (languages, file structure, tests, CI)
 *   - Maintenance (commit spread, recency)
 *   - Deployment (live URL health)
 */

export interface RepoQualityMetrics {
  // Raw GitHub data
  stars: number;
  forks: number;
  open_issues: number;
  contributors: number;
  total_commits: number;
  languages: Record<string, number>; // language -> bytes
  has_tests: boolean;
  has_ci: boolean;
  has_readme: boolean;
  readme_length: number;
  // True when the repo's README links back to this builder's VibeTalent
  // profile or badge. Deliberately does NOT feed any score: a README link is
  // trivially fakeable, and this file's whole premise is scoring only signals
  // that are hard to fake. It exists to render a "Badge Holder" chip.
  has_vibetalent_badge: boolean;
  last_commit_date: string | null;
  created_at: string | null;
  repo_age_days: number;
  // GitHub repo visibility — drives privacy gating across the app.
  is_private: boolean;

  // Computed scores (0-100 each)
  community_score: number;
  substance_score: number;
  maintenance_score: number;

  // Final composite
  quality_score: number;
}

// Discriminated error codes so callers can branch on what went wrong without
// brittle string parsing. `needs_repo_scope` means the GitHub API returned 404
// for a syntactically valid repo URL while the caller's token only carried
// public scope — i.e. it's almost certainly a private repo we can't read.
// Callers map this to a "private repos aren't supported yet" message (we use
// public-only OAuth; read-only private access is coming via a GitHub App).
export type RepoAnalysisErrorCode =
  | "not_found"
  | "rate_limited"
  | "needs_repo_scope"
  | "network_error"
  | "unknown";

export interface RepoAnalysisResult {
  success: boolean;
  metrics: RepoQualityMetrics | null;
  error?: string;
  errorCode?: RepoAnalysisErrorCode;
}

// Parse the comma-separated scope list GitHub returns in X-OAuth-Scopes on
// every authenticated response (including 404s). An empty/missing header
// means the request was unauthenticated, not that the token has no scopes.
function parseOAuthScopes(res: Response): string[] | null {
  const header = res.headers.get("x-oauth-scopes");
  if (header === null) return null;
  return header.split(",").map((s) => s.trim()).filter(Boolean);
}

const GITHUB_API = "https://api.github.com";

/**
 * Detect a VibeTalent badge / profile backlink in a README.
 *
 * Scoped to one username on purpose: matching any vibetalent.work link would
 * hand the chip to someone who pasted a *different* builder's badge (or merely
 * linked the site). With `username` supplied, only that builder's own badge or
 * profile URL counts.
 *
 * Matches the two shapes the dashboard's copy buttons emit, with or without
 * `www`, http or https, and tolerates percent-encoding (the copy helpers run
 * the username through encodeURIComponent):
 *   https://www.vibetalent.work/api/badge/<username>
 *   https://www.vibetalent.work/profile/<username>
 */
export function detectVibeTalentBadge(
  readme: string,
  username: string | null | undefined
): boolean {
  if (!readme || typeof username !== "string" || !username.trim()) return false;
  // Usernames are alphanumeric + [-_.], but decode first so an encoded form
  // still matches, and escape after so a username can never inject regex.
  let decoded = username.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Malformed escape sequence — fall back to the raw value.
  }
  const escaped = decoded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `https?://(?:www\\.)?vibetalent\\.work/(?:api/badge|profile)/${escaped}(?![A-Za-z0-9_-])`,
    "i"
  );
  return pattern.test(readme);
}

/**
 * Decode the base64 body GitHub returns from the /readme endpoint.
 * Returns "" when the payload is missing — GitHub omits `content` for files
 * over 1MB, which is not an error, just a README we can't inspect inline.
 *
 * atob (not Buffer) because this runs on Cloudflare Workers. The result is a
 * binary string, so multi-byte UTF-8 lands as mojibake — harmless here, since
 * we only ever search it for ASCII URLs.
 */
function decodeGithubContent(content: unknown, encoding: unknown): string {
  if (typeof content !== "string" || !content) return "";
  if (encoding !== "base64") return typeof content === "string" ? content : "";
  try {
    // GitHub wraps the base64 payload at 60 chars; atob rejects the newlines.
    return atob(content.replace(/\s/g, ""));
  } catch {
    return "";
  }
}

async function githubFetch(url: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "VibeTalent/1.0",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse a GitHub repo URL into { owner, repo }. Tolerates trailing slashes,
 * `.git` suffix, subpaths (`/tree/main`, `/blob/...`), query strings, and
 * hash fragments so user-pasted URLs don't silently fail owner-match checks.
 *
 * The owner segment is constrained to GitHub's username charset (alphanumeric
 * + single hyphens, max 39 chars) so reserved paths like `/login/oauth`,
 * `/settings/foo`, `/marketplace/bar` return null and don't burn a GitHub API
 * round-trip on callers that go straight to `analyzeRepository`.
 */
export function parseGithubRepoUrl(
  url: string | null | undefined
): { owner: string; repo: string } | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const match = trimmed.match(
    /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([^/\s?#]+)/i
  );
  if (!match) return null;
  const owner = match[1];
  const repo = match[2].replace(/\.git$/i, "");
  if (!owner || !repo) return null;
  return { owner, repo };
}

/**
 * Analyze a GitHub repository and return quality metrics. Reads only — repo
 * metadata, languages, contributors, file tree, README, commit count.
 *
 * Pass the caller's GitHub OAuth `token` (public scope) to read public repos
 * as the user and dodge unauthenticated rate limits. Private repos return 404
 * under public scope; we surface that as `needs_repo_scope` so callers can
 * show a "private repos aren't supported yet" message. (Read-only private
 * access will come from a fine-grained GitHub App, not the OAuth `repo` scope.)
 */
export async function analyzeRepository(
  owner: string,
  repo: string,
  token?: string,
  vibetalentUsername?: string | null
): Promise<RepoAnalysisResult> {
  try {
    // Fetch repo metadata, languages, contributors, and file tree in parallel
    const [repoRes, langRes, contribRes, treeRes] = await Promise.all([
      githubFetch(`${GITHUB_API}/repos/${owner}/${repo}`, token),
      githubFetch(`${GITHUB_API}/repos/${owner}/${repo}/languages`, token),
      githubFetch(`${GITHUB_API}/repos/${owner}/${repo}/contributors?per_page=1&anon=true`, token),
      githubFetch(`${GITHUB_API}/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, token),
    ]);

    if (!repoRes.ok) {
      if (repoRes.status === 404) {
        // A 404 from an authenticated request whose token carries only public
        // scope is the signature of a private repo we can't read. Flag it as
        // needs_repo_scope so callers can show the "not supported yet" message
        // rather than a generic "not found".
        const scopes = parseOAuthScopes(repoRes);
        if (token && scopes && !scopes.includes("repo")) {
          return {
            success: false,
            metrics: null,
            error: "Private repository — not supported yet.",
            errorCode: "needs_repo_scope",
          };
        }
        return { success: false, metrics: null, error: "Repository not found", errorCode: "not_found" };
      }
      if (repoRes.status === 403) {
        return {
          success: false,
          metrics: null,
          error: "GitHub API rate limit exceeded",
          errorCode: "rate_limited",
        };
      }
      return {
        success: false,
        metrics: null,
        error: `GitHub API error: ${repoRes.status}`,
        errorCode: "unknown",
      };
    }

    const repoData = await repoRes.json();
    const languages: Record<string, number> = langRes.ok ? await langRes.json() : {};

    // Contributor count from the Link header (total_count approach)
    let contributors = 1;
    if (contribRes.ok) {
      const linkHeader = contribRes.headers.get("link");
      if (linkHeader) {
        // Parse last page from Link header: <...?page=5>; rel="last"
        const lastMatch = linkHeader.match(/[?&]page=(\d+)>;\s*rel="last"/);
        if (lastMatch) {
          contributors = parseInt(lastMatch[1], 10);
        }
      } else {
        // No pagination, count from response body
        const contribData = await contribRes.json();
        contributors = Array.isArray(contribData) ? contribData.length : 1;
      }
    } else if (contribRes.status === 204) {
      // Empty repo — no contributors
      contributors = 0;
    }

    // Analyze file tree for tests, CI, README
    let has_tests = false;
    let has_ci = false;
    let has_readme = false;
    let readme_length = 0;

    if (treeRes.ok) {
      const treeData = await treeRes.json();
      const paths: string[] = (treeData.tree || []).map((f: { path: string }) => f.path.toLowerCase());

      has_tests = paths.some(
        (p) =>
          p.includes("test/") ||
          p.includes("tests/") ||
          p.includes("__tests__/") ||
          p.includes("spec/") ||
          p.endsWith(".test.ts") ||
          p.endsWith(".test.tsx") ||
          p.endsWith(".test.js") ||
          p.endsWith(".test.jsx") ||
          p.endsWith(".spec.ts") ||
          p.endsWith(".spec.js") ||
          p.endsWith("_test.go") ||
          p.endsWith("_test.py") ||
          p.includes("pytest") ||
          p.includes("jest.config") ||
          p.includes("vitest.config")
      );

      has_ci = paths.some(
        (p) =>
          p.startsWith(".github/workflows/") ||
          p === ".gitlab-ci.yml" ||
          p === "jenkinsfile" ||
          p === ".circleci/config.yml" ||
          p === ".travis.yml" ||
          p.includes("dockerfile") ||
          p === "docker-compose.yml"
      );

      has_readme = paths.some(
        (p) => p === "readme.md" || p === "readme.rst" || p === "readme.txt" || p === "readme"
      );
    }

    // Fetch README length if it exists. The same response already carries the
    // file body, so badge detection rides along on this request rather than
    // costing another GitHub API call against the rate limit.
    let has_vibetalent_badge = false;
    if (has_readme) {
      try {
        const readmeRes = await githubFetch(`${GITHUB_API}/repos/${owner}/${repo}/readme`, token);
        if (readmeRes.ok) {
          const readmeData = await readmeRes.json();
          readme_length = readmeData.size || 0;
          if (vibetalentUsername) {
            has_vibetalent_badge = detectVibeTalentBadge(
              decodeGithubContent(readmeData.content, readmeData.encoding),
              vibetalentUsername
            );
          }
        }
      } catch {
        // non-critical
      }
    }

    // Fetch commit count (use the default branch commit count from repo stats)
    let total_commits = 0;
    try {
      // Get commit count by fetching page 1 with per_page=1 and reading Link header
      const commitRes = await githubFetch(
        `${GITHUB_API}/repos/${owner}/${repo}/commits?per_page=1`,
        token
      );
      if (commitRes.ok) {
        const commitLink = commitRes.headers.get("link");
        if (commitLink) {
          const lastMatch = commitLink.match(/[?&]page=(\d+)>;\s*rel="last"/);
          if (lastMatch) {
            total_commits = parseInt(lastMatch[1], 10);
          }
        } else {
          total_commits = 1;
        }
      }
    } catch {
      // non-critical
    }

    const now = new Date();
    const createdAt = repoData.created_at ? new Date(repoData.created_at) : now;
    const lastPush = repoData.pushed_at ? new Date(repoData.pushed_at) : null;
    const repoAgeDays = Math.max(1, Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)));

    const stars = repoData.stargazers_count || 0;
    const forks = repoData.forks_count || 0;
    const open_issues = repoData.open_issues_count || 0;

    // --- SCORING ---

    // Community Score (0-100): stars, forks, contributors, issues from strangers
    // These are the hardest signals to fake
    const starPoints = Math.min(40, stars * 4);           // 10 stars = 40 pts (cap)
    const forkPoints = Math.min(20, forks * 5);           // 4 forks = 20 pts (cap)
    const contribPoints = Math.min(25, (contributors - 1) * 8); // 3 external contributors = 24 pts
    const issuePoints = Math.min(15, open_issues * 3);    // 5 issues = 15 pts
    const community_score = Math.min(100, starPoints + forkPoints + contribPoints + issuePoints);

    // Substance Score (0-100): LOC, languages, tests, CI, README
    const totalBytes = Object.values(languages).reduce((sum, b) => sum + b, 0);
    const langCount = Object.keys(languages).length;
    const locPoints = Math.min(25, Math.floor(totalBytes / 2000));  // ~50KB code = 25 pts
    const langPoints = Math.min(15, langCount * 5);                 // 3 languages = 15 pts
    const testPoints = has_tests ? 25 : 0;
    const ciPoints = has_ci ? 15 : 0;
    const readmePoints = has_readme ? Math.min(20, Math.floor(readme_length / 250)) : 0; // 5KB readme = 20 pts
    const substance_score = Math.min(100, locPoints + langPoints + testPoints + ciPoints + readmePoints);

    // Maintenance Score (0-100): commit count, recency, repo age
    const commitPoints = Math.min(35, Math.floor(total_commits / 3)); // 100+ commits = 33 pts
    const daysSinceLastPush = lastPush
      ? Math.floor((now.getTime() - lastPush.getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    const recencyPoints =
      daysSinceLastPush <= 7 ? 35 :
      daysSinceLastPush <= 30 ? 25 :
      daysSinceLastPush <= 90 ? 15 :
      daysSinceLastPush <= 180 ? 5 : 0;
    // Sustained work: commits per week of repo age
    const weeksAlive = Math.max(1, repoAgeDays / 7);
    const commitsPerWeek = total_commits / weeksAlive;
    const sustainedPoints = Math.min(30, Math.floor(commitsPerWeek * 10)); // 3 commits/week = 30 pts
    const maintenance_score = Math.min(100, commitPoints + recencyPoints + sustainedPoints);

    // Final composite — community weighted highest (hardest to fake)
    const quality_score = Math.round(
      community_score * 0.35 +
      substance_score * 0.35 +
      maintenance_score * 0.30
    );

    const metrics: RepoQualityMetrics = {
      stars,
      forks,
      open_issues,
      contributors,
      total_commits,
      languages,
      has_tests,
      has_ci,
      has_readme,
      readme_length,
      has_vibetalent_badge,
      last_commit_date: lastPush?.toISOString() || null,
      created_at: repoData.created_at || null,
      repo_age_days: repoAgeDays,
      is_private: Boolean(repoData.private),
      community_score,
      substance_score,
      maintenance_score,
      quality_score,
    };

    return { success: true, metrics };
  } catch (error) {
    return {
      success: false,
      metrics: null,
      error: error instanceof Error ? error.message : "Unknown error analyzing repository",
      errorCode: "network_error",
    };
  }
}

/**
 * Project the full analysis result down to the subset persisted in
 * `projects.quality_metrics`. All four write paths (project create, manual
 * verify, quality-rescore cron, verify-backfill cron) built this object by
 * hand and identically — one shared projection so a new metric can't reach
 * some paths and silently miss others.
 */
export function toRepoQualityData(
  metrics: RepoQualityMetrics,
  analyzedAt: string = new Date().toISOString()
): RepoQualityData {
  return {
    stars: metrics.stars,
    forks: metrics.forks,
    contributors: metrics.contributors,
    total_commits: metrics.total_commits,
    has_tests: metrics.has_tests,
    has_ci: metrics.has_ci,
    has_readme: metrics.has_readme,
    has_vibetalent_badge: metrics.has_vibetalent_badge,
    community_score: metrics.community_score,
    substance_score: metrics.substance_score,
    maintenance_score: metrics.maintenance_score,
    quality_score: metrics.quality_score,
    analyzed_at: analyzedAt,
  };
}

/**
 * Validate that a URL is safe to fetch (prevent SSRF).
 * Blocks private/reserved IP ranges, non-http(s) schemes, and internal hostnames.
 */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    // Block localhost, internal, and common private hostnames
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname === "metadata.google.internal" ||
      hostname === "169.254.169.254"
    ) {
      return false;
    }
    // Block private IP ranges (10.x, 172.16-31.x, 192.168.x)
    const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipMatch) {
      const [, a, b] = ipMatch.map(Number);
      if (a === 10) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
      if (a === 127) return false;
      if (a === 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a live URL is actually responding.
 * Returns true if the URL returns a 2xx or 3xx status.
 */
export async function checkLiveUrl(url: string): Promise<boolean> {
  if (!isSafeUrl(url)) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    // Some servers reject HEAD — retry with GET
    if (res.status === 405 || res.status === 403 || res.status === 501) {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 8000);
      try {
        const getRes = await fetch(url, {
          method: "GET",
          signal: controller2.signal,
          redirect: "follow",
        });
        clearTimeout(timeout2);
        return getRes.ok;
      } catch {
        clearTimeout(timeout2);
        return false;
      }
    }
    return res.ok || (res.status >= 300 && res.status < 400);
  } catch {
    clearTimeout(timeout);
    return false;
  }
}

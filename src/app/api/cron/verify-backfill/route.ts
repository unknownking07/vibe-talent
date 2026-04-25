import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeRepository, checkLiveUrl, parseGithubRepoUrl } from "@/lib/github-quality";
import { createNotification } from "@/lib/notifications";

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 2500;
const MAX_PROJECTS_PER_RUN = 200;
// How long to wait before re-attempting a project that we couldn't verify
// (owner mismatch, missing github_username, unparseable URL). Transient
// GitHub API failures don't bump this timestamp so they retry next run.
const RETRY_WINDOW_DAYS = 7;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cron job: Retry owner-match verification for unverified projects.
 *
 * Catches two cases that leave a project stuck at verified=false even when
 * the user legitimately owns the repo:
 *   1. Projects submitted before the fix that pulled the GitHub handle from
 *      OAuth user_metadata (which can be null for GitHub-linked-later accounts)
 *      instead of users.github_username.
 *   2. Transient GitHub API failures during the async after() callback in the
 *      submission flow — the project saved but auto-verify never completed.
 *
 * Only verifies via owner match. Projects needing .vibetalent file verification
 * still go through POST /api/projects/verify on demand.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  // Fail closed: in production a missing CRON_SECRET would otherwise leave this
  // endpoint open to anonymous callers who could spam 200 GitHub API requests,
  // DB updates, and notifications per hit.
  if (!cronSecret && process.env.NODE_ENV === "production") {
    console.error("verify-backfill: CRON_SECRET is not configured");
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  }
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  try {
    // Only consider projects whose last attempt is old (or never tried). Without
    // this gate the query would keep returning the same permanently-unprocessable
    // rows (owner mismatch, missing github_username) every run and starve newer
    // projects once the stuck backlog exceeds MAX_PROJECTS_PER_RUN.
    const retryWindow = new Date(Date.now() - RETRY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Two classes of candidates:
    //   1. verified=false — never (successfully) verified yet.
    //   2. verified=true AND quality_metrics IS NULL — legacy rows from the
    //      old auto-verify path that marked verified without metrics when
    //      the GitHub analysis silently failed (e.g. rate limit during
    //      the after() callback). These need a re-analysis to populate the
    //      quality_score; otherwise they show "Verified" with score 0 forever.
    const { data: candidates, error: projectsError } = await sb
      .from("projects")
      .select("id, user_id, github_url, live_url, title, verified")
      .or("verified.eq.false,quality_metrics.is.null")
      .eq("flagged", false)
      .not("github_url", "is", null)
      .neq("github_url", "")
      .or(`last_verify_attempt_at.is.null,last_verify_attempt_at.lt.${retryWindow}`)
      .order("created_at", { ascending: true })
      .limit(MAX_PROJECTS_PER_RUN);

    if (projectsError) {
      console.error("verify-backfill: failed to fetch projects:", projectsError);
      return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
    }

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ message: "No unverified projects to check", verified: 0 });
    }

    // Resolve each candidate's GitHub handle from the authoritative DB column.
    // One query for all users referenced by the batch avoids per-project lookups.
    const userIds: string[] = Array.from(
      new Set(candidates.map((p: { user_id: string }) => p.user_id))
    );
    const { data: userRows } = await sb
      .from("users")
      .select("id, github_username")
      .in("id", userIds)
      .not("github_username", "is", null);

    const usernameById = new Map<string, string>();
    for (const row of (userRows ?? []) as { id: string; github_username: string }[]) {
      if (row.github_username) usernameById.set(row.id, row.github_username);
    }

    // Stamp non-verifiable-via-owner-match projects so the next run skips them
    // for RETRY_WINDOW_DAYS and works through the rest of the backlog instead.
    async function markAttempted(projectId: string) {
      await sb
        .from("projects")
        .update({ last_verify_attempt_at: new Date().toISOString() })
        .eq("id", projectId);
    }

    let verified = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(
          async (project: {
            id: string;
            user_id: string;
            github_url: string;
            live_url: string | null;
            title: string;
            verified: boolean;
          }) => {
            try {
              const parsed = parseGithubRepoUrl(project.github_url);
              if (!parsed) {
                skipped++;
                await markAttempted(project.id);
                return;
              }

              const githubUsername = usernameById.get(project.user_id);
              if (!githubUsername) {
                skipped++;
                await markAttempted(project.id);
                return;
              }

              if (parsed.owner.toLowerCase() !== githubUsername.toLowerCase()) {
                skipped++;
                await markAttempted(project.id);
                return;
              }

              const { owner: repoOwner, repo: repoName } = parsed;
              const qualityResult = await analyzeRepository(repoOwner, repoName);

              // If GitHub API fails entirely, skip WITHOUT stamping — leave it
              // for a future run to retry. Don't mark verified without a valid
              // check, and don't push it into the retry-window deadzone.
              if (!qualityResult.success) {
                errors++;
                return;
              }

              const qualityScore = qualityResult.metrics?.quality_score ?? 0;
              const qualityMetrics = qualityResult.metrics
                ? {
                    stars: qualityResult.metrics.stars,
                    forks: qualityResult.metrics.forks,
                    contributors: qualityResult.metrics.contributors,
                    total_commits: qualityResult.metrics.total_commits,
                    has_tests: qualityResult.metrics.has_tests,
                    has_ci: qualityResult.metrics.has_ci,
                    has_readme: qualityResult.metrics.has_readme,
                    community_score: qualityResult.metrics.community_score,
                    substance_score: qualityResult.metrics.substance_score,
                    maintenance_score: qualityResult.metrics.maintenance_score,
                    quality_score: qualityResult.metrics.quality_score,
                    analyzed_at: new Date().toISOString(),
                  }
                : null;

              let live_url_ok: boolean | null = null;
              if (project.live_url) {
                live_url_ok = await checkLiveUrl(project.live_url);
              }

              const { error: updateError } = await sb
                .from("projects")
                .update({
                  verified: true,
                  quality_score: qualityScore,
                  quality_metrics: qualityMetrics,
                  live_url_ok,
                  last_verify_attempt_at: new Date().toISOString(),
                })
                .eq("id", project.id);

              if (updateError) {
                throw updateError;
              }

              verified++;

              // Only notify on the first verification — projects already
              // verified are just getting their quality_metrics backfilled.
              if (!project.verified) {
                createNotification({
                  user_id: project.user_id,
                  type: "project_verified",
                  title: "Project auto-verified",
                  message: `Your project "${project.title}" was auto-verified. Quality score: ${qualityScore}/100.`,
                  metadata: { project_id: project.id, quality_score: qualityScore },
                }).catch((err) => console.error("verify-backfill: notification failed:", err));
              }
            } catch (err) {
              console.error(`verify-backfill: failed for project ${project.id}:`, err);
              errors++;
            }
          }
        )
      );

      if (i + BATCH_SIZE < candidates.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    console.log(
      `verify-backfill complete: ${verified} verified, ${skipped} skipped, ${errors} errors (of ${candidates.length})`
    );

    return NextResponse.json({
      message: `verify-backfill complete`,
      verified,
      skipped,
      errors,
      total_checked: candidates.length,
    });
  } catch (error) {
    console.error("verify-backfill cron error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

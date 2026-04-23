import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeRepository, checkLiveUrl, parseGithubRepoUrl } from "@/lib/github-quality";
import { createNotification } from "@/lib/notifications";

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 2500;
const MAX_PROJECTS_PER_RUN = 200;

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
    const { data: candidates, error: projectsError } = await sb
      .from("projects")
      .select("id, user_id, github_url, live_url, title")
      .eq("verified", false)
      .eq("flagged", false)
      .not("github_url", "is", null)
      .neq("github_url", "")
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
    const userIds = Array.from(new Set(candidates.map((p: { user_id: string }) => p.user_id)));
    const { data: userRows } = await sb
      .from("users")
      .select("id, github_username")
      .in("id", userIds)
      .not("github_username", "is", null);

    const usernameById = new Map<string, string>();
    for (const row of (userRows ?? []) as { id: string; github_username: string }[]) {
      if (row.github_username) usernameById.set(row.id, row.github_username);
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
          }) => {
            try {
              const parsed = parseGithubRepoUrl(project.github_url);
              if (!parsed) {
                skipped++;
                return;
              }

              const githubUsername = usernameById.get(project.user_id);
              if (!githubUsername) {
                skipped++;
                return;
              }

              if (parsed.owner.toLowerCase() !== githubUsername.toLowerCase()) {
                skipped++;
                return;
              }

              const { owner: repoOwner, repo: repoName } = parsed;
              const qualityResult = await analyzeRepository(repoOwner, repoName);

              // If GitHub API fails entirely, skip — leave unverified so a
              // future run retries. Don't mark verified without a valid check.
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
                })
                .eq("id", project.id);

              if (updateError) {
                throw updateError;
              }

              verified++;

              createNotification({
                user_id: project.user_id,
                type: "project_verified",
                title: "Project auto-verified",
                message: `Your project "${project.title}" was auto-verified. Quality score: ${qualityScore}/100.`,
                metadata: { project_id: project.id, quality_score: qualityScore },
              }).catch((err) => console.error("verify-backfill: notification failed:", err));
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

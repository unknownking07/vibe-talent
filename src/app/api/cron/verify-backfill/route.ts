import { repositoryControlVerified } from "@/lib/project-verification";
import { readGithubIdentity, type GithubIdentity } from "@/lib/github-identity";
import { writeProjectAnalysis } from "@/lib/project-analysis-write";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeRepository, checkLiveUrl, parseGithubRepoUrl, toRepoQualityData } from "@/lib/github-quality";
import { createNotification } from "@/lib/notifications";

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 2500;
const MAX_PROJECTS_PER_RUN = 200;
// Hard ceiling on the linked-users prefetch. PostgREST silently caps
// .select() at 1,000 rows by default; without an explicit .range() the
// prefilter would start missing legitimate users once the platform crosses
// 1k. 100k is several orders of magnitude above current size and still
// well under any sensible memory limit.
const MAX_LINKED_USERS = 100_000;
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
 * Proves control with immutable GitHub owner IDs or an explicit account UUID
 * in .vibetalent. Legacy username-only file proofs require an updated file.
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

    // Pre-fetch the set of user IDs that actually have a github_username set,
    // so the candidate query can exclude projects whose owner can't be
    // owner-matched anyway. Without this prefilter, the LIMIT(MAX_PROJECTS_PER_RUN)
    // budget could be entirely consumed by missing-username rows that we now
    // skip without stamping (which would let them re-enter the next run forever),
    // starving legitimate owner-mismatch retries.
    const { data: linkedUserRows, error: linkedUsersError } = await sb
      .from("users")
      .select("id, github_username, github_id, username")
      .not("github_username", "is", null)
      .neq("github_username", "")
      .order("id", { ascending: true })
      .range(0, MAX_LINKED_USERS - 1);

    if (linkedUsersError) {
      console.error("verify-backfill: failed to fetch linked users:", linkedUsersError);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    const usernameById = new Map<string, string>();
    // Separate map for the VibeTalent profile slug — that's what appears in
    // badge/profile URLs we look for in the README, not the GitHub handle.
    const profileUsernameById = new Map<string, string>();
    for (const row of (linkedUserRows ?? []) as { id: string; github_username: string; github_id: number | null; username: string | null }[]) {
      if (row.github_username) usernameById.set(row.id, row.github_username);
      if (row.username) profileUsernameById.set(row.id, row.username);
    }

    if (usernameById.size === 0) {
      return NextResponse.json({ message: "No users with github_username set", verified: 0 });
    }

    if (usernameById.size === MAX_LINKED_USERS) {
      console.warn(
        `verify-backfill: hit MAX_LINKED_USERS=${MAX_LINKED_USERS} cap on the user prefetch — bump the constant if the platform has grown beyond that.`
      );
    }

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
      .in("user_id", Array.from(usernameById.keys()))
      .order("created_at", { ascending: true })
      .limit(MAX_PROJECTS_PER_RUN);

    if (projectsError) {
      console.error("verify-backfill: failed to fetch projects:", projectsError);
      return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
    }

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ message: "No unverified projects to check", verified: 0 });
    }

    // Stamp non-verifiable-via-owner-match projects so the next run skips them
    // for RETRY_WINDOW_DAYS and works through the rest of the backlog instead.
    async function markAttempted(project: { id: string; user_id: string; github_url: string; live_url: string | null }) {
      const query = sb
        .from("projects")
        .update({ last_verify_attempt_at: new Date().toISOString() })
        .eq("id", project.id)
        .eq("user_id", project.user_id)
        .eq("github_url", project.github_url);
      const { error } = await (project.live_url === null
        ? query.is("live_url", null)
        : query.eq("live_url", project.live_url));
      if (error) throw error;
    }

    const ownerProofs = new Map<string, Promise<GithubIdentity | null>>();
    const verifiedOwner = (ownerId: string) => {
      let proof = ownerProofs.get(ownerId);
      if (!proof) {
        proof = (async () => {
          const { data, error } = await supabase.auth.admin.getUserById(ownerId);
          if (error) throw error;
          return readGithubIdentity(data.user);
        })();
        ownerProofs.set(ownerId, proof);
      }
      return proof;
    };

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
                await markAttempted(project);
                return;
              }

              const githubIdentity = await verifiedOwner(project.user_id);
              if (!githubIdentity) {
                // A stored mirror alone is not proof. The provider may have
                // been disconnected since the candidate query. Retry after a
                // new GitHub connection rather than trusting editable metadata.
                skipped++;
                return;
              }

              const { owner: repoOwner, repo: repoName } = parsed;
              const qualityResult = await analyzeRepository(
                repoOwner,
                repoName,
                process.env.GITHUB_TOKEN,
                profileUsernameById.get(project.user_id) ?? null
              );

              // If GitHub API fails entirely, skip WITHOUT stamping — leave it
              // for a future run to retry. Don't mark verified without a valid
              // check, and don't push it into the retry-window deadzone.
              if (!qualityResult.success) {
                // Deleted/private repositories are expected candidate outcomes,
                // not scheduler outages. Keep them unverified and retry later.
                if (qualityResult.errorCode === "not_found" || qualityResult.errorCode === "needs_repo_scope") {
                  await markAttempted(project);
                  skipped++;
                  return;
                }
                errors++;
                return;
              }

              if (!await repositoryControlVerified(repoOwner, repoName, qualityResult.metrics?.owner_github_id, githubIdentity.id, project.user_id, process.env.GITHUB_TOKEN)) {
                skipped++;
                await markAttempted(project);
                return;
              }

              const qualityScore = qualityResult.metrics?.quality_score ?? 0;
              const qualityMetrics = qualityResult.metrics
                ? toRepoQualityData(qualityResult.metrics)
                : null;

              let live_url_ok: boolean | null = null;
              if (project.live_url) {
                live_url_ok = await checkLiveUrl(project.live_url);
              }

              const { data: saved, error: updateError } = await writeProjectAnalysis(sb, project, {
                  verified: true,
                  quality_score: qualityScore,
                  quality_metrics: qualityMetrics,
                  live_url_ok,
                  is_private: qualityResult.metrics?.is_private ?? false,
                  last_verify_attempt_at: new Date().toISOString(),
                });

              if (updateError) {
                throw updateError;
              }

              if (!saved) { skipped++; return; }
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

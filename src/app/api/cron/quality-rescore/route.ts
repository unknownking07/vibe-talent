import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeRepository, checkLiveUrl, parseGithubRepoUrl } from "@/lib/github-quality";

// Each project costs 4 api.github.com calls. At 50 projects per run that's
// 200 calls — well over the 60/hr anonymous limit. Plus default 60s Vercel
// timeout can't fit even half of a full run. Pro plan caps maxDuration at
// 300s; combined with a GITHUB_TOKEN bumping us to 5000/hr, this lets the
// cron actually finish.
export const maxDuration = 300;

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 2500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cron job: Re-score verified projects that haven't been analyzed in 7+ days.
 * Updates quality_score, quality_metrics, and live_url_ok.
 * Triggers DB function to recalculate vibe_score via the on_project_change trigger.
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

  // Pass GITHUB_TOKEN through to analyzeRepository so we get the 5000/hr
  // authenticated rate limit instead of the 60/hr anonymous one. Token is
  // optional; without it the cron still runs but will only get through ~15
  // projects before api.github.com starts returning 403s.
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.warn(
      "[quality-rescore] GITHUB_TOKEN not set — anonymous api.github.com " +
      "limit is 60/hr per IP and each project costs 4 calls, so only ~15 " +
      "projects can be analyzed per run. Add a GitHub PAT to GITHUB_TOKEN."
    );
  }

  try {
    // Find verified projects with a GitHub URL that were last analyzed 7+ days ago (or never)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    // Query projects that need rescoring: never analyzed OR analyzed_at older than 7 days
    const { data: needsRescore, error: projectsError } = await sb
      .from("projects")
      .select("id, user_id, github_url, live_url, quality_metrics")
      .eq("verified", true)
      .not("github_url", "is", null)
      .neq("github_url", "")
      .eq("flagged", false)
      .or(`quality_metrics.is.null,quality_metrics->>analyzed_at.is.null,quality_metrics->>analyzed_at.lt.${sevenDaysAgo}`)
      .order("created_at", { ascending: true })
      .limit(50);

    if (projectsError) {
      console.error("Failed to fetch projects for rescore:", projectsError);
      return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
    }

    if (needsRescore.length === 0) {
      return NextResponse.json({ message: "No projects need rescoring", rescored: 0 });
    }

    let rescored = 0;
    let errors = 0;

    for (let i = 0; i < needsRescore.length; i += BATCH_SIZE) {
      const batch = needsRescore.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (project: { id: string; user_id: string; github_url: string; live_url: string | null }) => {
          try {
            const parsed = parseGithubRepoUrl(project.github_url);
            if (!parsed) return;

            const { owner: repoOwner, repo: repoName } = parsed;

            const qualityResult = await analyzeRepository(repoOwner, repoName, githubToken);
            const qualityScore = qualityResult.success ? (qualityResult.metrics?.quality_score ?? 0) : 0;
            const qualityMetrics = (qualityResult.success && qualityResult.metrics)
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

            // Update triggers on_project_change which recalculates vibe_score
            const { error: updateError } = await sb.from("projects").update({
              quality_score: qualityScore,
              quality_metrics: qualityMetrics,
              live_url_ok,
            }).eq("id", project.id);

            if (updateError) {
              throw updateError;
            }

            rescored++;
          } catch (err) {
            console.error(`Failed to rescore project ${project.id}:`, err);
            errors++;
          }
        })
      );

      if (i + BATCH_SIZE < needsRescore.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    console.log(`Quality rescore complete: ${rescored} rescored, ${errors} errors`);

    return NextResponse.json({
      message: `Quality rescore complete: ${rescored} rescored, ${errors} errors`,
      rescored,
      errors,
      total_checked: needsRescore.length,
    });
  } catch (error) {
    console.error("Quality rescore cron error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

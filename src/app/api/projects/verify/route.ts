import { repositoryControlVerified } from "@/lib/project-verification";
import { createAdminClient } from "@/lib/supabase/admin";
import { readGithubIdentity } from "@/lib/github-identity";
import { writeProjectAnalysis } from "@/lib/project-analysis-write";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";
import {
  analyzeRepository,
  checkLiveUrl,
  parseGithubRepoUrl,
  toRepoQualityData,
} from "@/lib/github-quality";

/**
 * Invalidate the cached profile read so the new "Verified" badge appears
 * immediately instead of waiting up to 60s for the unstable_cache TTL on
 * fetchUserByUsernameCached. Returns silently if the username can't be
 * resolved — caching is best-effort.
 */
async function invalidateProfileCache(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  userId: string,
): Promise<void> {
  try {
    const { data: userRow } = await sb
      .from("users")
      .select("username")
      .eq("id", userId)
      .single();
    if (userRow?.username) {
      // Mirror the call shape used by /api/endorsements: { expire: 0 } forces
      // the tagged cache entry to be evicted immediately rather than on its
      // next read. Next.js 16 made the second arg required.
      revalidateTag(`user-${userRow.username}`, { expire: 0 });
    }
  } catch (err) {
    console.error("Failed to revalidate profile cache after verify:", err);
  }
}

export async function POST(request: Request) {
  try {
    const { project_id } = await request.json();

    if (!project_id) {
      return NextResponse.json(
        { error: "project_id is required" },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabaseClient();

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // GitHub provider token from the current session — required for private
    // repos. Stale sessions may not have it; we fall back to unauthenticated
    // requests, which is fine for public repos but will 404 on private.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const providerToken = session?.provider_token ?? undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any;

    // Only provider identity data establishes ownership; fetch the public slug for receipts.
    const { data: userRow } = await sb
      .from("users")
      .select("username")
      .eq("id", user.id)
      .single();

    const githubIdentity = readGithubIdentity(user);

    const profileUsername: string | null = userRow?.username ?? null;

    if (!githubIdentity) {
      return NextResponse.json(
        {
          verified: false,
          reason:
            "No GitHub username found in your account. Please log in with GitHub OAuth.",
        },
        { status: 200 },
      );
    }

    // Fetch the project
    const { data: project, error: projectError } = await sb
      .from("projects")
      .select("id, user_id, github_url, live_url")
      .eq("id", project_id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Ensure user owns this project
    if (project.user_id !== user.id) {
      return NextResponse.json(
        { error: "You can only verify your own projects" },
        { status: 403 },
      );
    }

    if (!project.github_url) {
      return NextResponse.json(
        {
          verified: false,
          reason: "No GitHub URL set for this project. Add a GitHub URL first.",
        },
        { status: 200 },
      );
    }

    // Parse repo owner and name from the stored GitHub URL. Tolerates .git
    // suffix, trailing slashes, and subpaths like /tree/main so a legitimate
    // URL doesn't fail verification on a regex technicality.
    const parsed = parseGithubRepoUrl(project.github_url);

    if (!parsed) {
      return NextResponse.json(
        {
          verified: false,
          reason:
            "Invalid GitHub URL format. Expected: https://github.com/{owner}/{repo}",
        },
        { status: 200 },
      );
    }

    const { owner: repoOwner, repo: repoName } = parsed;

    const qualityResult = await analyzeRepository(
      repoOwner,
      repoName,
      providerToken,
      profileUsername,
    );
    if (
      qualityResult.errorCode === "needs_repo_scope" ||
      qualityResult.metrics?.is_private
    ) {
      return NextResponse.json({
        verified: false,
        reason: "Private repositories aren't supported yet.",
        code: "private_unsupported",
      });
    }
    if (!qualityResult.success || !qualityResult.metrics) {
      return NextResponse.json({
        verified: false,
        reason: "Repository analysis failed. Please retry verification.",
      });
    }
    const verified = await repositoryControlVerified(
      repoOwner,
      repoName,
      qualityResult.metrics.owner_github_id,
      githubIdentity.id,
      user.id,
      providerToken,
    );
    if (!verified) {
      return NextResponse.json({
        verified: false,
        reason: `GitHub ownership was not confirmed. For a shared repository, put your VibeTalent account ID ${user.id} on its own line in a .vibetalent file at the repository root, then retry.`,
      });
    }
    const qualityScore = qualityResult.metrics.quality_score;
    const live_url_ok = project.live_url
      ? await checkLiveUrl(project.live_url)
      : null;
    const { data: saved, error: saveError } = await writeProjectAnalysis(
      sb,
      project,
      {
        verified: true,
        quality_score: qualityScore,
        quality_metrics: toRepoQualityData(qualityResult.metrics),
        live_url_ok,
        is_private: qualityResult.metrics.is_private,
      },
    );
    if (saveError)
      return NextResponse.json(
        { error: "Failed to save verification" },
        { status: 500 },
      );
    if (!saved)
      return NextResponse.json(
        {
          verified: false,
          reason: "Project changed during verification. Please retry.",
        },
        { status: 409 },
      );
    createNotification({
      user_id: user.id,
      type: "project_verified",
      title: "Project verified",
      message: `Your project has been verified. Repository checks: ${qualityScore}/100.`,
      metadata: { project_id, quality_score: qualityScore },
    }).catch(console.error);
    await invalidateProfileCache(sb, user.id);
    return NextResponse.json({
      verified: true,
      reason:
        qualityResult.metrics.owner_github_id === githubIdentity.id &&
        githubIdentity.id !== null
          ? "Repository owner ID matches your linked GitHub account."
          : "Verification file (.vibetalent) names your VibeTalent account.",
      method:
        qualityResult.metrics.owner_github_id === githubIdentity.id &&
        githubIdentity.id !== null
          ? "owner_match"
          : "verification_file",
      quality_score: qualityScore,
      quality_metrics: toRepoQualityData(qualityResult.metrics),
      live_url_ok,
      shipped_receipt_url: profileUsername
        ? `/share/${encodeURIComponent(profileUsername)}/shipped/${project.id}`
        : null,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

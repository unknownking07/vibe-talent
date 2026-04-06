import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";
import { analyzeRepository, checkLiveUrl } from "@/lib/github-quality";

export async function POST(request: Request) {
  try {
    const { project_id } = await request.json();

    if (!project_id) {
      return NextResponse.json(
        { error: "project_id is required" },
        { status: 400 }
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

    // Get GitHub username from auth metadata
    const githubUsername =
      user.user_metadata?.user_name ||
      user.user_metadata?.preferred_username ||
      null;

    if (!githubUsername) {
      return NextResponse.json(
        {
          verified: false,
          reason:
            "No GitHub username found in your account. Please log in with GitHub OAuth.",
        },
        { status: 200 }
      );
    }

    // Fetch the project
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data: project, error: projectError } = await sb
      .from("projects")
      .select("id, user_id, github_url")
      .eq("id", project_id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Ensure user owns this project
    if (project.user_id !== user.id) {
      return NextResponse.json(
        { error: "You can only verify your own projects" },
        { status: 403 }
      );
    }

    if (!project.github_url) {
      return NextResponse.json(
        {
          verified: false,
          reason: "No GitHub URL set for this project. Add a GitHub URL first.",
        },
        { status: 200 }
      );
    }

    // Parse repo owner and name from GitHub URL
    // e.g., https://github.com/unknownking07/vibe-talent -> owner=unknownking07, repo=vibe-talent
    const githubUrlMatch = project.github_url.match(
      /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/
    );

    if (!githubUrlMatch) {
      return NextResponse.json(
        {
          verified: false,
          reason:
            "Invalid GitHub URL format. Expected: https://github.com/{owner}/{repo}",
        },
        { status: 200 }
      );
    }

    const repoOwner = githubUrlMatch[1];
    const repoName = githubUrlMatch[2].replace(/\.git$/, "");

    // Method 1: Owner match
    if (repoOwner.toLowerCase() === githubUsername.toLowerCase()) {
      // Run quality analysis on the repo
      const qualityResult = await analyzeRepository(repoOwner, repoName);
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

      // Check live URL health if provided
      let live_url_ok: boolean | null = null;
      const { data: fullProject } = await sb
        .from("projects")
        .select("live_url")
        .eq("id", project_id)
        .single();
      if (fullProject?.live_url) {
        live_url_ok = await checkLiveUrl(fullProject.live_url);
      }

      await sb
        .from("projects")
        .update({
          verified: true,
          quality_score: qualityScore,
          quality_metrics: qualityMetrics,
          live_url_ok,
        })
        .eq("id", project_id);

      createNotification({
        user_id: user.id,
        type: "project_verified",
        title: "Project verified",
        message: `Your project has been verified via owner match. Quality score: ${qualityScore}/100.`,
        metadata: { project_id, quality_score: qualityScore },
      }).catch(console.error);

      return NextResponse.json({
        verified: true,
        reason: "Repository owner matches your GitHub username.",
        method: "owner_match",
        quality_score: qualityScore,
        quality_metrics: qualityMetrics,
        live_url_ok,
      });
    }

    // Method 2: Verification file check
    // Check if the repo contains a .vibetalent file at root
    try {
      const fileResponse = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/contents/.vibetalent`,
        {
          headers: {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "VibeTalent-Verification",
          },
        }
      );

      if (fileResponse.ok) {
        const fileData = await fileResponse.json();

        // Decode the file content (base64 encoded by GitHub API)
        let fileContent = "";
        if (fileData.content) {
          fileContent = Buffer.from(fileData.content, "base64")
            .toString("utf-8")
            .trim();
        }

        // Check if file contains the user's GitHub username or user ID
        if (
          fileContent.includes(githubUsername) ||
          fileContent.includes(user.id)
        ) {
          // Run quality analysis on the repo
          const qualityResult = await analyzeRepository(repoOwner, repoName);
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

          // Check live URL health
          let live_url_ok: boolean | null = null;
          const { data: fullProject } = await sb
            .from("projects")
            .select("live_url")
            .eq("id", project_id)
            .single();
          if (fullProject?.live_url) {
            live_url_ok = await checkLiveUrl(fullProject.live_url);
          }

          await sb
            .from("projects")
            .update({
              verified: true,
              quality_score: qualityScore,
              quality_metrics: qualityMetrics,
              live_url_ok,
            })
            .eq("id", project_id);

          createNotification({
            user_id: user.id,
            type: "project_verified",
            title: "Project verified",
            message: `Your project has been verified via verification file. Quality score: ${qualityScore}/100.`,
            metadata: { project_id, quality_score: qualityScore },
          }).catch(console.error);

          return NextResponse.json({
            verified: true,
            reason:
              "Verification file (.vibetalent) found with your credentials.",
            method: "verification_file",
            quality_score: qualityScore,
            quality_metrics: qualityMetrics,
            live_url_ok,
          });
        } else {
          return NextResponse.json({
            verified: false,
            reason: `Verification file found but does not contain your GitHub username ("${githubUsername}") or user ID. Update the .vibetalent file in the repo root.`,
          });
        }
      }
    } catch {
      // GitHub API request failed, fall through to instructions
    }

    // Neither method worked
    return NextResponse.json({
      verified: false,
      reason: `Repository owner "${repoOwner}" does not match your GitHub username "${githubUsername}". To verify, add a file called ".vibetalent" to the root of the repo containing your GitHub username "${githubUsername}" or your user ID "${user.id}".`,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

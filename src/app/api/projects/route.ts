import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { projectsLimiter, checkRateLimit, getIP } from "@/lib/rate-limit";
import { analyzeRepository, checkLiveUrl, parseGithubRepoUrl } from "@/lib/github-quality";
import { createNotification } from "@/lib/notifications";

// GET /api/projects — List projects (public)
export async function GET(request: NextRequest) {
  const { success } = await checkRateLimit(projectsLimiter, getIP(request));
  if (!success) {
    return NextResponse.json({ projects: [] }, { status: 429 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("projects")
      .select("id, user_id, title, description, tech_stack, live_url, github_url, image_url, build_time, tags, verified, quality_score, quality_metrics, live_url_ok, endorsement_count, created_at")
      .eq("flagged", false)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ projects: [] });
    }

    return NextResponse.json({ projects: data || [] });
  } catch {
    return NextResponse.json({ projects: [] });
  }
}

// POST /api/projects — Create a project (auth required)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, tech_stack, live_url, github_url, build_time, tags } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!description || typeof description !== "string" || description.trim().length === 0) {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }
    if (title.length > 100) {
      return NextResponse.json({ error: "title must be 100 characters or less" }, { status: 400 });
    }
    if (description.length > 500) {
      return NextResponse.json({ error: "description must be 500 characters or less" }, { status: 400 });
    }

    // At least one of live_url or github_url is required so the project is verifiable.
    const liveUrlTrim = typeof live_url === "string" ? live_url.trim() : "";
    const githubUrlTrim = typeof github_url === "string" ? github_url.trim() : "";
    if (!liveUrlTrim && !githubUrlTrim) {
      return NextResponse.json(
        { error: "Add a live URL or a GitHub repo — at least one is required." },
        { status: 400 }
      );
    }
    if (liveUrlTrim && !liveUrlTrim.match(/^https:\/\/.+/)) {
      return NextResponse.json({ error: "live_url must be a valid HTTPS URL" }, { status: 400 });
    }
    if (githubUrlTrim && !githubUrlTrim.match(/^https?:\/\/github\.com\/.+/)) {
      return NextResponse.json({ error: "github_url must be a valid GitHub URL" }, { status: 400 });
    }

    // Use authenticated user's ID, NOT client-supplied user_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from("projects").insert({
      user_id: user.id,
      title: title.trim().slice(0, 100),
      description: description.trim().slice(0, 500),
      tech_stack: Array.isArray(tech_stack) ? tech_stack.slice(0, 20).map((t: string) => String(t).trim().slice(0, 50)) : [],
      live_url: liveUrlTrim || null,
      github_url: githubUrlTrim || null,
      build_time: build_time ? String(build_time).trim().slice(0, 50) : null,
      tags: Array.isArray(tags) ? tags.slice(0, 10).map((t: string) => String(t).trim().slice(0, 30)) : [],
    }).select().single();

    if (error) {
      return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }

    // Auto-verify if GitHub URL owner matches authenticated user's GitHub username.
    // Source of truth for the handle is users.github_username (synced from the
    // GitHub identity on every OAuth callback, covering linked-later accounts
    // whose user_metadata doesn't hold the GitHub handle). OAuth metadata is a
    // fallback for the first-login edge case before the callback has written.
    if (data && githubUrlTrim) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: userRow } = await (supabase as any)
        .from("users")
        .select("github_username")
        .eq("id", user.id)
        .single();

      const githubUsername =
        userRow?.github_username ||
        user.user_metadata?.user_name ||
        user.user_metadata?.preferred_username ||
        null;

      const parsed = parseGithubRepoUrl(githubUrlTrim);
      if (githubUsername && parsed && parsed.owner.toLowerCase() === githubUsername.toLowerCase()) {
        const { owner: repoOwner, repo: repoName } = parsed;

        // Run quality analysis + live URL check after response (guaranteed by Next.js after())
        after(async () => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sb = supabase as any;
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

            let live_url_ok: boolean | null = null;
            if (liveUrlTrim) {
              live_url_ok = await checkLiveUrl(liveUrlTrim);
            }

            const { error: updateError } = await sb.from("projects").update({
              verified: true,
              quality_score: qualityScore,
              quality_metrics: qualityMetrics,
              live_url_ok,
            }).eq("id", data.id);

            if (!updateError) {
              createNotification({
                user_id: user.id,
                type: "project_verified",
                title: "Project auto-verified",
                message: `Your project "${data.title}" was auto-verified. Quality score: ${qualityScore}/100.`,
                metadata: { project_id: data.id, quality_score: qualityScore },
              }).catch(console.error);
            } else {
              console.error("Auto-verify update failed for project", data.id, updateError);
            }
          } catch (err) {
            console.error("Auto-verify failed for project", data.id, err);
          }
        });
      }
    }

    return NextResponse.json({ project: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

// DELETE /api/projects — Delete a project (auth required, owner only)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Only delete if user owns the project
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("projects")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

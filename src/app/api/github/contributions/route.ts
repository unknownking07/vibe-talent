import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchGitHubContributions } from "@/lib/github-contributions";

/**
 * GET /api/github/contributions
 *
 * Two modes:
 * 1. No params → returns contributions for the logged-in user
 * 2. ?github=username → returns contributions for any public GitHub user (for profile pages)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let githubUsername = searchParams.get("github");

    if (githubUsername) {
      // Public mode: fetch for any GitHub username
      githubUsername = githubUsername
        .replace(/^@/, "")
        .replace(/^https?:\/\/(www\.)?github\.com\//, "")
        .replace(/\/+$/, "")
        .trim();

      if (!githubUsername || !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(githubUsername)) {
        return NextResponse.json({ contributions: {}, total: 0 });
      }

      const data = await fetchGitHubContributions(githubUsername);
      return NextResponse.json(data, {
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" },
      });
    }

    // Authenticated mode: fetch for logged-in user
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sb = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: socials } = await (sb as any)
      .from("social_links")
      .select("github")
      .eq("user_id", user.id)
      .single();

    githubUsername = socials?.github;
    if (!githubUsername) {
      return NextResponse.json({ contributions: {}, total: 0 });
    }

    githubUsername = githubUsername
      .replace(/^@/, "")
      .replace(/^https?:\/\/(www\.)?github\.com\//, "")
      .replace(/\/+$/, "")
      .trim();

    if (!githubUsername) {
      return NextResponse.json({ contributions: {}, total: 0 });
    }

    const data = await fetchGitHubContributions(githubUsername);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, s-maxage=3600, stale-while-revalidate=7200" },
    });
  } catch (error) {
    console.error("GitHub contributions error:", error);
    return NextResponse.json({ contributions: {}, total: 0 });
  }
}

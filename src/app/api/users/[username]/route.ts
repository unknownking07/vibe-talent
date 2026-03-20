import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// GET /api/users/[username] — Get user profile
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  try {
    const supabase = await createServerSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const { data: user, error } = await sb
      .from("users")
      .select("id, username, bio, avatar_url, vibe_score, streak, longest_streak, badge_level, created_at")
      .eq("username", username)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [{ data: projects }, { data: socialLinks }] = await Promise.all([
      sb
        .from("projects")
        .select("id, title, description, tech_stack, live_url, github_url, image_url, build_time, tags, verified, created_at")
        .eq("user_id", user.id)
        .eq("flagged", false)
        .order("created_at", { ascending: false }),
      sb
        .from("social_links")
        .select("twitter, telegram, github, website, farcaster")
        .eq("user_id", user.id)
        .single(),
    ]);

    const { id: _id, ...publicUser } = user;

    return NextResponse.json(
      {
        user: {
          ...publicUser,
          projects: projects || [],
          social_links: socialLinks || null,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
}

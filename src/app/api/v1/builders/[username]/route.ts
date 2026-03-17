import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const supabase = await createServerSupabaseClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: user, error } = await (supabase as any)
      .from("users")
      .select("id, username, bio, avatar_url, vibe_score, streak, longest_streak, badge_level, created_at")
      .eq("username", username)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: "Builder not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: projects, error: projectsError } = await (supabase as any)
      .from("projects")
      .select("id, title, description, tech_stack, live_url, github_url, image_url, build_time, tags, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (projectsError) {
      console.error("Failed to fetch projects:", projectsError);
      return NextResponse.json(
        { error: "Failed to fetch projects" },
        { status: 500, headers: corsHeaders }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: socialLinks, error: socialLinksError } = await (supabase as any)
      .from("social_links")
      .select("twitter, telegram, github, website, farcaster")
      .eq("user_id", user.id)
      .single();

    if (socialLinksError && socialLinksError.code !== "PGRST116") {
      console.error("Failed to fetch social links:", socialLinksError);
      return NextResponse.json(
        { error: "Failed to fetch social links" },
        { status: 500, headers: corsHeaders }
      );
    }

    const builder = {
      username: user.username,
      bio: user.bio,
      avatar_url: user.avatar_url,
      vibe_score: user.vibe_score,
      streak: user.streak,
      longest_streak: user.longest_streak,
      badge_level: user.badge_level,
      created_at: user.created_at,
      projects: (projects || []).map(
        (p: {
          id: string;
          title: string;
          description: string;
          tech_stack: string[];
          live_url: string | null;
          github_url: string | null;
          image_url: string | null;
          build_time: string | null;
          tags: string[];
          created_at: string;
        }) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          tech_stack: p.tech_stack,
          live_url: p.live_url,
          github_url: p.github_url,
          image_url: p.image_url,
          build_time: p.build_time,
          tags: p.tags,
          created_at: p.created_at,
        })
      ),
      social_links: socialLinks
        ? {
            twitter: socialLinks.twitter,
            telegram: socialLinks.telegram,
            github: socialLinks.github,
            website: socialLinks.website,
            farcaster: socialLinks.farcaster,
          }
        : null,
    };

    return NextResponse.json({ builder }, { headers: corsHeaders });
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

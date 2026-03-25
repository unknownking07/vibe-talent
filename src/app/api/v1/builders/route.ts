import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "X-RateLimit-Limit": "100",
  "X-RateLimit-Window": "60",
  "Cache-Control": "public, max-age=60",
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const skills = searchParams.get("skills");
    const minStreak = searchParams.get("min_streak");
    const minVibeScore = searchParams.get("min_vibe_score");
    const sort = searchParams.get("sort") || "vibe_score";
    const limitParam = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "20", 10) || 20, 1),
      100
    );

    const supabase = await createServerSupabaseClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any).from("users").select("id, username, bio, avatar_url, vibe_score, streak, longest_streak, badge_level");

    if (minStreak) {
      const parsed = parseInt(minStreak, 10);
      query = query.gte("streak", isNaN(parsed) ? 0 : parsed);
    }
    if (minVibeScore) {
      const parsed = parseInt(minVibeScore, 10);
      query = query.gte("vibe_score", isNaN(parsed) ? 0 : parsed);
    }

    const sortColumn =
      sort === "streak"
        ? "streak"
        : sort === "projects"
          ? "vibe_score"
          : "vibe_score";
    query = query.order(sortColumn, { ascending: false }).limit(limitParam);

    const { data: users, error } = await query;

    if (error) {
      console.error("Failed to fetch builders:", error);
      return NextResponse.json(
        { error: "Failed to fetch builders" },
        { status: 500, headers: corsHeaders }
      );
    }

    if (!users || users.length === 0) {
      return NextResponse.json(
        { builders: [], total: 0 },
        { headers: corsHeaders }
      );
    }

    const userIds = users.map((u: { id: string }) => u.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: projects, error: projectsError } = await (supabase as any)
      .from("projects")
      .select("user_id, tech_stack")
      .in("user_id", userIds)
      .eq("flagged", false);

    if (projectsError) {
      console.error("Failed to fetch projects:", projectsError);
      return NextResponse.json(
        { error: "Failed to fetch projects" },
        { status: 500, headers: corsHeaders }
      );
    }

    // Build per-user project counts and aggregated tech stacks
    const projectCountMap: Record<string, number> = {};
    const techStackMap: Record<string, Set<string>> = {};
    for (const p of projects || []) {
      projectCountMap[p.user_id] = (projectCountMap[p.user_id] || 0) + 1;
      if (!techStackMap[p.user_id]) techStackMap[p.user_id] = new Set();
      for (const tech of p.tech_stack || []) {
        techStackMap[p.user_id].add(tech);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let builders = users.map((user: any) => ({
      username: user.username,
      bio: user.bio,
      avatar_url: user.avatar_url,
      vibe_score: user.vibe_score,
      streak: user.streak,
      longest_streak: user.longest_streak,
      badge_level: user.badge_level,
      projects_count: projectCountMap[user.id] || 0,
      tech_stack: Array.from(techStackMap[user.id] || []),
    }));

    // Filter by skills if provided
    if (skills) {
      const skillList = skills
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (skillList.length > 0) {
        builders = builders.filter((b: { tech_stack: string[] }) =>
          skillList.some((skill) =>
            (b.tech_stack ?? []).some((t) => t.toLowerCase().includes(skill))
          )
        );
      }
    }

    // Sort by projects count if requested (can't do in DB)
    if (sort === "projects") {
      builders.sort(
        (a: { projects_count: number }, b: { projects_count: number }) =>
          b.projects_count - a.projects_count
      );
    }

    return NextResponse.json(
      { builders, total: builders.length },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

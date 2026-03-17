import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// GET /api/leaderboard?sort=vibe_score|streak|projects&limit=10
export async function GET(request: NextRequest) {
  const sort = request.nextUrl.searchParams.get("sort") || "vibe_score";
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "10");

  try {
    const supabase = await createServerSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const orderColumn = sort === "projects" ? "vibe_score" : sort === "streak" ? "longest_streak" : "vibe_score";
    const { data: users, error } = await sb
      .from("users")
      .select("*")
      .order(orderColumn, { ascending: false })
      .limit(limit);

    if (error || !users) {
      return NextResponse.json({ leaderboard: [] });
    }

    const userIds = users.map((u: { id: string }) => u.id);
    const { data: projects } = await sb.from("projects").select("*").in("user_id", userIds);

    const leaderboard = users.map((user: { id: string; username: string; avatar_url: string | null; vibe_score: number; streak: number; longest_streak: number; badge_level: string }, index: number) => ({
      rank: index + 1,
      id: user.id,
      username: user.username,
      avatar_url: user.avatar_url,
      vibe_score: user.vibe_score,
      streak: user.streak,
      longest_streak: user.longest_streak,
      badge_level: user.badge_level,
      project_count: (projects || []).filter((p: { user_id: string }) => p.user_id === user.id).length,
    }));

    return NextResponse.json({ leaderboard });
  } catch {
    return NextResponse.json({ leaderboard: [] });
  }
}

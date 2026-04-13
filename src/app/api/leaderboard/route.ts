import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// GET /api/leaderboard?sort=vibe_score|streak|projects&limit=10
export async function GET(request: NextRequest) {
  const sort = request.nextUrl.searchParams.get("sort") || "vibe_score";
  const rawLimit = parseInt(request.nextUrl.searchParams.get("limit") || "10");
  const limit = Math.min(Math.max(isNaN(rawLimit) ? 10 : rawLimit, 1), 100);

  try {
    const supabase = await createServerSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const orderColumn = sort === "projects" ? "vibe_score" : sort === "streak" ? "longest_streak" : "vibe_score";
    const { data: users, error } = await sb
      .from("users")
      .select("id, username, avatar_url, vibe_score, streak, longest_streak, badge_level")
      .not("username", "is", null)
      .order(orderColumn, { ascending: false })
      .limit(limit);

    if (error || !users) {
      return NextResponse.json({ leaderboard: [] });
    }

    const userIds = users.map((u: { id: string }) => u.id);
    const { data: projects } = await sb.from("projects").select("user_id").in("user_id", userIds).eq("flagged", false);

    const leaderboard = users.map((user: { id: string; username: string; avatar_url: string | null; vibe_score: number; streak: number; longest_streak: number; badge_level: string }, index: number) => ({
      rank: index + 1,
      username: user.username,
      avatar_url: user.avatar_url,
      vibe_score: user.vibe_score,
      streak: user.streak,
      longest_streak: user.longest_streak,
      badge_level: user.badge_level,
      project_count: (projects || []).filter((p: { user_id: string }) => p.user_id === user.id).length,
    }));

    return NextResponse.json(
      { leaderboard },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch {
    return NextResponse.json({ leaderboard: [] });
  }
}

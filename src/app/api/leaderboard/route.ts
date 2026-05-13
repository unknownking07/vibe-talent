import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { computeClimbers, MIN_VIBE_FLOOR } from "@/lib/leaderboard/weekly";
import { mondayOf } from "@/lib/cron-jobs/weekly-snapshot";

// GET /api/leaderboard?sort=vibe_score|streak|projects&limit=10&range=all|week
export async function GET(request: NextRequest) {
  const sort = request.nextUrl.searchParams.get("sort") || "vibe_score";
  const rawLimit = parseInt(request.nextUrl.searchParams.get("limit") || "10");
  const limit = Math.min(Math.max(isNaN(rawLimit) ? 10 : rawLimit, 1), 100);
  const range = request.nextUrl.searchParams.get("range") || "all";

  try {
    const supabase = await createServerSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    if (range === "week") {
      const monday = mondayOf(new Date()).toISOString().slice(0, 10);

      const { data: snapshots } = await sb
        .from("vibe_score_weekly_snapshots")
        .select("user_id, rank, vibe_score")
        .eq("week_start", monday);

      const { data: current } = await sb
        .from("users")
        .select("id, username, avatar_url, vibe_score")
        .not("username", "is", null)
        .gte("vibe_score", MIN_VIBE_FLOOR)
        .order("vibe_score", { ascending: false });

      const ranked = (current ?? []).map(
        (u: { id: string; username: string; avatar_url: string | null; vibe_score: number }, i: number) => ({
          ...u,
          rank: i + 1,
        })
      );

      const climbers = computeClimbers(snapshots ?? [], ranked).slice(0, limit);

      return NextResponse.json(
        { leaderboard: climbers, range: "week", week_start: monday },
        {
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
          },
        }
      );
    }

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

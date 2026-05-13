import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { computeActiveBuilders } from "@/lib/leaderboard/weekly";

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
      // Last 7 days inclusive of today: today + 6 prior days = 7 calendar dates.
      // (Using -7 here would span 8 distinct dates, which is wrong.)
      const windowStart = new Date();
      windowStart.setUTCDate(windowStart.getUTCDate() - 6);
      const windowStartStr = windowStart.toISOString().slice(0, 10);

      const { data: logs } = await sb
        .from("streak_logs")
        .select("user_id, activity_date, commit_count")
        .gte("activity_date", windowStartStr);

      // Aggregate distinct dates AND sum commit counts per user
      const datesByUser = new Map<string, Set<string>>();
      const commitsByUser = new Map<string, number>();
      for (const log of (logs ?? []) as Array<{ user_id: string; activity_date: string; commit_count: number }>) {
        let s = datesByUser.get(log.user_id);
        if (!s) {
          s = new Set();
          datesByUser.set(log.user_id, s);
        }
        s.add(log.activity_date);
        commitsByUser.set(log.user_id, (commitsByUser.get(log.user_id) ?? 0) + (log.commit_count ?? 1));
      }
      const activeDaysByUserId = new Map<string, number>();
      for (const [uid, dates] of datesByUser) activeDaysByUserId.set(uid, dates.size);

      // Take top 200 active user IDs to bound the user query
      const topUserIds = [...activeDaysByUserId.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 200)
        .map(([uid]) => uid);

      if (topUserIds.length === 0) {
        return NextResponse.json(
          { leaderboard: [], range: "week", mode: "active" },
          { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
        );
      }

      const { data: users } = await sb
        .from("users")
        .select("id, username, avatar_url, vibe_score, streak")
        .in("id", topUserIds)
        .not("username", "is", null);

      const { data: allRanked } = await sb
        .from("users")
        .select("id")
        .not("username", "is", null)
        .order("vibe_score", { ascending: false });
      const rankByUserId = new Map<string, number>();
      (allRanked ?? []).forEach((u: { id: string }, i: number) => rankByUserId.set(u.id, i + 1));

      const enriched = (users ?? []).map((u: { id: string; username: string; avatar_url: string | null; vibe_score: number; streak: number }) => ({
        id: u.id,
        username: u.username,
        avatar_url: u.avatar_url,
        vibe_score: u.vibe_score,
        streak: u.streak ?? 0,
        rank: rankByUserId.get(u.id) ?? 9999,
      }));

      const builders = computeActiveBuilders(activeDaysByUserId, commitsByUser, enriched).slice(0, limit);

      return NextResponse.json(
        { leaderboard: builders, range: "week", mode: "active" },
        { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
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

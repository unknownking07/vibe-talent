import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = getAdminClient() as any;

    const [
      { count: totalBuilders },
      { count: totalProjects },
      { data: streakData },
      { data: badgeData },
      { count: totalHires },
      { count: totalEndorsements },
      { data: recentUsers },
      { count: activeStreakCount },
    ] = await Promise.all([
      sb.from("users").select("id", { count: "exact", head: true }),
      sb.from("projects").select("id", { count: "exact", head: true }),
      sb.from("users").select("streak, longest_streak, vibe_score").limit(500),
      sb.from("users").select("badge_level").not("badge_level", "is", null).limit(500),
      sb.from("hire_requests").select("id", { count: "exact", head: true }),
      sb.from("endorsements").select("id", { count: "exact", head: true }),
      sb.from("users").select("created_at").order("created_at", { ascending: false }).limit(100),
      sb.from("users").select("id", { count: "exact", head: true }).gt("streak", 0),
    ]);

    // Compute stats
    const builders = totalBuilders || 0;
    const projects = totalProjects || 0;
    const hires = totalHires || 0;
    const endorsements = totalEndorsements || 0;

    // Streak stats
    const streaks = streakData || [];
    const avgStreak = streaks.length > 0
      ? Math.round(streaks.reduce((a: number, u: { streak: number }) => a + u.streak, 0) / streaks.length)
      : 0;
    const maxStreak = streaks.length > 0
      ? Math.max(...streaks.map((u: { longest_streak: number }) => u.longest_streak || 0))
      : 0;
    const activeStreaks = activeStreakCount || 0;
    const totalVibeScore = streaks.reduce((a: number, u: { vibe_score: number }) => a + (u.vibe_score || 0), 0);
    const avgVibeScore = streaks.length > 0 ? Math.round(totalVibeScore / streaks.length) : 0;

    // Badge distribution
    const badges: Record<string, number> = { none: 0, bronze: 0, silver: 0, gold: 0, diamond: 0 };
    for (const u of (badgeData || [])) {
      const level = (u.badge_level || "none").toLowerCase();
      badges[level] = (badges[level] || 0) + 1;
    }
    badges.none = builders - Object.values(badges).reduce((a, b) => a + b, 0) + badges.none;

    // Growth: users joined in last 7 days vs previous 7 days
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
    const recent = (recentUsers || []) as { created_at: string }[];
    const thisWeek = recent.filter(u => new Date(u.created_at) >= weekAgo).length;
    const lastWeek = recent.filter(u => new Date(u.created_at) >= twoWeeksAgo && new Date(u.created_at) < weekAgo).length;
    const growthPct = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : thisWeek > 0 ? 100 : 0;

    return NextResponse.json({
      builders,
      projects,
      hires,
      endorsements,
      avgStreak,
      maxStreak,
      activeStreaks,
      avgVibeScore,
      badges,
      growth: {
        thisWeek,
        lastWeek,
        pct: growthPct,
      },
      timestamp: new Date().toISOString(),
    }, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}

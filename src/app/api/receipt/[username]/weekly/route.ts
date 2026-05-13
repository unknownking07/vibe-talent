import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mondayOf } from "@/lib/cron-jobs/weekly-snapshot";

export async function GET(req: NextRequest, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const weekParam = req.nextUrl.searchParams.get("week");
  // week format: YYYY-MM-DD (Monday) — defaults to current Monday
  const weekStart = weekParam ?? mondayOf(new Date()).toISOString().slice(0, 10);

  const sb = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: user } = await (sb as any)
    .from("users").select("id, username, vibe_score, streak, longest_streak").eq("username", username).single();

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: thisWeek } = await (sb as any)
    .from("vibe_score_weekly_snapshots").select("rank, vibe_score").eq("user_id", user.id).eq("week_start", weekStart).maybeSingle();

  // Previous Monday for delta
  const prevMonday = new Date(weekStart);
  prevMonday.setUTCDate(prevMonday.getUTCDate() - 7);
  const prevMondayStr = prevMonday.toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prevWeek } = await (sb as any)
    .from("vibe_score_weekly_snapshots").select("rank, vibe_score").eq("user_id", user.id).eq("week_start", prevMondayStr).maybeSingle();

  return NextResponse.json({
    username: user.username,
    weekStart,
    vibeScore: user.vibe_score,
    scoreDelta: thisWeek && prevWeek ? thisWeek.vibe_score - prevWeek.vibe_score : null,
    rank: thisWeek?.rank ?? null,
    rankClimb: thisWeek && prevWeek ? prevWeek.rank - thisWeek.rank : null,
    streak: user.streak,
    ogImageUrl: `/api/og/receipt/weekly/${user.username}?w=${weekStart}`,
    shareUrl: `/share/${user.username}/weekly/${weekStart}`,
  }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}

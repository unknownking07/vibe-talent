import { NextRequest, NextResponse } from "next/server";
import { calculateStreak, getBadgeLevel, calculateVibeScore } from "@/lib/streak";

// POST /api/streak — Log activity for a user
export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    const today = new Date().toISOString().split("T")[0];

    // In production, this would insert into Supabase:
    // const { data, error } = await supabase
    //   .from("streak_logs")
    //   .upsert({ user_id, activity_date: today }, { onConflict: "user_id,activity_date" });

    // Then fetch all streak logs for the user:
    // const { data: logs } = await supabase
    //   .from("streak_logs")
    //   .select("activity_date")
    //   .eq("user_id", user_id)
    //   .order("activity_date", { ascending: true });

    // Mock response
    return NextResponse.json({
      success: true,
      activity_date: today,
      message: "Activity logged successfully",
    });
  } catch {
    return NextResponse.json({ error: "Failed to log activity" }, { status: 500 });
  }
}

// GET /api/streak?user_id=xxx — Get streak info for a user
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  // In production, fetch from Supabase:
  // const { data: logs } = await supabase
  //   .from("streak_logs")
  //   .select("activity_date")
  //   .eq("user_id", userId)
  //   .order("activity_date", { ascending: true });

  // Mock: generate some dates
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < 45; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split("T")[0]);
  }

  const { currentStreak, longestStreak } = calculateStreak(dates);
  const badgeLevel = getBadgeLevel(longestStreak);
  const vibeScore = calculateVibeScore(currentStreak, 5, badgeLevel);

  return NextResponse.json({
    user_id: userId,
    current_streak: currentStreak,
    longest_streak: longestStreak,
    badge_level: badgeLevel,
    vibe_score: vibeScore,
  });
}

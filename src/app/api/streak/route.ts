import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { calculateStreak, getBadgeLevel, calculateVibeScore } from "@/lib/streak";
import { messagesLimiter, getIP, checkRateLimit } from "@/lib/rate-limit";

// POST /api/streak — Log activity (auth required, logs for authenticated user only)
export async function POST(request: NextRequest) {
  // Rate limit: reuse messages limiter (60/min per IP)
  const { success } = await checkRateLimit(messagesLimiter, getIP(request));
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date().toISOString().split("T")[0];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { error } = await sb
      .from("streak_logs")
      .upsert({ user_id: user.id, activity_date: today }, { onConflict: "user_id,activity_date" });

    if (error) {
      console.error("Failed to log streak:", error);
      return NextResponse.json({ error: "Failed to log activity" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      activity_date: today,
      message: "Activity logged successfully",
    });
  } catch {
    return NextResponse.json({ error: "Failed to log activity" }, { status: 500 });
  }
}

// GET /api/streak?user_id=xxx — Get streak info for a user (public)
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

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

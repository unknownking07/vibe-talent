import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

    // Accept the client's local YYYY-MM-DD so the stored date matches what
    // the dashboard queries (also local). Defaulting to UTC here caused
    // evening-timezone users to log for tomorrow's UTC date, and on refresh
    // the dashboard's local-date query wouldn't find the row — the UI would
    // revert to "Log Activity" even though the row was in the DB.
    const body = await request.json().catch(() => ({}));
    const clientDate =
      typeof (body as { date?: unknown })?.date === "string"
        ? (body as { date: string }).date
        : null;

    let activityDate = new Date().toISOString().split("T")[0];
    if (clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)) {
      const clientMs = new Date(`${clientDate}T00:00:00Z`).getTime();
      const utcMidnight = new Date();
      utcMidnight.setUTCHours(0, 0, 0, 0);
      const dayDiff = Math.abs(clientMs - utcMidnight.getTime()) / 86_400_000;
      // Accept only when within 1 day of server UTC — that window covers
      // every real-world timezone (UTC-12 to UTC+14) and caps clock-spoofing
      // backfill to a single adjacent day.
      if (!Number.isNaN(dayDiff) && dayDiff <= 1) {
        activityDate = clientDate;
      }
    }

    // Use admin client for the insert: user is already authenticated above, and
    // we pin user_id to user.id so there's no privilege escalation. Admin client
    // avoids anon-key/RLS edge cases where the PostgREST INSERT silently 404s.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { error } = await admin
      .from("streak_logs")
      .upsert({ user_id: user.id, activity_date: activityDate }, { onConflict: "user_id,activity_date" });

    if (error) {
      console.error("Failed to log streak:", error);
      return NextResponse.json({ error: "Failed to log activity" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      activity_date: activityDate,
      message: "Activity logged successfully",
    });
  } catch (err) {
    console.error("Streak API error:", err);
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

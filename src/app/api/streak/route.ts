import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { messagesLimiter, getIP, checkRateLimit } from "@/lib/rate-limit";
import { validateUUID } from "@/lib/validation";

// POST /api/streak — Log activity (auth required, logs for authenticated user only)
export async function POST(request: NextRequest) {
  try {
    // Rate limit (Upstash) and auth (GoTrue) are independent lookups against
    // two different services, so run them concurrently instead of paying both
    // round trips serially. On the Cloudflare→Supabase(Seoul) path that's
    // ~100ms off every log — the user-visible cost of tapping Log Activity.
    const supabase = await createServerSupabaseClient();
    const [{ success }, { data: { user } }] = await Promise.all([
      checkRateLimit(messagesLimiter, getIP(request)),
      supabase.auth.getUser(),
    ]);

    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

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

  if (!userId || !validateUUID(userId)) {
    return NextResponse.json({ error: "A valid user_id is required" }, { status: 400 });
  }

  const { data, error } = await createAdminClient()
    .from("users")
    .select("streak, longest_streak, badge_level, vibe_score")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch streak:", error);
    return NextResponse.json({ error: "Failed to fetch streak" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    user_id: userId,
    current_streak: data.streak,
    longest_streak: data.longest_streak,
    badge_level: data.badge_level,
    vibe_score: data.vibe_score,
  });
}

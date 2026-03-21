import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron job: Reset streaks for users who haven't logged activity recently.
 * Should be called once daily (e.g., via Vercel Cron or external service).
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret (skip in development)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    // Find users with active streaks who haven't logged activity today or yesterday
    const { data: staleUsers, error: fetchError } = await supabase
      .from("users")
      .select("id, username, streak")
      .gt("streak", 0);

    if (fetchError) {
      console.error("Failed to fetch users:", fetchError);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    if (!staleUsers || staleUsers.length === 0) {
      return NextResponse.json({ message: "No active streaks to check", reset: 0 });
    }

    // Get yesterday's date (users have until end of day to log)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // Get all recent streak logs (today or yesterday)
    const { data: recentLogs, error: logsError } = await supabase
      .from("streak_logs")
      .select("user_id")
      .gte("activity_date", yesterdayStr);

    if (logsError) {
      console.error("Failed to fetch streak logs:", logsError);
      return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
    }

    const activeUserIds = new Set((recentLogs || []).map((log) => log.user_id));

    // Find users whose streak should be reset
    const usersToReset = staleUsers.filter((user) => !activeUserIds.has(user.id));

    if (usersToReset.length === 0) {
      return NextResponse.json({ message: "All streaks are current", reset: 0 });
    }

    // Reset streaks to 0
    const resetIds = usersToReset.map((u) => u.id);
    const { error: updateError } = await supabase
      .from("users")
      .update({ streak: 0 })
      .in("id", resetIds);

    if (updateError) {
      console.error("Failed to reset streaks:", updateError);
      return NextResponse.json({ error: "Failed to reset streaks" }, { status: 500 });
    }

    console.log(`Reset streaks for ${usersToReset.length} users:`, usersToReset.map((u) => u.username));

    return NextResponse.json({
      message: `Reset ${usersToReset.length} stale streaks`,
      reset: usersToReset.length,
      users: usersToReset.map((u) => u.username),
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

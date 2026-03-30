import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cron job: Reset streaks for users who haven't logged activity recently.
 * Should be called once daily (e.g., via Vercel Cron or external service).
 *
 * If a user has streak freezes remaining, their streak is preserved and
 * one freeze is consumed instead of resetting.
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

  const supabase = createAdminClient();

  try {
    // Find users with active streaks who haven't logged activity today or yesterday
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: staleUsers, error: fetchError } = await supabase
      .from("users")
      .select("id, username, streak, streak_freezes_remaining, streak_freezes_used")
      .gt("streak", 0);

    if (fetchError) {
      console.error("Failed to fetch users:", fetchError);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    if (!staleUsers || staleUsers.length === 0) {
      return NextResponse.json({ message: "No active streaks to check", reset: 0, froze: 0 });
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

    const activeUserIds = new Set((recentLogs || []).map((log: { user_id: string }) => log.user_id));

    // Find users whose streak is at risk (no recent activity)
    const inactiveUsers = staleUsers.filter(
      (user: { id: string }) => !activeUserIds.has(user.id)
    );

    if (inactiveUsers.length === 0) {
      return NextResponse.json({ message: "All streaks are current", reset: 0, froze: 0 });
    }

    // Separate users into those who can use a freeze and those who get reset
    const usersToFreeze = inactiveUsers.filter(
      (u: { streak_freezes_remaining: number }) => (u.streak_freezes_remaining ?? 0) > 0
    );
    const usersToReset = inactiveUsers.filter(
      (u: { streak_freezes_remaining: number }) => (u.streak_freezes_remaining ?? 0) <= 0
    );

    // Consume a freeze for users who have freezes remaining
    if (usersToFreeze.length > 0) {
      for (const u of usersToFreeze) {
        const { error: freezeError } = await supabase
          .from("users")
          .update({
            streak_freezes_remaining: (u.streak_freezes_remaining ?? 2) - 1,
            streak_freezes_used: (u.streak_freezes_used ?? 0) + 1,
          })
          .eq("id", u.id);

        if (freezeError) {
          console.error(`Failed to consume freeze for ${u.username}:`, freezeError);
        }
      }
      console.log(
        `Consumed streak freezes for ${usersToFreeze.length} users:`,
        usersToFreeze.map((u: { username: string }) => u.username)
      );
    }

    // Reset streaks to 0 for users without freezes
    if (usersToReset.length > 0) {
      const resetIds = usersToReset.map((u: { id: string }) => u.id);
      const { error: updateError } = await supabase
        .from("users")
        .update({ streak: 0 })
        .in("id", resetIds);

      if (updateError) {
        console.error("Failed to reset streaks:", updateError);
        return NextResponse.json({ error: "Failed to reset streaks" }, { status: 500 });
      }

      console.log(
        `Reset streaks for ${usersToReset.length} users:`,
        usersToReset.map((u: { username: string }) => u.username)
      );
    }

    return NextResponse.json({
      message: `Reset ${usersToReset.length} stale streaks, froze ${usersToFreeze.length} streaks`,
      reset: usersToReset.length,
      froze: usersToFreeze.length,
      resetUsers: usersToReset.map((u: { username: string }) => u.username),
      frozeUsers: usersToFreeze.map((u: { username: string }) => u.username),
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { sendStreakWarningEmail } from "@/lib/email";

/**
 * Cron job: Warn users whose streaks are about to expire.
 * Runs daily at 6 PM UTC (6 hours before the midnight reset cron).
 *
 * Sends both an in-app notification and an email to users who have an
 * active streak but haven't logged any activity today.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not configured");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    // Get users with active streaks
    const { data: activeUsers, error: fetchError } = await supabase
      .from("users")
      .select("id, username, streak, streak_freezes_remaining")
      .gt("streak", 0);

    if (fetchError) {
      console.error("Failed to fetch users:", fetchError);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    if (!activeUsers || activeUsers.length === 0) {
      return NextResponse.json({ message: "No active streaks", warned: 0 });
    }

    // Get today's date
    const todayStr = new Date().toISOString().split("T")[0];

    // Get today's streak logs
    const { data: todayLogs, error: logsError } = await supabase
      .from("streak_logs")
      .select("user_id")
      .eq("activity_date", todayStr);

    if (logsError) {
      console.error("Failed to fetch streak logs:", logsError);
      return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
    }

    const loggedTodayIds = new Set((todayLogs || []).map((log) => log.user_id));

    // Users at risk = active streak but no activity today
    const atRiskUsers = activeUsers.filter((user) => !loggedTodayIds.has(user.id));

    if (atRiskUsers.length === 0) {
      return NextResponse.json({ message: "All streaking users logged today", warned: 0 });
    }

    // Check for already-sent warnings today to prevent duplicates
    const atRiskIds = atRiskUsers.map((u) => u.id);
    const { data: existingWarnings, error: warningsError } = await supabase
      .from("notifications")
      .select("user_id")
      .in("user_id", atRiskIds)
      .eq("type", "streak_warning")
      .gte("created_at", `${todayStr}T00:00:00Z`);

    if (warningsError) {
      console.error("Failed to fetch existing warnings:", warningsError);
      return NextResponse.json({ error: "Failed to check existing warnings" }, { status: 500 });
    }

    const alreadyWarnedIds = new Set((existingWarnings || []).map((n) => n.user_id));
    const usersToWarn = atRiskUsers.filter((u) => !alreadyWarnedIds.has(u.id));

    if (usersToWarn.length === 0) {
      return NextResponse.json({ message: "All at-risk users already warned today", warned: 0 });
    }

    // Fetch emails from auth.users via admin API
    const emailMap = new Map<string, string>();
    for (const u of usersToWarn) {
      const { data, error } = await supabase.auth.admin.getUserById(u.id);
      if (error) {
        console.error(`Failed to fetch email for user ${u.username}:`, error);
        continue;
      }
      if (data?.user?.email) {
        emailMap.set(u.id, data.user.email);
      }
    }

    // Send warnings per user and track outcomes
    const results = await Promise.allSettled(
      usersToWarn.map(async (user) => {
        // In-app notification
        await createNotification({
          user_id: user.id,
          type: "streak_warning",
          title: "Streak ending soon!",
          message: `Your ${user.streak}-day streak will reset at 00:00 UTC. Log activity now to keep it alive! You have ${user.streak_freezes_remaining ?? 0} freeze(s) remaining.`,
          metadata: { streak: user.streak },
        });

        // Email notification
        const email = emailMap.get(user.id);
        if (email) {
          await sendStreakWarningEmail({
            email,
            username: user.username,
            streakDays: user.streak,
          });
        }

        return user.username;
      })
    );

    const succeeded: string[] = [];
    const failed: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const username = usersToWarn[i].username;
      if (result.status === "fulfilled") {
        succeeded.push(username);
      } else {
        console.error(`Failed to warn ${username}:`, result.reason);
        failed.push(username);
      }
    }

    console.log(
      `Streak warnings: ${succeeded.length} succeeded, ${failed.length} failed`,
      { succeeded, failed }
    );

    return NextResponse.json({
      message: `Warned ${succeeded.length} users about expiring streaks`,
      warned: succeeded.length,
      users: succeeded,
      ...(failed.length > 0 ? { failed } : {}),
    });
  } catch (error) {
    console.error("Streak warning cron error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

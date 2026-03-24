import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
    // Get users with active streaks
    const { data: activeUsers, error: fetchError } = await supabase
      .from("users")
      .select("id, username, streak")
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
    const { data: existingWarnings } = await supabase
      .from("notifications")
      .select("user_id")
      .in("user_id", atRiskIds)
      .eq("type", "streak_warning")
      .gte("created_at", `${todayStr}T00:00:00Z`);

    const alreadyWarnedIds = new Set((existingWarnings || []).map((n) => n.user_id));
    const usersToWarn = atRiskUsers.filter((u) => !alreadyWarnedIds.has(u.id));

    if (usersToWarn.length === 0) {
      return NextResponse.json({ message: "All at-risk users already warned today", warned: 0 });
    }

    // Fetch emails from auth.users via admin API
    const userIds = usersToWarn.map((u) => u.id);
    const emailMap = new Map<string, string>();

    // Batch fetch auth users (Supabase admin listUsers)
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (authData?.users) {
      for (const authUser of authData.users) {
        if (userIds.includes(authUser.id) && authUser.email) {
          emailMap.set(authUser.id, authUser.email);
        }
      }
    }

    // Send warnings
    const warnings: Promise<void>[] = [];
    for (const user of usersToWarn) {
      // In-app notification
      warnings.push(
        createNotification({
          user_id: user.id,
          type: "streak_warning",
          title: "Streak ending soon!",
          message: `Your ${user.streak}-day streak will reset at midnight. Log activity now to keep it alive!`,
          metadata: { streak: user.streak },
        })
      );

      // Email notification
      const email = emailMap.get(user.id);
      if (email) {
        warnings.push(
          sendStreakWarningEmail({
            email,
            username: user.username,
            streakDays: user.streak,
          })
        );
      }
    }

    await Promise.allSettled(warnings);

    console.log(
      `Sent streak warnings to ${usersToWarn.length} users:`,
      usersToWarn.map((u) => u.username)
    );

    return NextResponse.json({
      message: `Warned ${usersToWarn.length} users about expiring streaks`,
      warned: usersToWarn.length,
      users: usersToWarn.map((u) => u.username),
    });
  } catch (error) {
    console.error("Streak warning cron error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

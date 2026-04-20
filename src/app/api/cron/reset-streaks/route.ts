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
  // Verify cron secret (skip in development). Fail closed in production so a
  // missing CRON_SECRET doesn't leave this route unauthenticated — it mutates
  // streak state and returns usernames.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret && process.env.NODE_ENV === "production") {
    console.error("CRON_SECRET is not configured");
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  }
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();

  try {
    // Find users with active streaks who haven't logged activity today or yesterday
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

    // Consume a freeze for users who have freezes remaining.
    // CRITICAL: the user's `streak` column is recomputed from `streak_logs` by
    // the AFTER INSERT trigger on that table. Decrementing the freeze counter
    // alone doesn't preserve the streak — the chain still has a gap, and the
    // very next streak_log insert (or project add) will recompute streak to
    // the broken value. So we also upsert a synthetic streak_log for yesterday
    // so `update_user_streak()` sees an unbroken chain.
    //
    // We only want to consume a freeze for users who actually needed the
    // synthetic log — if a user logged activity in the race window between the
    // SELECT and the upsert, the insert would be ignored and we'd still burn
    // their freeze for nothing. Using .select() on the upsert returns only the
    // rows that were actually inserted (ignoreDuplicates skips the rest), so
    // we use that as the authoritative set to decrement.
    const frozenUsernames: string[] = [];
    if (usersToFreeze.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const syntheticLogs = usersToFreeze.map((u: any) => ({
        user_id: u.id,
        activity_date: yesterdayStr,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: insertedLogs, error: logsInsertError } = await (supabase as any)
        .from("streak_logs")
        .upsert(syntheticLogs, { onConflict: "user_id,activity_date", ignoreDuplicates: true })
        .select("user_id");

      if (logsInsertError) {
        console.error("Failed to insert synthetic freeze logs:", logsInsertError);
        return NextResponse.json({ error: "Failed to preserve streak chain" }, { status: 500 });
      }

      const actuallyFrozenIds = new Set(
        (insertedLogs || []).map((l: { user_id: string }) => l.user_id)
      );

      for (const u of usersToFreeze) {
        if (!actuallyFrozenIds.has(u.id)) continue;
        const { error: freezeError } = await supabase
          .from("users")
          .update({
            streak_freezes_remaining: Math.max(0, (u.streak_freezes_remaining ?? 2) - 1),
            streak_freezes_used: (u.streak_freezes_used ?? 0) + 1,
          })
          .eq("id", u.id);

        if (freezeError) {
          console.error(`Failed to consume freeze for ${u.username}:`, freezeError);
          continue;
        }
        frozenUsernames.push(u.username);
      }
      if (frozenUsernames.length > 0) {
        console.log(`Consumed streak freezes for ${frozenUsernames.length} users:`, frozenUsernames);
      }
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
      message: `Reset ${usersToReset.length} stale streaks, froze ${frozenUsernames.length} streaks`,
      reset: usersToReset.length,
      froze: frozenUsernames.length,
      resetUsers: usersToReset.map((u: { username: string }) => u.username),
      frozeUsers: frozenUsernames,
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

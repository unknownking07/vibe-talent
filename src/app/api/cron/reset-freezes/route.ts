import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cron job: Reset streak freezes for all users on the 1st of every month.
 * Restores each user's freeze allowance to 2 and resets the used counter.
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();

  try {
    // Reset all users' freeze counts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error } = await (supabase as any)
      .from("users")
      .update({
        streak_freezes_remaining: 2,
        streak_freezes_used: 0,
      })
      .neq("id", "")
      .select("id", { count: "exact", head: true });

    if (error) {
      console.error("Failed to reset freezes:", error);
      return NextResponse.json({ error: "Failed to reset freezes" }, { status: 500 });
    }

    const resetCount = count ?? 0;
    console.log(`Reset streak freezes for ${resetCount} users`);

    return NextResponse.json({
      message: `Reset freezes for ${resetCount} users`,
      count: resetCount,
    });
  } catch (error) {
    console.error("Freeze reset cron error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

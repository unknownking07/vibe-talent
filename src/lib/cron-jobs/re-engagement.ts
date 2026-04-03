import { createAdminClient } from "@/lib/supabase/admin";
import { sendReEngagementEmail } from "@/lib/email";

const INACTIVE_DAYS = 4;

/**
 * Send re-engagement emails to users who haven't been active for 4+ days.
 * Only sends once per user (tracked via email_log).
 */
export async function runReEngagement(): Promise<{ sent: number; skipped: number }> {
  const sb = createAdminClient();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - INACTIVE_DAYS);
  const cutoffStr = cutoffDate.toISOString().split("T")[0];

  // Get all users who signed up at least INACTIVE_DAYS ago
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users, error } = await (sb as any)
    .from("users")
    .select("id, username, created_at")
    .lte("created_at", cutoffDate.toISOString());

  if (error || !users || users.length === 0) {
    return { sent: 0, skipped: 0 };
  }

  const userIds = users.map((u: { id: string }) => u.id);

  // Check who already received a re-engagement email (only send once)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: alreadySent } = await (sb as any)
    .from("email_log")
    .select("user_id")
    .in("user_id", userIds)
    .eq("email_type", "re_engagement");

  const alreadySentIds = new Set((alreadySent || []).map((e: { user_id: string }) => e.user_id));

  // Get recent activity — users who logged activity in the last INACTIVE_DAYS days
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentLogs } = await (sb as any)
    .from("streak_logs")
    .select("user_id")
    .in("user_id", userIds)
    .gte("activity_date", cutoffStr);

  const recentlyActiveIds = new Set((recentLogs || []).map((l: { user_id: string }) => l.user_id));

  // Get last activity date per user for accurate "days since last active" in the email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lastActivityLogs } = await (sb as any)
    .from("streak_logs")
    .select("user_id, activity_date")
    .in("user_id", userIds)
    .order("activity_date", { ascending: false });

  const lastActivityMap = new Map<string, string>();
  for (const log of (lastActivityLogs || [])) {
    if (!lastActivityMap.has(log.user_id)) {
      lastActivityMap.set(log.user_id, log.activity_date);
    }
  }

  // Check email preferences
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prefs } = await (sb as any)
    .from("email_preferences")
    .select("user_id, re_engagement")
    .in("user_id", userIds);

  const prefMap = new Map(
    (prefs || []).map((p: { user_id: string; re_engagement: boolean }) => [p.user_id, p.re_engagement])
  );

  // Filter to inactive users who haven't been emailed and haven't opted out
  const targets = users.filter((u: { id: string }) => {
    if (alreadySentIds.has(u.id)) return false;
    if (recentlyActiveIds.has(u.id)) return false;
    if (prefMap.get(u.id) === false) return false;
    return true;
  });

  let sent = 0;
  const skipped = users.length - targets.length;

  for (const user of targets) {
    // Calculate days since last activity (fall back to signup date if no activity)
    const lastActivity = lastActivityMap.get(user.id);
    const referenceDate = lastActivity ? new Date(lastActivity) : new Date(user.created_at);
    const daysSince = Math.floor((Date.now() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));

    // Get user email from auth
    const { data: authUser } = await sb.auth.admin.getUserById(user.id);
    if (!authUser?.user?.email) continue;

    // Log first to prevent duplicates if email succeeds but log fails on retry
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: logError } = await (sb as any).from("email_log").insert({
      user_id: user.id,
      email_type: "re_engagement",
      sent_at: new Date().toISOString(),
    });

    if (logError) {
      console.error(`Failed to log re-engagement email for ${user.username}:`, logError);
      continue;
    }

    await sendReEngagementEmail({
      email: authUser.user.email,
      username: user.username,
      daysSinceLastActive: daysSince,
    });

    sent++;
  }

  return { sent, skipped };
}

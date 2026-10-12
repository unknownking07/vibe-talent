import { createAdminClient } from "@/lib/supabase/admin";
import { sendWeeklyDigestEmail } from "@/lib/email";

// Resend free tier is 100 emails/day; we keep 10 in reserve for transactional
// traffic (signups, milestones, profile views) so the digest never starves
// them. Anything past 90 carries over to the next day's cron run.
const DAILY_EMAIL_CAP = 90;
const EMAIL_INTERVAL_MS = 200;

function checkQuery(error: { message: string } | null, context: string) {
  if (error) throw new Error(`weekly-digest ${context}: ${error.message}`);
}

/**
 * Weekly digest. Cron is scheduled Mon + Tue at 15:00 UTC.
 *
 * - In-app notifications dedupe via the notifications table (one per user
 *   per week, regardless of which day the cron actually catches them).
 * - Emails dedupe via email_log and are capped at DAILY_EMAIL_CAP per UTC day,
 *   so a 121-user batch sends ~90 Monday and the rest Tuesday.
 */
export async function runWeeklyDigest(): Promise<{
  notified: number;
  emailed: number;
}> {
  const sb = createAdminClient();

  // Anchor to most recent Monday 00:00 UTC. Mon=0 days ago, Tue=1, ..., Sun=6.
  const today = new Date();
  const daysSinceMonday = (today.getUTCDay() + 6) % 7;
  const weekStart = new Date(today);
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMonday);
  const weekStartIso = weekStart.toISOString();

  const weekAgoIso = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users, error } = await (sb as any)
    .from("users")
    .select("id, username, streak, vibe_score");

  checkQuery(error, "users");
  if (!users || users.length === 0) {
    return { notified: 0, emailed: 0 };
  }

  const userIds = users.map((u: { id: string }) => u.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: views, error: viewsError } = await (sb as any)
    .from("profile_views")
    .select("viewed_user_id")
    .in("viewed_user_id", userIds)
    .gte("viewed_at", weekAgoIso);
  checkQuery(viewsError, "profile views");

  const viewCounts = new Map<string, number>();
  for (const v of (views || [])) {
    viewCounts.set(v.viewed_user_id, (viewCounts.get(v.viewed_user_id) || 0) + 1);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: hires, error: hiresError } = await (sb as any)
    .from("hire_requests")
    .select("builder_id")
    .in("builder_id", userIds)
    .gte("created_at", weekAgoIso);
  checkQuery(hiresError, "hire requests");

  const hireCounts = new Map<string, number>();
  for (const h of (hires || [])) {
    hireCounts.set(h.builder_id, (hireCounts.get(h.builder_id) || 0) + 1);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: projects, error: projectsError } = await (sb as any)
    .from("projects")
    .select("user_id")
    .in("user_id", userIds);
  checkQuery(projectsError, "projects");

  const projectCounts = new Map<string, number>();
  for (const p of (projects || [])) {
    projectCounts.set(p.user_id, (projectCounts.get(p.user_id) || 0) + 1);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prefs, error: prefsError } = await (sb as any)
    .from("email_preferences")
    .select("user_id, weekly_digest")
    .in("user_id", userIds);
  checkQuery(prefsError, "preferences");

  const prefMap = new Map((prefs || []).map((p: { user_id: string; weekly_digest: boolean }) => [p.user_id, p.weekly_digest]));

  // Users already notified this week (in-app)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: alreadyNotified, error: notifiedError } = await (sb as any)
    .from("notifications")
    .select("user_id")
    .eq("type", "weekly_digest")
    .in("user_id", userIds)
    .gte("created_at", weekStartIso);
  checkQuery(notifiedError, "notification dedupe");
  const alreadyNotifiedSet = new Set<string>((alreadyNotified || []).map((r: { user_id: string }) => r.user_id));

  // Users already emailed this week
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: alreadyEmailed, error: emailedError } = await (sb as any)
    .from("email_log")
    .select("user_id")
    .eq("email_type", "weekly_digest")
    .gte("sent_at", weekStartIso);
  checkQuery(emailedError, "email dedupe");
  const alreadyEmailedSet = new Set<string>((alreadyEmailed || []).map((r: { user_id: string }) => r.user_id));

  const dayStart = new Date(today);
  dayStart.setUTCHours(0, 0, 0, 0);
  // Include earlier successful batches today, including a partially completed
  // run. A per-run cap could spend the provider's daily quota more than once.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: sentToday, error: countError } = await (sb as any)
    .from("email_log")
    .select("id", { count: "exact", head: true })
    .eq("email_type", "weekly_digest")
    .gte("sent_at", dayStart.toISOString());
  checkQuery(countError, "daily allowance");
  const remainingEmails = Math.max(0, DAILY_EMAIL_CAP - (sentToday ?? 0));

  let notified = 0;
  let emailed = 0;

  for (const user of users) {
    const stats = {
      profileViews: viewCounts.get(user.id) || 0,
      streakDays: user.streak,
      vibeScore: user.vibe_score,
      projectCount: projectCounts.get(user.id) || 0,
      hireRequests: hireCounts.get(user.id) || 0,
    };

    if (!alreadyNotifiedSet.has(user.id)) {
      const { error: notificationError } = await sb.from("notifications").insert({
        user_id: user.id,
        type: "weekly_digest",
        title: "Your weekly recap is here",
        message: `${stats.profileViews} profile views, ${stats.streakDays}-day streak, ${stats.vibeScore} vibe score this week`,
        metadata: stats,
      });
      checkQuery(notificationError, "notification write");
      notified++;
    }

    if (alreadyEmailedSet.has(user.id)) continue;
    if (emailed >= remainingEmails) continue;

    const wantsEmail = prefMap.get(user.id) !== false;
    if (!wantsEmail) continue;

    const { data: authUser, error: authError } = await sb.auth.admin.getUserById(user.id);
    checkQuery(authError, "recipient lookup");
    if (!authUser?.user?.email) continue;

    // Pace this batch at most five requests/second, below Resend's current
    // default of ten. Auth/DB
    // latency alone is not a dependable rate limiter when those services are fast.
    if (emailed > 0) await new Promise(resolve => setTimeout(resolve, EMAIL_INTERVAL_MS));
    await sendWeeklyDigestEmail({
      email: authUser.user.email,
      username: user.username,
      stats,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: logError } = await (sb as any).from("email_log").insert({
      user_id: user.id,
      email_type: "weekly_digest",
    });
    checkQuery(logError, "email receipt write");

    emailed++;
  }

  return { notified, emailed };
}

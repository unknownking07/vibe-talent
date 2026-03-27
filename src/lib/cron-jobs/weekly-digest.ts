import { createClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications";
import { sendWeeklyDigestEmail } from "@/lib/email";

/**
 * Send weekly digest emails. Only runs on Mondays.
 */
export async function runWeeklyDigest(): Promise<{ notified: number; skipped?: string }> {
  // Only run on Mondays
  const today = new Date();
  if (today.getUTCDay() !== 1) {
    return { notified: 0, skipped: "Not Monday" };
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Get all users
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users, error } = await (sb as any)
    .from("users")
    .select("id, username, streak, vibe_score");

  if (error || !users || users.length === 0) {
    return { notified: 0 };
  }

  const userIds = users.map((u: { id: string }) => u.id);

  // Get profile views this week
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: views } = await (sb as any)
    .from("profile_views")
    .select("viewed_user_id")
    .in("viewed_user_id", userIds)
    .gte("viewed_at", weekAgo);

  const viewCounts = new Map<string, number>();
  for (const v of (views || [])) {
    viewCounts.set(v.viewed_user_id, (viewCounts.get(v.viewed_user_id) || 0) + 1);
  }

  // Get hire requests this week
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: hires } = await (sb as any)
    .from("hire_requests")
    .select("builder_id")
    .in("builder_id", userIds)
    .gte("created_at", weekAgo);

  const hireCounts = new Map<string, number>();
  for (const h of (hires || [])) {
    hireCounts.set(h.builder_id, (hireCounts.get(h.builder_id) || 0) + 1);
  }

  // Get project counts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: projects } = await (sb as any)
    .from("projects")
    .select("user_id")
    .in("user_id", userIds);

  const projectCounts = new Map<string, number>();
  for (const p of (projects || [])) {
    projectCounts.set(p.user_id, (projectCounts.get(p.user_id) || 0) + 1);
  }

  // Check email preferences
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prefs } = await (sb as any)
    .from("email_preferences")
    .select("user_id, weekly_digest")
    .in("user_id", userIds);

  const prefMap = new Map((prefs || []).map((p: { user_id: string; weekly_digest: boolean }) => [p.user_id, p.weekly_digest]));

  let notified = 0;

  for (const user of users) {
    const wantsEmail = prefMap.get(user.id) !== false;
    const stats = {
      profileViews: viewCounts.get(user.id) || 0,
      streakDays: user.streak,
      vibeScore: user.vibe_score,
      projectCount: projectCounts.get(user.id) || 0,
      hireRequests: hireCounts.get(user.id) || 0,
    };

    // In-app notification for everyone
    await createNotification({
      user_id: user.id,
      type: "weekly_digest",
      title: "Your weekly recap is here",
      message: `${stats.profileViews} profile views, ${stats.streakDays}-day streak, ${stats.vibeScore} vibe score this week`,
      metadata: stats,
    });

    // Email only if opted in
    if (wantsEmail) {
      const { data: authUser } = await sb.auth.admin.getUserById(user.id);
      if (authUser?.user?.email) {
        await sendWeeklyDigestEmail({
          email: authUser.user.email,
          username: user.username,
          stats,
        });
      }
    }

    notified++;
  }

  return { notified };
}
